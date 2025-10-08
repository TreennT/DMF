import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const BACKEND_ROOT = path.join(PROJECT_ROOT, "backend");
const TMP_DIR = path.join(process.env.VALIDATION_TMP_DIR ?? tmpdir(), "dmf-validator");
const PYTHON_MAPPER = path.join(BACKEND_ROOT, "mapping_runner.py");

const PYTHON_CANDIDATES = [process.env.PYTHON_BIN, "python", "python3"].filter(
  (candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0),
);

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

async function runPythonMapping(
  inputPath: string,
  outputDir: string,
  outputName?: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const args = outputName
    ? [PYTHON_MAPPER, inputPath, outputDir, outputName]
    : [PYTHON_MAPPER, inputPath, outputDir];

  let lastError: NodeJS.ErrnoException | null = null;

  for (const command of PYTHON_CANDIDATES) {
    try {
      return await spawnPythonProcess(command, args);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
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

function computeOutputName(originalName: string): string {
  const trimmed = originalName.trim();
  const base =
    trimmed.toLowerCase().endsWith(".xlsx") || trimmed.toLowerCase().endsWith(".xlsm")
      ? trimmed.replace(/\.(xlsx|xlsm)$/i, "")
      : trimmed || "mapped-file";
  return `${base}_mapping.xlsx`;
}

function parseResultName(stdout: string): string | null {
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("RESULT:")) {
      const candidate = line.slice("RESULT:".length).trim();
      if (candidate.length > 0) {
        return candidate;
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new NextResponse("Aucun fichier reçu", { status: 400 });
    }

    const { inputPath } = await saveUploadedFile(file);
    const cleanupTargets = new Set<string>([inputPath]);

    const requestedName = computeOutputName(file.name);
    const runtimeName = `${randomUUID()}-${requestedName}`;

    try {
      let result;
      try {
        result = await runPythonMapping(inputPath, TMP_DIR, runtimeName);
      } catch (error) {
        console.error("Failed to start Python mapping", error);
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? (error as NodeJS.ErrnoException).code
            : undefined;
        const message =
          code === "ENOENT"
            ? "Python n'est pas disponible sur le serveur de mapping."
            : "Échec lors du lancement du moteur Python.";
        return NextResponse.json({ success: false, message }, { status: 500 });
      }

      if (result.code !== 0) {
        const message = result.stderr || result.stdout || "La génération du fichier a échoué";
        return NextResponse.json({ success: false, message }, { status: 500 });
      }

      const generatedName = parseResultName(result.stdout) ?? runtimeName;

      return NextResponse.json({
        success: true,
        message: "Mapping terminé. Fichier disponible.",
        downloadUrl: `/api/reports/${encodeURIComponent(generatedName)}`,
        originalName: file.name,
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
