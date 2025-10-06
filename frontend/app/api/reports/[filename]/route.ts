import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const TMP_DIR = path.join(PROJECT_ROOT, "backend", "tmp");

export async function GET(
  _req: NextRequest,
  context: { params: { filename: string } },
): Promise<NextResponse> {
  const { filename } = context.params;
  const safeName = path.basename(filename);
  const filePath = path.join(TMP_DIR, safeName);

  try {
    await stat(filePath);
  } catch {
    return new NextResponse("Fichier introuvable", { status: 404 });
  }

  const buffer = await readFile(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  });
}
