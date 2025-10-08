"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";

import { useLanguage } from "../../components/language-provider";

type StatusState =
  | { type: "idle" }
  | { type: "ready"; filename: string }
  | { type: "processing"; filename: string }
  | { type: "success"; filename: string; downloadUrl: string; originalName: string }
  | { type: "error"; message: string };

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function MappingPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  const { content } = useLanguage();
  const { mapping, common } = content;

  const statusMessage = (() => {
    switch (status.type) {
      case "idle":
        return mapping.status.idle;
      case "ready":
        return mapping.status.ready(status.filename);
      case "processing":
        return mapping.status.processing(status.filename);
      case "success":
        return mapping.status.success(status.originalName);
      case "error":
        return mapping.status.error(status.message);
      default:
        return mapping.status.idle;
    }
  })();

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  function resetSelection() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFile(null);
    setStatus({ type: "idle" });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      resetSelection();
      return;
    }
    setFile(selected);
    setStatus({ type: "ready", filename: selected.name });
  }

  async function handleSubmit() {
    if (!file || status.type === "processing") {
      return;
    }

    setStatus({ type: "processing", filename: file.name });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/mapping", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || payload.success !== true || typeof payload.downloadUrl !== "string") {
        const message =
          typeof payload?.message === "string" && payload.message.trim().length > 0
            ? payload.message
            : mapping.status.genericError;
        setStatus({ type: "error", message });
        return;
      }

      const originalName =
        typeof payload.originalName === "string" && payload.originalName.trim().length > 0
          ? payload.originalName
          : file.name;

      setStatus({
        type: "success",
        filename: file.name,
        downloadUrl: payload.downloadUrl,
        originalName,
      });
    } catch (error) {
      console.error("Failed to launch mapping", error);
      setStatus({ type: "error", message: mapping.status.networkError });
    }
  }

  const isProcessing = status.type === "processing";
  const canLaunch = Boolean(file) && !isProcessing;
  const downloadUrl = status.type === "success" ? status.downloadUrl : null;

  return (
    <main className="min-h-screen bg-slate-50 p-6 transition-colors duration-300 dark:bg-slate-950 md:p-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span aria-hidden>←</span>
            {common.backToHome}
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-6">
            <header className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {mapping.hero.badge}
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
                {mapping.hero.title}
              </h1>
              <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {mapping.hero.description}
              </p>
            </header>

            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
              {file ? (
                <div className="space-y-2">
                  <p className="text-base font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatFileSize(file.size)} · {file.type || mapping.hero.unknownType}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-base font-medium text-slate-800 dark:text-slate-100">
                    {mapping.hero.uploadLabel}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {mapping.hero.uploadHint}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openFileDialog}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:ring-offset-slate-900"
                >
                  {file ? mapping.actions.changeFile : mapping.actions.selectFile}
                </button>
                {file ? (
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {mapping.actions.removeFile}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canLaunch}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white/90"
              >
                {isProcessing ? mapping.actions.processing : mapping.actions.start}
              </button>

              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
                >
                  {mapping.actions.download}
                </a>
              ) : null}
            </div>

            <p
              className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                status.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/40 dark:text-red-200"
                  : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              {statusMessage}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {mapping.tips.title}
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {mapping.tips.items.map((tip) => (
              <li key={tip} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                  ✓
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={handleFileChange}
      />
    </main>
  );
}
