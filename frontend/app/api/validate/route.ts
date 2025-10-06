import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const BACKEND_ROOT = path.join(PROJECT_ROOT, "backend");
const TMP_DIR = path.join(BACKEND_ROOT, "tmp");
const PYTHON_RUNNER = path.join(BACKEND_ROOT, "python_runner.py");

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new NextResponse("Aucun fichier reçu", { status: 400 });
    }

    const { inputPath, baseName } = await saveUploadedFile(file);
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
