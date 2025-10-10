"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";

import { useLanguage } from "../../components/language-provider";

type MappingRulePayload = {
  target: string;
  rule: string;
};

type MappingRuleType =
  | "COLUMN"
  | "INVARIABLE"
  | "MAPPING"
  | "NS"
  | "CONCAT"
  | "CUSTOM"
  | "EMPTY";

type MappingRuleRow = {
  id: string;
  target: string;
  type: MappingRuleType;
  sourceColumn?: string;
  mappingSheet?: string;
  fixedValue?: string;
  sequencePattern?: string;
  concatExpression?: string;
  customInstruction?: string;
};

type ParsedInstruction = Omit<MappingRuleRow, "id" | "target">;

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

function extractTemplateFields(sheet?: XLSX.WorkSheet): string[] {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  if (rows.length === 0) return [];
  const headerRow =
    rows.find((row) =>
      row.some((cell) => {
        if (cell === undefined || cell === null) return false;
        return String(cell).trim().length > 0;
      }),
    ) ?? [];
  return headerRow
    .map((cell) => (cell === undefined || cell === null ? "" : String(cell).trim()))
    .filter((value) => value.length > 0);
}

function createRuleConfig(type: MappingRuleType): ParsedInstruction {
  const base: ParsedInstruction = {
    type,
    sourceColumn: undefined,
    mappingSheet: undefined,
    fixedValue: undefined,
    sequencePattern: undefined,
    concatExpression: undefined,
    customInstruction: undefined,
  };

  switch (type) {
    case "COLUMN":
      return { ...base, sourceColumn: "" };
    case "INVARIABLE":
      return { ...base, fixedValue: "" };
    case "MAPPING":
      return { ...base, sourceColumn: "", mappingSheet: "" };
    case "NS":
      return { ...base, sequencePattern: "" };
    case "CONCAT":
      return { ...base, concatExpression: "" };
    case "CUSTOM":
      return { ...base, customInstruction: "" };
    case "EMPTY":
    default:
      return { ...base, type: "EMPTY" };
  }
}

function createRuleRow(type: MappingRuleType = "COLUMN"): MappingRuleRow {
  return {
    id: createId(),
    target: "",
    ...createRuleConfig(type),
  };
}

