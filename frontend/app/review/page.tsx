"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { useLanguage } from "../../components/language-provider";
import type { Translation } from "../../components/language-provider";

const truthyValues = new Set(["true", "1", "yes", "oui", "y", "x"]);

type AllowedType = "list" | "instruction";
type AllowedInstructionMode = "sheet" | "custom";
type AllowedMode = "any" | "list" | "sheet";

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

type RuleRow = {
  id: string;
  field: string;
  checked: boolean;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  allowedMode: AllowedMode;
  allowedType: AllowedType;
  allowedValues: string[];
  allowedInstruction: string;
  allowedInstructionMode: AllowedInstructionMode;
  allowedSheet?: string;
  allowedColumn?: string;
  pattern?: string;
  customRule?: string;
};

type RulePayload = {
  field: string;
  checked: boolean;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  allowedType: AllowedType;
  allowedValues: string[];
  allowedInstruction: string;
  allowedInstructionMode: "sheet" | "custom";
  allowedSheet?: string;
  allowedColumn?: string;
  pattern: string;
  customRule: string;
};

 type StatusState =
   | { type: "default" }
   | { type: "awaiting" }
   | { type: "newRule" }
   | { type: "rulesUpdated" }
   | { type: "analyzing"; filename: string }
   | { type: "analyzed" }
   | { type: "importedTemplate" }
   | { type: "importedNoHeaders" }
   | { type: "readError" }
   | { type: "validating" }
   | { type: "validationError"; message: string }
   | { type: "validationFailed" }
   | { type: "validationSuccess" }
   | { type: "networkError" }
   | { type: "custom"; message: string };
 
 async function readErrorMessage(response: Response): Promise<string | null> {
   const contentType = response.headers.get("content-type") ?? "";
   if (contentType.includes("application/json")) {
     try {
       const data = await response.clone().json();
       const message = typeof data?.message === "string" ? data.message.trim() : "";
       if (message.length > 0) {
         return message;
       }
     } catch {
       // ignore JSON parsing errors, we will fallback to text
     }
   }
 
   try {
     const text = await response.text();
     const trimmed = text.trim();
     return trimmed.length > 0 ? trimmed : null;
   } catch {
     return null;
   }
 }
 
 function resolveStatusMessage(
  status: StatusState,
  statuses: Translation["statuses"],
): string {
  switch (status.type) {
    case "default":
      return statuses.default;
    case "awaiting":
      return statuses.awaiting;
    case "newRule":
      return statuses.newRule;
    case "rulesUpdated":
      return statuses.rulesUpdated;
    case "analyzing":
      return statuses.analyzing(status.filename);
    case "analyzed":
      return statuses.analyzed;
    case "importedTemplate":
      return statuses.importedTemplate;
    case "importedNoHeaders":
      return statuses.importedNoHeaders;
    case "readError":
      return statuses.readError;
    case "validating":
      return statuses.validating;
    case "validationError":
      return statuses.validationError(status.message);
    case "validationFailed":
      return statuses.validationFailed;
    case "validationSuccess":
      return statuses.validationSuccess;
    case "networkError":
      return statuses.networkError;
    case "custom":
      return status.message;
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return false;
  return truthyValues.has(String(value).trim().toLowerCase());
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapRowsToRules(jsonRows: Record<string, unknown>[]): RuleRow[] {
  return jsonRows.reduce<RuleRow[]>((acc, row) => {
    const fieldValue = row["Field"];
    const field = typeof fieldValue === "string" ? fieldValue.trim() : String(fieldValue ?? "").trim();
    if (!field) {
      return acc;
    }

    const allowedValue = row["AllowedValues"];
    const allowedRaw = typeof allowedValue === "string" ? allowedValue.trim() : "";
    let allowedValues: string[] = [];
    let allowedInstruction = "";
    let allowedInstructionMode: AllowedInstructionMode = "custom";
    let allowedSheet: string | undefined = undefined;
    let allowedColumn: string | undefined = undefined;
    let allowedMode: AllowedMode = "any";
    if (allowedRaw) {
      const upper = allowedRaw.toUpperCase();
      if (upper.startsWith("VALUE=")) {
        allowedValues = allowedRaw
          .slice(6)
          .split(";")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
        allowedMode = "list";
      } else if (upper.startsWith("SHEET=")) {
        allowedInstructionMode = "sheet";
        const sheetPart = allowedRaw.slice(6).trim();
        if (sheetPart.includes("!")) {
          const [sName, cName] = sheetPart.split("!", 2);
          allowedSheet = (sName || "").trim() || undefined;
          allowedColumn = (cName || "").trim() || undefined;
        } else {
          const parts = sheetPart.split(";").map((p) => p.trim()).filter(Boolean);
          allowedSheet = (parts[0] || "").trim() || undefined;
          for (const token of parts.slice(1)) {
            if (token.toUpperCase().startsWith("COLUMN=") || token.toUpperCase().startsWith("COL=")) {
              allowedColumn = token.split("=", 1)[1].trim() || undefined;
            }
          }
        }
        allowedMode = "sheet";
      } else {
        allowedInstructionMode = "custom";
        allowedInstruction = allowedRaw;
        allowedMode = "any";
      }
    }

    const allowedType: AllowedType = allowedMode === "list" ? "list" : "instruction";

    const pattern = row["Pattern"] ? String(row["Pattern"]).trim() : "";
    const customRule = row["CustomRule"] ? String(row["CustomRule"]).trim() : "";

    acc.push({
      id: createId(),
      field,
      checked: toBoolean(row["Checked"]),
      required: toBoolean(row["Required"]),
      minLength: toNumber(row["MinLength"]),
      maxLength: toNumber(row["MaxLength"]),
      allowedMode,
      allowedType,
      allowedValues,
      allowedInstruction: allowedType === "instruction" ? allowedInstruction : "",
      allowedInstructionMode,
      allowedSheet,
      allowedColumn,
      pattern: pattern || undefined,
      customRule: customRule || undefined,
    });

    return acc;
  }, []);
}

function serializeRulesForBackend(rules: RuleRow[]): RulePayload[] {
  return rules
    .map<RulePayload | null>((rule) => {
      const field = rule.field.trim();
      if (!field) {
        return null;
      }
      const allowedValues =
        rule.allowedType === "list"
          ? rule.allowedValues.map((value) => value.trim()).filter((value) => value.length > 0)
          : [];

      const allowedType: AllowedType = rule.allowedType;
      const allowedInstructionMode: AllowedInstructionMode = rule.allowedType === "instruction" ? rule.allowedInstructionMode : "custom";
      const allowedInstruction: string =
        rule.allowedType === "instruction" && (rule.allowedInstructionMode ?? "custom") === "custom"
          ? rule.allowedInstruction.trim()
          : "";
      const allowedSheet: string | undefined =
        rule.allowedType === "instruction" && (rule.allowedInstructionMode ?? "custom") === "sheet"
          ? (rule.allowedSheet?.trim() || undefined)
          : undefined;
      const allowedColumn: string | undefined =
        rule.allowedType === "instruction" && (rule.allowedInstructionMode ?? "custom") === "sheet"
          ? (rule.allowedColumn?.trim() || undefined)
          : undefined;

      return {
        field,
        checked: rule.checked,
        required: rule.required,
        minLength: rule.minLength ?? null,
        maxLength: rule.maxLength ?? null,
        allowedType,
        allowedValues,
        allowedInstruction,
        allowedInstructionMode,
        allowedSheet,
        allowedColumn,
        pattern: rule.pattern?.trim() ?? "",
        customRule: rule.customRule?.trim() ?? "",
      } as RulePayload;
    })
    .filter((value): value is RulePayload => value !== null);
}

function createRuleFromField(field: string): RuleRow {
  return {
    id: createId(),
    field,
    checked: true,
    required: false,
    minLength: undefined,
    maxLength: undefined,
    allowedMode: "any",
    allowedType: "instruction",
    allowedValues: [],
    allowedInstruction: "",
    allowedInstructionMode: "custom",
    allowedSheet: undefined,
    allowedColumn: undefined,
    pattern: undefined,
    customRule: undefined,
  };
}

function createEmptyRule(): RuleRow {
  return createRuleFromField("");
}

function extractTemplateFields(sheet?: XLSX.WorkSheet): string[] {
  if (!sheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  if (rows.length === 0) {
    return [];
  }

  const headerRow =
    rows.find((row) =>
      row.some((cell) => {
        if (cell === undefined || cell === null) {
          return false;
        }
        return String(cell).trim().length > 0;
      }),
    ) ?? [];

  return headerRow
    .map((cell) => (cell === undefined || cell === null ? "" : String(cell).trim()))
    .filter((value) => value.length > 0);
}

export default function HomePage() {
  const { content } = useLanguage();
  const { hero, rules: rulesText, footer, statuses, common } = content;

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "default" });
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rulesEdited, setRulesEdited] = useState<boolean>(false);
  const [rulesOpen, setRulesOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [sheetColumns, setSheetColumns] = useState<Record<string, string[]>>({});

  const statusMessage = resolveStatusMessage(status, statuses);

  const hasMissingField = useMemo(() => rules.some((rule) => !rule.field.trim()), [rules]);
  const hasDetailIssue = useMemo(
    () =>
      rules.some((rule) => {
        if (rule.allowedType !== "instruction") return false;
        const mode = rule.allowedInstructionMode ?? "custom";
        if (mode === "sheet") {
          return !((rule.allowedSheet && rule.allowedSheet.trim()) && (rule.allowedColumn && rule.allowedColumn.trim()));
        }
        return !rule.allowedInstruction.trim();
      }),
    [rules],
  );

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  function markRulesEdited(nextStatus: StatusState = { type: "awaiting" }) {
    setRulesEdited(true);
    setRulesOpen(true);
    if (!isSubmitting) {
      setStatus(nextStatus);
    }
  }

  function resetSelection(nextStatus: StatusState = { type: "default" }) {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFile(null);
    setRules([]);
    setRulesEdited(false);
    setRulesOpen(false);
    setReportUrl(null);
    setStatus(nextStatus);
  }

  function updateRule(id: string, updates: Partial<RuleRow>) {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== id) return rule;
        const next: RuleRow = { ...rule, ...updates };
        if (updates.allowedMode) {
          if (updates.allowedMode === "any") {
            next.allowedValues = [];
            next.allowedSheet = undefined;
            next.allowedColumn = undefined;
            next.allowedType = "instruction";
            next.allowedInstructionMode = "custom";
            next.allowedInstruction = "";
          } else if (updates.allowedMode === "list") {
            next.allowedValues = [];
            next.allowedSheet = undefined;
            next.allowedColumn = undefined;
            next.allowedType = "list";
            next.allowedInstructionMode = "custom";
            next.allowedInstruction = "";
          } else if (updates.allowedMode === "sheet") {
            next.allowedValues = [];
            next.allowedSheet = undefined;
            next.allowedColumn = undefined;
            next.allowedType = "instruction";
            next.allowedInstructionMode = "sheet";
            next.allowedInstruction = "";
          }
        }
        if (updates.allowedType) {
          if (updates.allowedType === "list") {
            next.allowedInstruction = "";
            next.allowedInstructionMode = "custom";
            next.allowedSheet = undefined;
            next.allowedColumn = undefined;
          } else {
            next.allowedValues = [];
          }
        }
        if (updates.allowedInstructionMode) {
          if (updates.allowedInstructionMode === "sheet") {
            next.allowedInstruction = "";
          } else {
            next.allowedSheet = undefined;
            next.allowedColumn = undefined;
          }
        }
        return next;
      }),
    );
    markRulesEdited();
  }

  function addRule() {
    setRules((prev) => [...prev, createEmptyRule()]);
    markRulesEdited({ type: "newRule" });
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    markRulesEdited({ type: "rulesUpdated" });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    if (!selected) {
      resetSelection();
      return;
    }

    setReportUrl(null);
    setRules([]);
    setRulesEdited(false);
    setFile(selected);
    setStatus({ type: "analyzing", filename: selected.name });

    try {
      const data = await selected.arrayBuffer();
      const workbook = XLSX.read(data);
      const validationSheet = workbook.Sheets["ValidationRules"];
      const templateSheet = workbook.Sheets["Template"];

      if (Array.isArray((workbook as any).SheetNames)) {
        setAvailableSheets((workbook as any).SheetNames as string[]);
      } else {
        setAvailableSheets([]);
      }

      // Build map of columns for each sheet
      try {
        const names = (workbook as any).SheetNames as string[];
        const columns: Record<string, string[]> = {};
        for (const name of names) {
          const ws: XLSX.WorkSheet | undefined = (workbook.Sheets as any)[name];
          if (!ws) continue;
          const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
          if (rows.length === 0) continue;
          const headerRow =
            rows.find((row) => row.some((cell) => (cell === undefined || cell === null ? false : String(cell).trim().length > 0))) ?? [];
          const headers = headerRow
            .map((cell) => (cell === undefined || cell === null ? "" : String(cell).trim()))
            .filter((v) => v.length > 0);
          if (headers.length > 0) {
            columns[name] = headers;
          }
        }
        setSheetColumns(columns);
      } catch {
        setSheetColumns({});
      }

      const mappedRules = validationSheet
        ? mapRowsToRules(
            XLSX.utils.sheet_to_json<Record<string, unknown>>(validationSheet, {
              defval: "",
              blankrows: false,
            }),
          )
        : [];

      if (mappedRules.length > 0) {
        setRules(mappedRules);
        setRulesEdited(false);
        setStatus({ type: "analyzed" });
        return;
      }

      const templateFields = extractTemplateFields(templateSheet);
      if (templateFields.length > 0) {
        const generatedRules = templateFields.map((field) => createRuleFromField(field));
        setRules(generatedRules);
        setRulesEdited(true);
        setStatus({ type: "importedTemplate" });
        return;
      }

      setRules([]);
      setRulesEdited(false);
      setStatus({ type: "importedNoHeaders" });
    } catch (error) {
      console.error(error);
      setStatus({ type: "readError" });
    }
  }

  async function launchValidation() {
    if (!file) return;
    setIsSubmitting(true);
    setStatus({ type: "validating" });
    setReportUrl(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      if (rulesEdited) {
        const payload = serializeRulesForBackend(rules);
        formData.set("rules", JSON.stringify(payload));
      }

      const response = await fetch("/api/validate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        setStatus(
          message
            ? { type: "validationError", message }
            : { type: "validationFailed" },
        );
        return;
      }

      const payload: {
        success: boolean;
        message?: string;
        downloadUrl?: string;
      } = await response.json();

      if (!payload.success) {
        setStatus(
          payload.message
            ? { type: "custom", message: payload.message }
            : { type: "validationFailed" },
        );
        return;
      }

      setStatus(
        payload.message
          ? { type: "custom", message: payload.message }
          : { type: "validationSuccess" },
      );
      if (payload.downloadUrl) {
        setReportUrl(payload.downloadUrl);
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: "networkError" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isErrorStatus = (status.type === "validationError" || status.type === "validationFailed" || status.type === "networkError" || status.type === "readError");

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
                {hero.badge}
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{hero.title}</h1>
              <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">{hero.description}</p>
            </header>

            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
              {file ? (
                <div className="space-y-2">
                  <p className="text-base font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatFileSize(file.size)} - {file.type || hero.unknownType}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-base font-medium text-slate-800 dark:text-slate-100">{hero.uploadLabel}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{hero.uploadHint}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openFileDialog}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:ring-offset-slate-900"
                >
                  {file ? hero.changeButton : hero.selectButton}
                </button>
                {file ? (
                  <button
                    type="button"
                    onClick={() => resetSelection()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {footer.removeFile}
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
                    <span>{rulesText.summary(rules.length)}</span>
                    <span className="flex items-center gap-2">
                      {rulesEdited ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-200">
                          {rulesText.editedBadge}
                        </span>
                      ) : null}
                      <span aria-hidden className="text-base transition-transform duration-200 group-open:rotate-180">
                        ▾
                      </span>
                    </span>
                  </summary>

                  <div className="mt-6 space-y-6">
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
                      <p className="font-medium">{rulesText.description}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rulesText.helper}</p>
                    </div>

                    {rules.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <p>{rulesText.emptyState.description}</p>
                        <button
                          type="button"
                          onClick={addRule}
                          className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                        >
                          {rulesText.emptyState.action}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {rules.map((rule, index) => {
                          const fieldIsEmpty = rule.field.trim().length === 0;
                          const instructionEmpty =
                            rule.allowedType === "instruction" &&
                            ((rule.allowedInstructionMode ?? "custom") === "sheet"
                              ? !(rule.allowedSheet && rule.allowedSheet.trim())
                              : rule.allowedInstruction.trim().length === 0);

                          return (
                            <div
                              key={rule.id}
                              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                            >
                              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                <div className="flex-1 space-y-5">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {rulesText.ruleLabel(index + 1)}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {rulesText.field.label}
                                    </label>
                                    <input
                                      type="text"
                                      value={rule.field}
                                      onChange={(event) => updateRule(rule.id, { field: event.target.value })}
                                      placeholder={rulesText.field.placeholder}
                                      className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400 ${
                                        fieldIsEmpty
                                          ? "border-red-300 focus:border-red-400 dark:border-red-700"
                                          : "border-slate-200 focus:border-emerald-400"
                                      }`}
                                    />
                                    {fieldIsEmpty ? (
                                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rulesText.field.error}</p>
                                    ) : null}
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                  <details className="mt-4" open={false}><summary className="cursor-pointer text-sm font-semibold">{(rulesText as any).sections?.advancedTitle ?? rulesText.customRule.label}</summary>
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={rule.checked}
                                        onChange={(event) => updateRule(rule.id, { checked: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-400 dark:focus:ring-emerald-400"
                                      />
                                      {rulesText.toggles.checked}
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={rule.required}
                                        onChange={(event) => updateRule(rule.id, { required: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-400 dark:focus:ring-emerald-400"
                                      />
                                      {rulesText.toggles.required}
                                    </label>
                                  </div>

                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {rulesText.length.minLabel}
                                      </label>
                                      <input
                                        type="number"
                                        value={rule.minLength ?? ""}
                                        onChange={(event) =>
                                          updateRule(rule.id, { minLength: parseNumberInput(event.target.value) })
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                                        placeholder={rulesText.length.placeholder}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {rulesText.length.maxLabel}
                                      </label>
                                      <input
                                        type="number"
                                        value={rule.maxLength ?? ""}
                                        onChange={(event) =>
                                          updateRule(rule.id, { maxLength: parseNumberInput(event.target.value) })
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                                        placeholder={rulesText.length.placeholder}
                                      />
                                    </div>
                                  </div>

                                  {null}

                                  <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {rulesText.customRule.label}
                                    </label>
                                    <input
                                      type="text"
                                      value={rule.customRule ?? ""}
                                      onChange={(event) =>
                                        updateRule(rule.id, { customRule: event.target.value || undefined })
                                      }
                                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                                      placeholder={rulesText.customRule.placeholder}
                                    />
                                  </div>
                                  </details>

                                  <details className="mt-4" open={false}><summary className="cursor-pointer text-sm font-semibold">{(rulesText as any).sections?.allowedTitle ?? ((rulesText.allowed as any).valuesLabel ?? "Allowed values")}</summary>
                                  <div className="mt-3 space-y-4">
                                  <div>
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {rulesText.allowed.label}
                                      </label>
                                      <select
                                        value={(rule as any).allowedMode ?? (rule.allowedType === 'list' ? 'list' : (rule.allowedInstructionMode === 'sheet' ? 'sheet' : 'any'))}
                                        onChange={(event) =>
                                          updateRule(rule.id, { allowedMode: event.target.value as any })
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                      >
                                        <option value="any">{(rulesText.allowed as any).options?.any ?? "Toutes valeurs"}</option>
                                        <option value="sheet">{(rulesText.allowed as any).options?.sheet ?? "Feuille"}</option>
                                        <option value="list">{rulesText.allowed.options.list}</option>
                                      </select>
                                    </div>

                                    {(((rule as any).allowedMode ?? (rule.allowedType === 'list' ? 'list' : (rule.allowedInstructionMode === 'sheet' ? 'sheet' : 'any'))) === "list") ? (
                                      <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                          {rulesText.allowed.valuesLabel}
                                        </label>
                                        <textarea
                                          value={rule.allowedValues.join("\n")}
                                          onChange={(event) =>
                                            updateRule(rule.id, {
                                              allowedValues: event.target.value
                                                .split(/\r?\n/)
                                                .map((value) => value.trim())
                                                .filter((value) => value.length > 0),
                                            })
                                          }
                                          className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                                          placeholder={rulesText.allowed.valuesPlaceholder}
                                        />
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rulesText.allowed.valuesHint}</p>
                                        {rule.allowedValues.length > 0 ? (
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {rule.allowedValues.map((value) => (
                                              <span
                                                key={`${rule.id}-${value}`}
                                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                              >
                                                {value}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="hidden">
                                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            {(rulesText.allowed as any).modeLabel ?? "Mode"}
                                          </label>
                                          <select
                                            value={rule.allowedInstructionMode}
                                            onChange={(event) =>
                                              updateRule(rule.id, { allowedInstructionMode: event.target.value as any })
                                            }
                                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                          >
                                            <option value="sheet">{(rulesText.allowed as any).modeOptions?.sheet ?? "Feuille"}</option>
                                            <option value="custom">{(rulesText.allowed as any).modeOptions?.custom ?? "Personnalisée"}</option>
                                          </select>
                                        </div>

                                        {rule.allowedInstructionMode === "sheet" ? (
                                          <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                              {(rulesText.allowed as any).sheetLabel ?? "Nom de la feuille"}
                                            </label>
                                            <select
                                              value={rule.allowedSheet ?? ""}
                                              onChange={(event) =>
                                                updateRule(rule.id, { allowedSheet: event.target.value || undefined })
                                              }
                                              className={`mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100`}
                                            >
                                              <option value="" disabled>
                                                {(rulesText.allowed as any).sheetPlaceholder ?? "Ex: AnnuaireCodes"}
                                              </option>
                                              {(() => {
                                                const options = (rule.allowedSheet && !availableSheets.includes(rule.allowedSheet))
                                                  ? [rule.allowedSheet, ...availableSheets]
                                                  : availableSheets;
                                                return options.map((name) => (
                                                  <option key={`${rule.id}-sheet-${name}`} value={name}>
                                                    {name}
                                                  </option>
                                                ));
                                              })()}
                                            </select>
                                            <div className="mt-3">
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                {(rulesText.allowed as any).columnLabel ?? "Colonne de la feuille"}
                                              </label>
                                              <select
                                                value={rule.allowedColumn ?? ""}
                                                onChange={(event) => updateRule(rule.id, { allowedColumn: event.target.value || undefined })}
                                                className={`mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100`}
                                              >
                                                <option value="" disabled>
                                                  {(rulesText.allowed as any).columnPlaceholder ?? "Ex: Code"}
                                                </option>
                                                {(() => {
                                                  const cols = rule.allowedSheet ? (sheetColumns[rule.allowedSheet] || []) : [];
                                                  const options = (rule.allowedColumn && !cols.includes(rule.allowedColumn)) ? [rule.allowedColumn, ...cols] : cols;
                                                  return options.map((name) => (
                                                    <option key={`${rule.id}-col-${name}`} value={name}>
                                                      {name}
                                                    </option>
                                                  ));
                                                })()}
                                              </select>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{(rulesText.allowed as any).sheetHint ?? "Indiquez le nom exact de la feuille de référence."}</p>
                                          </div>
                                        ) : (
                                          <div className="hidden">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                              {rulesText.allowed.instructionLabel}
                                            </label>
                                            <textarea
                                              value={rule.allowedInstruction}
                                              onChange={(event) => updateRule(rule.id, { allowedInstruction: event.target.value })}
                                              className={`mt-2 h-28 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400 ${
                                                instructionEmpty
                                                  ? "border-red-300 focus:border-red-400 dark:border-red-700"
                                                  : "border-slate-200 focus:border-emerald-400"
                                              }`}
                                              placeholder={rulesText.allowed.instructionPlaceholder}
                                            />
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rulesText.allowed.instructionHint}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  </details>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeRule(rule.id)}
                                  className="inline-flex items-center justify-center rounded-full border border-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 shadow-sm transition hover:bg-rose-50 dark:border-rose-400 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                >
                                  {rulesText.removeButton}
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
                            {rulesText.addButton}
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
                  isErrorStatus
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/40 dark:text-red-200"
                    : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                {statusMessage}
              </p>
              {hasMissingField ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{rulesText.launchWarning}</p>
              ) : null}
              {hasDetailIssue ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{rulesText.detailWarning}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{rulesText.tipTitle}</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {rulesText.tips.map((tip) => (
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
            onClick={launchValidation}
            disabled={!file || isSubmitting || hasMissingField}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white/90"
          >
            {isSubmitting ? footer.validating : footer.startValidation}
          </button>

          {reportUrl ? (
            <a
              href={reportUrl}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
            >
              {footer.downloadReport}
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












