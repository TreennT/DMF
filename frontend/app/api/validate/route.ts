import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const BACKEND_ROOT = path.join(PROJECT_ROOT, "backend");
const TMP_DIR = path.join(BACKEND_ROOT, "tmp");
const PYTHON_RUNNER = path.join(BACKEND_ROOT, "python_runner.py");
const RULES_SHEET_NAME = "ValidationRules";

type AllowedType = "list" | "instruction";

type RulePayload = {
  field: string;
  checked: boolean;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  allowedType: AllowedType;
  allowedValues: string[];
  allowedInstruction: string;
  pattern: string;
  customRule: string;
};

async function ensureTmpDir(): Promise<void> {
  await mkdir(TMP_DIR, { recursive: true });
}

async function saveUploadedFile(file: File): Promise<{ inputPath: string; baseName: string }> {
  await ensureTmpDir();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const baseName = `${randomUUID()}-${file.name}`;
  const inputPath = path.join(TMP_DIR, baseName);
  await writeFile(inputPath, bytes);
  return { inputPath, baseName };
}

function runPythonValidation(inputPath: string, outputDir: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const python = spawn("python", [PYTHON_RUNNER, inputPath, outputDir], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

function computeOutputName(baseName: string): string {
  return baseName.toLowerCase().endsWith(".xlsx")
    ? `${baseName.slice(0, -5)} review.xlsx`
    : baseName;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    return lowered === "true" || lowered === "1" || lowered === "yes";
  }
  return false;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function sanitizeRules(input: unknown): RulePayload[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const raw = entry as Record<string, unknown>;
      const field = typeof raw.field === "string" ? raw.field.trim() : "";
      if (!field) {
        return null;
      }

      const allowedType: AllowedType = raw.allowedType === "instruction" ? "instruction" : "list";
      const allowedValues =
        allowedType === "list" && Array.isArray(raw.allowedValues)
          ? raw.allowedValues
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter((value) => value.length > 0)
          : [];
      const allowedInstruction =
        allowedType === "instruction" && typeof raw.allowedInstruction === "string"
          ? raw.allowedInstruction.trim()
          : "";

      return {
        field,
        checked: normalizeBoolean(raw.checked),
        required: normalizeBoolean(raw.required),
        minLength: normalizeNumber(raw.minLength),
        maxLength: normalizeNumber(raw.maxLength),
        allowedType,
        allowedValues,
        allowedInstruction,
        pattern: typeof raw.pattern === "string" ? raw.pattern.trim() : "",
        customRule: typeof raw.customRule === "string" ? raw.customRule.trim() : "",
      } satisfies RulePayload;
    })
    .filter((value): value is RulePayload => value !== null);
}

function buildAllowedCell(rule: RulePayload): string {
  if (rule.allowedType === "instruction") {
    return rule.allowedInstruction;
  }
  return rule.allowedValues.length > 0 ? `VALUE=${rule.allowedValues.join(";")}` : "";
}

function rewriteValidationSheet(filePath: string, rules: RulePayload[]): void {
  const workbook = XLSX.readFile(filePath);
  const header = [
    ["Field", "Checked", "Required", "MinLength", "MaxLength", "AllowedValues", "Pattern", "CustomRule"],
  ];
  const rows = rules.map((rule) => [
    rule.field,
    rule.checked ? 1 : 0,
    rule.required ? 1 : 0,
    rule.minLength ?? "",
    rule.maxLength ?? "",
    buildAllowedCell(rule),
    rule.pattern,
    rule.customRule,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([...header, ...rows]);

  const existingIndex = workbook.SheetNames.indexOf(RULES_SHEET_NAME);
  if (existingIndex >= 0) {
    workbook.SheetNames.splice(existingIndex, 1);
  }

  workbook.Sheets[RULES_SHEET_NAME] = sheet;
  workbook.SheetNames.push(RULES_SHEET_NAME);

  XLSX.writeFile(workbook, filePath);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new NextResponse("Aucun fichier reçu", { status: 400 });
    }

    const { inputPath, baseName } = await saveUploadedFile(file);

    const rawRules = formData.get("rules");
    if (typeof rawRules === "string") {
      try {
        const parsed = JSON.parse(rawRules);
        const sanitized = sanitizeRules(parsed);
        rewriteValidationSheet(inputPath, sanitized);
      } catch (error) {
        console.error("Invalid rules payload", error);
        return new NextResponse("Le format des règles est invalide", { status: 400 });
      }
    }

    const result = await runPythonValidation(inputPath, TMP_DIR);

    if (result.code !== 0) {
      const message = result.stderr || result.stdout || "La validation a échoué";
      return NextResponse.json({ success: false, message }, { status: 500 });
    }

    const reviewName = computeOutputName(baseName);
    return NextResponse.json({
      success: true,
      message: "Validation terminée. Rapport disponible.",
      downloadUrl: `/api/reports/${encodeURIComponent(reviewName)}`,
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Erreur interne du serveur", { status: 500 });
  }
}