function parseInstruction(instruction: string): ParsedInstruction {
  const cleaned = normalizeCell(instruction);

  if (!cleaned) {
    return createRuleConfig("EMPTY");
  }

  if (cleaned.startsWith("COLUMN=")) {
    return {
      ...createRuleConfig("COLUMN"),
      sourceColumn: cleaned.slice("COLUMN=".length).trim(),
    };
  }

  if (cleaned.startsWith("INVARIABLE=")) {
    return {
      ...createRuleConfig("INVARIABLE"),
      fixedValue: cleaned.slice("INVARIABLE=".length).trim(),
    };
  }

  if (cleaned.startsWith("MAPPING=")) {
    const tail = cleaned.slice("MAPPING=".length).trim();
    const [source = "", sheet = ""] = tail.split(";", 2).map((segment) => segment.trim());
    return {
      ...createRuleConfig("MAPPING"),
      sourceColumn: source,
      mappingSheet: sheet,
    };
  }

  if (cleaned.startsWith("NS=")) {
    return {
      ...createRuleConfig("NS"),
      sequencePattern: cleaned.slice("NS=".length).trim(),
    };
  }

  const concatMatch = cleaned.match(/^'?CONCAT=(.*)$/i);
  if (concatMatch) {
    return {
      ...createRuleConfig("CONCAT"),
      concatExpression: concatMatch[1].trim(),
    };
  }

  if (cleaned.includes("+") && !cleaned.includes("=")) {
    return {
      ...createRuleConfig("CONCAT"),
      concatExpression: cleaned,
    };
  }

  return {
    ...createRuleConfig("CUSTOM"),
    customInstruction: cleaned,
  };
}

function buildInstruction(rule: MappingRuleRow): string {
  switch (rule.type) {
    case "COLUMN": {
      const source = rule.sourceColumn?.trim() ?? "";
      return source ? `COLUMN=${source}` : "";
    }
    case "INVARIABLE": {
      const value = rule.fixedValue?.trim() ?? "";
      return `INVARIABLE=${value}`;
    }
    case "MAPPING": {
      const source = rule.sourceColumn?.trim() ?? "";
      const sheet = rule.mappingSheet?.trim() ?? "";
      if (!source && !sheet) {
        return "";
      }
      return `MAPPING=${source};${sheet}`;
    }
    case "NS": {
      const pattern = rule.sequencePattern?.trim() ?? "";
      return pattern ? `NS=${pattern}` : "";
    }
    case "CONCAT": {
      const expression = rule.concatExpression?.trim() ?? "";
      if (!expression) {
        return "";
      }
      if (/^'?CONCAT=/i.test(expression)) {
        return expression;
      }
      return `CONCAT=${expression}`;
    }
    case "CUSTOM":
      return rule.customInstruction?.trim() ?? "";
    case "EMPTY":
    default:
      return "";
  }
}

function isRuleIncomplete(rule: MappingRuleRow): boolean {
  switch (rule.type) {
    case "COLUMN":
      return !rule.sourceColumn?.trim();
    case "INVARIABLE":
      return !rule.fixedValue?.trim();
    case "MAPPING":
      return !rule.sourceColumn?.trim() || !rule.mappingSheet?.trim();
    case "NS":
      return !rule.sequencePattern?.trim();
    case "CONCAT":
      return !rule.concatExpression?.trim();
    case "CUSTOM":
      return !rule.customInstruction?.trim();
    case "EMPTY":
    default:
      return false;
  }
}

function InfoIcon({ title }: { title: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 transition-colors hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
      title={title}
      aria-label={title}
    >
      i
    </span>
  );
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

    // Ignore any rule that targets or references the special Template column "CIBLECOLUMN"
    const targetLower = target.toLowerCase();
    const instructionLower = instruction.toLowerCase();
    if (targetLower === "ciblecolumn" || instructionLower.includes("ciblecolumn")) {
      return acc;
    }

    const parsed = parseInstruction(instruction);

    acc.push({
      id: createId(),
      target,
      ...parsed,
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
        rule: buildInstruction(rule),
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
  const [templateColumns, setTemplateColumns] = useState<string[]>([]);

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
  const hasInvalidDetails = useMemo(() => rules.some((rule) => isRuleIncomplete(rule)), [rules]);

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
    setTemplateColumns([]);
  }

  function updateRule(id: string, updates: Partial<MappingRuleRow>) {
    setRules((previous) =>
      previous.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)),
    );
    markRulesEdited();
  }

  function changeRuleType(id: string, type: MappingRuleType) {
    setRules((previous) =>
      previous.map((rule) => (rule.id === id ? { ...rule, ...createRuleConfig(type) } : rule)),
    );
    markRulesEdited();
  }

  function renderRuleFields(rule: MappingRuleRow) {
    switch (rule.type) {
      case "COLUMN":
        return (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.column.sourceLabel}
            </label>
            {templateColumns.length > 0 ? (
              <select
                value={rule.sourceColumn ?? ""}
                onChange={(event) => updateRule(rule.id, { sourceColumn: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">{mapping.rules.fields.column.sourcePlaceholder}</option>
                {templateColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={rule.sourceColumn ?? ""}
                onChange={(event) => updateRule(rule.id, { sourceColumn: event.target.value })}
                placeholder={mapping.rules.fields.column.sourcePlaceholder}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.column.helper}
            </p>
          </div>
        );
      case "INVARIABLE":
        return (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.invariable.valueLabel}
            </label>
            <input
              value={rule.fixedValue ?? ""}
              onChange={(event) => updateRule(rule.id, { fixedValue: event.target.value })}
              placeholder={mapping.rules.fields.invariable.valuePlaceholder}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.invariable.helper}
            </p>
          </div>
        );
      case "MAPPING":
        return (
          <div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {mapping.rules.fields.mapping.sourceLabel}
                </label>
                <input
                  value={rule.sourceColumn ?? ""}
                  onChange={(event) => updateRule(rule.id, { sourceColumn: event.target.value })}
                  placeholder={mapping.rules.fields.mapping.sourcePlaceholder}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {mapping.rules.fields.mapping.sheetLabel}
                </label>
                <input
                  value={rule.mappingSheet ?? ""}
                  onChange={(event) => updateRule(rule.id, { mappingSheet: event.target.value })}
                  placeholder={mapping.rules.fields.mapping.sheetPlaceholder}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.mapping.helper}
            </p>
          </div>
        );
      case "NS":
        return (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.ns.patternLabel}
            </label>
            <input
              value={rule.sequencePattern ?? ""}
              onChange={(event) => updateRule(rule.id, { sequencePattern: event.target.value })}
              placeholder={mapping.rules.fields.ns.patternPlaceholder}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.ns.helper}
            </p>
          </div>
        );
      case "CONCAT":
        return (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.concat.expressionLabel}
            </label>
            <textarea
              value={rule.concatExpression ?? ""}
              onChange={(event) => updateRule(rule.id, { concatExpression: event.target.value })}
              placeholder={mapping.rules.fields.concat.expressionPlaceholder}
              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.concat.helper}
            </p>
          </div>
        );
      case "CUSTOM":
        return (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.custom.instructionLabel}
            </label>
            <textarea
              value={rule.customInstruction ?? ""}
              onChange={(event) => updateRule(rule.id, { customInstruction: event.target.value })}
              placeholder={mapping.rules.fields.custom.instructionPlaceholder}
              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mapping.rules.fields.custom.helper}
            </p>
          </div>
        );
      case "EMPTY":
      default:
        return (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {mapping.rules.fields.empty.helper}
          </p>
        );
    }
  }

  function addRule() {
    setRules((previous) => [...previous, createRuleRow()]);
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
      const templateSheet = workbook.Sheets["Template"];
      const cols = extractTemplateFields(templateSheet);
      setTemplateColumns(cols);

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
  const canLaunch = Boolean(file) && !isProcessing && !hasMissingTarget && !hasInvalidDetails;

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
                          const missingDetails = isRuleIncomplete(rule);
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
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {mapping.rules.typeLabel}
                                      </label>
                                      <InfoIcon title={mapping.rules.typeHelper} />
                                    </div>
                                    <select
                                      value={rule.type}
                                      onChange={(event) =>
                                        changeRuleType(rule.id, event.target.value as MappingRuleType)
                                      }
                                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    >
                                      <option value="COLUMN">{mapping.rules.typeOptions.column}</option>
                                      <option value="MAPPING">{mapping.rules.typeOptions.mapping}</option>
                                      <option value="INVARIABLE">{mapping.rules.typeOptions.invariable}</option>
                                      <option value="NS">{mapping.rules.typeOptions.ns}</option>
                                      <option value="CONCAT">{mapping.rules.typeOptions.concat}</option>
                                      <option value="CUSTOM">{mapping.rules.typeOptions.custom}</option>
                                      <option value="EMPTY">{mapping.rules.typeOptions.empty}</option>
                                    </select>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                      {mapping.rules.typeDescriptions[rule.type]}
                                    </p>
                                  </div>
                                  <details className="mt-3" open={false}>
                                    <summary className="cursor-pointer text-sm font-semibold">
                                      {(mapping.rules as any).sections?.detailsTitle ?? "Rule details"}
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                      {renderRuleFields(rule)}
                                      {missingDetails ? (
                                        <p className="text-xs text-red-600 dark:text-red-400">
                                          {mapping.rules.detailError}
                                        </p>
                                      ) : null}
                                      <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {mapping.rules.examples[rule.type]}
                                      </p>
                                    </div>
                                  </details>
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
              {hasInvalidDetails ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {mapping.rules.detailWarning}
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
