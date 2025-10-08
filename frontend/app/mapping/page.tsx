"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";

import { useLanguage } from "../../components/language-provider";

type MappingRuleRow = {
  id: string;
  target: string;
  instruction: string;
};

type MappingRulePayload = {
  target: string;
  rule: string;
};

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

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mapping-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCell(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function parseParametersSheet(sheet: XLSX.WorkSheet): MappingRuleRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  });

  return rows.reduce<MappingRuleRow[]>((acc, row, index) => {
    const [rawTarget, rawInstruction] = row ?? [];
    const target = normalizeCell(rawTarget);
    const instruction = normalizeCell(rawInstruction);

    if (!target) {
      return acc;
    }

    const isHeaderRow =
      index === 0 &&
      ["target", "champ", "colonne"].includes(target.toLowerCase()) &&
      ["rule", "instruction", "règle"].includes(instruction.toLowerCase());

    if (isHeaderRow) {
      return acc;
    }

    acc.push({
      id: createId(),
      target,
      instruction,
    });

    return acc;
  }, []);
}

function serializeRulesForBackend(rules: MappingRuleRow[]): MappingRulePayload[] {
  return rules
    .map((rule) => {
      const target = rule.target.trim();
      if (!target) {
        return null;
      }

      return {
        target,
        rule: rule.instruction.trim(),
      } satisfies MappingRulePayload;
    })
    .filter((value): value is MappingRulePayload => value !== null);
}

export default function MappingPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [rules, setRules] = useState<MappingRuleRow[]>([]);
  const [rulesEdited, setRulesEdited] = useState<boolean>(false);
  const [rulesOpen, setRulesOpen] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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

  const hasMissingTarget = useMemo(() => rules.some((rule) => !rule.target.trim()), [rules]);

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  function markRulesEdited() {
    setRulesEdited(true);
    setDownloadUrl(null);
    setStatus((current) => {
      if (current.type === "success" && file) {
        return { type: "ready", filename: file.name };
      }
      return current;
    });
  }

  function resetSelection() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFile(null);
    setRules([]);
    setRulesEdited(false);
    setRulesOpen(false);
    setDownloadUrl(null);
    setStatus({ type: "idle" });
  }

  function updateRule(id: string, updates: Partial<MappingRuleRow>) {
    setRules((previous) =>
      previous.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)),
    );
    markRulesEdited();
  }

  function addRule() {
    setRules((previous) => [
      ...previous,
      {
        id: createId(),
        target: "",
        instruction: "",
      },
    ]);
    setRulesOpen(true);
    markRulesEdited();
  }

  function removeRule(id: string) {
    setRules((previous) => previous.filter((rule) => rule.id !== id));
    markRulesEdited();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    if (!selected) {
      resetSelection();
      return;
    }

    setFile(selected);
    setStatus({ type: "ready", filename: selected.name });
    setRulesEdited(false);
    setRulesOpen(false);
    setDownloadUrl(null);

    try {
      const data = await selected.arrayBuffer();
      const workbook = XLSX.read(data);
      const parametersSheet = workbook.Sheets["Parameters"];

      if (parametersSheet) {
        const parsedRules = parseParametersSheet(parametersSheet);
        setRules(parsedRules);
        setRulesEdited(false);
      } else {
        setRules([]);
        setRulesEdited(false);
      }
    } catch (error) {
      console.error("Failed to parse mapping rules", error);
      setRules([]);
      setRulesEdited(false);
    }
  }

  async function handleSubmit() {
    if (!file || status.type === "processing" || hasMissingTarget) {
      return;
    }

    setStatus({ type: "processing", filename: file.name });

    const formData = new FormData();
    formData.append("file", file);

    if (rulesEdited) {
      const payload = serializeRulesForBackend(rules);
      formData.append("rules", JSON.stringify(payload));
    }

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
      setDownloadUrl(payload.downloadUrl);
      setRulesEdited(false);
    } catch (error) {
      console.error("Failed to launch mapping", error);
      setStatus({ type: "error", message: mapping.status.networkError });
    }
  }

  const isProcessing = status.type === "processing";
  const canLaunch = Boolean(file) && !isProcessing && !hasMissingTarget;

  return (
    <main className="min-h-screen bg-slate-50 p-6 transition-colors duration-300 dark:bg-slate-950 md:p-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
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

            {file ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <details
                  className="group"
                  open={rulesOpen}
                  onToggle={(event) => setRulesOpen(event.currentTarget.open)}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                    <span>{mapping.rules.summary(rules.length)}</span>
                    <span className="flex items-center gap-2">
                      {rulesEdited ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-200">
                          {mapping.rules.editedBadge}
                        </span>
                      ) : null}
                      <span
                        aria-hidden
                        className="text-base transition-transform duration-200 group-open:rotate-180"
                      >
                        ▾
                      </span>
                    </span>
                  </summary>

                  <div className="mt-6 space-y-6">
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
                      <p className="font-medium">{mapping.rules.description}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{mapping.rules.helper}</p>
                    </div>

                    {rules.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <p>{mapping.rules.emptyState.description}</p>
                        <button
                          type="button"
                          onClick={addRule}
                          className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                        >
                          {mapping.rules.addButton}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {rules.map((rule, index) => {
                          const missingTarget = !rule.target.trim();
                          return (
                            <div
                              key={rule.id}
                              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                            >
                              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                <div className="flex-1 space-y-4">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {mapping.rules.ruleLabel(index + 1)}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {mapping.rules.targetLabel}
                                    </label>
                                    <input
                                      value={rule.target}
                                      onChange={(event) => updateRule(rule.id, { target: event.target.value })}
                                      placeholder={mapping.rules.targetPlaceholder}
                                      className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${
                                        missingTarget
                                          ? "border-red-300 focus:border-red-400 dark:border-red-700"
                                          : "border-slate-200 focus:border-emerald-400"
                                      }`}
                                    />
                                    {missingTarget ? (
                                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                        {mapping.rules.targetError}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {mapping.rules.instructionLabel}
                                    </label>
                                    <textarea
                                      value={rule.instruction}
                                      onChange={(event) => updateRule(rule.id, { instruction: event.target.value })}
                                      placeholder={mapping.rules.instructionPlaceholder}
                                      className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                      {mapping.rules.instructionHint}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeRule(rule.id)}
                                  className="inline-flex items-center justify-center rounded-full border border-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 shadow-sm transition hover:bg-rose-50 dark:border-rose-400 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                >
                                  {mapping.rules.removeButton}
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={addRule}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
                          >
                            {mapping.rules.addButton}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </section>
            ) : null}

            <div className="flex flex-col gap-2">
              <p
                className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                  status.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/40 dark:text-red-200"
                    : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                {statusMessage}
              </p>
              {hasMissingTarget ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {mapping.rules.launchWarning}
                </p>
              ) : null}
            </div>
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
