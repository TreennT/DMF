import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const BACKEND_ROOT = path.join(PROJECT_ROOT, "backend");
const TMP_DIR = path.join(
  process.env.VALIDATION_TMP_DIR ?? tmpdir(),
  "dmf-validator",
);
const PYTHON_RUNNER = path.join(BACKEND_ROOT, "python_runner.py");

const PYTHON_CANDIDATES = [process.env.PYTHON_BIN, "python", "python3"].filter(
  (candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0),
);

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

function spawnPythonProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const python = spawn(command, args, {
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

    python.on("error", (error) => {
      reject(error);
    });

    python.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function runPythonValidation(inputPath: string, outputDir: string, rulesPath?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const args = rulesPath ? [PYTHON_RUNNER, inputPath, outputDir, rulesPath] : [PYTHON_RUNNER, inputPath, outputDir];

  let lastError: NodeJS.ErrnoException | null = null;

  for (const command of PYTHON_CANDIDATES) {
    try {
      return await spawnPythonProcess(command, args);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        lastError = error as NodeJS.ErrnoException;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw Object.assign(new Error("Unable to locate a Python interpreter."), { code: "ENOENT" });
}

function computeOutputName(baseName: string): string {
  return baseName.toLowerCase().endsWith(".xlsx") ? `${baseName.slice(0, -5)} review.xlsx` : baseName;
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new NextResponse("Aucun fichier recu", { status: 400 });
    }

    const { inputPath, baseName } = await saveUploadedFile(file);
    const cleanupTargets = new Set<string>([inputPath]);

    const rawRules = formData.get("rules");
    let runtimeRulesPath: string | undefined;
    try {
      if (typeof rawRules === "string") {
        const trimmedRules = rawRules.trim();
        if (trimmedRules.length > 0) {
          try {
            const parsed = JSON.parse(trimmedRules);
            const sanitized = sanitizeRules(parsed);
            const rulesFile = `${randomUUID()}-rules.json`;
            const rulesPath = path.join(TMP_DIR, rulesFile);
            await writeFile(rulesPath, JSON.stringify(sanitized), "utf-8");
            cleanupTargets.add(rulesPath);
            runtimeRulesPath = rulesPath;
          } catch (error) {
            console.error("Invalid rules payload", error);
            return new NextResponse("Le format des regles est invalide", { status: 400 });
          }
        }
      }

      let result;
      try {
        result = await runPythonValidation(inputPath, TMP_DIR, runtimeRulesPath);
      } catch (error) {
        console.error("Failed to start Python validation", error);
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? (error as NodeJS.ErrnoException).code
            : undefined;
        const message =
          code === "ENOENT"
            ? "Python n'est pas disponible sur le serveur de validation."
            : "Echec lors du lancement du moteur Python.";
        return NextResponse.json({ success: false, message }, { status: 500 });
      }

      if (result.code !== 0) {
        const message = result.stderr || result.stdout || "La validation a echoue";
        return NextResponse.json({ success: false, message }, { status: 500 });
      }

      const reviewName = computeOutputName(baseName);
      return NextResponse.json({
        success: true,
        message: "Validation terminee. Rapport disponible.",
        downloadUrl: `/api/reports/${encodeURIComponent(reviewName)}`,
      });
    } finally {
      await Promise.all(
        Array.from(cleanupTargets, (target) =>
          rm(target, { force: true }).catch(() => undefined),
        ),
      );
    }
  } catch (error) {
    console.error(error);
    return new NextResponse("Erreur interne du serveur", { status: 500 });
  }
}