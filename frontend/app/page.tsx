"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { useLanguage } from "../components/language-provider";
import type { Translation } from "../components/language-provider";

const truthyValues = new Set(["true", "1", "yes", "oui", "y", "x"]);

type AllowedType = "list" | "instruction";

type RuleRow = {
  id: string;
  field: string;
  checked: boolean;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  allowedType: AllowedType;
  allowedValues: string[];
  allowedInstruction: string;
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
    if (allowedRaw) {
      if (allowedRaw.toUpperCase().startsWith("VALUE=")) {
        allowedValues = allowedRaw
          .slice(6)
          .split(";")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      } else {
        allowedInstruction = allowedRaw;
      }
    }

    const allowedType: AllowedType = allowedValues.length > 0 ? "list" : "instruction";

    const pattern = row["Pattern"] ? String(row["Pattern"]).trim() : "";
    const customRule = row["CustomRule"] ? String(row["CustomRule"]).trim() : "";

    acc.push({
      id: createId(),
      field,
      checked: toBoolean(row["Checked"]),
      required: toBoolean(row["Required"]),
      minLength: toNumber(row["MinLength"]),
      maxLength: toNumber(row["MaxLength"]),
      allowedType,
      allowedValues,
      allowedInstruction: allowedType === "instruction" ? allowedInstruction : "",
      pattern: pattern || undefined,
      customRule: customRule || undefined,
    });

    return acc;
  }, []);
}

function serializeRulesForBackend(rules: RuleRow[]): RulePayload[] {
  return rules
    .map((rule) => {
      const field = rule.field.trim();
      if (!field) {
        return null;
      }
      const allowedValues =
        rule.allowedType === "list"
          ? rule.allowedValues.map((value) => value.trim()).filter((value) => value.length > 0)
          : [];

      return {
        field,
        checked: rule.checked,
        required: rule.required,
        minLength: rule.minLength ?? null,
        maxLength: rule.maxLength ?? null,
        allowedType: rule.allowedType,
        allowedValues,
        allowedInstruction: rule.allowedType === "instruction" ? rule.allowedInstruction.trim() : "",
        pattern: rule.pattern?.trim() ?? "",
        customRule: rule.customRule?.trim() ?? "",
      } satisfies RulePayload;
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
    allowedType: "list",
    allowedValues: [],
    allowedInstruction: "",
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
  const { hero, rules: rulesText, footer, statuses } = content;

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "default" });
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rulesEdited, setRulesEdited] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const statusMessage = resolveStatusMessage(status, statuses);

  const hasMissingField = useMemo(() => rules.some((rule) => !rule.field.trim()), [rules]);

  function markRulesEdited(nextStatus: StatusState = { type: "awaiting" }) {
    setRulesEdited(true);
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
    setReportUrl(null);
    setStatus(nextStatus);
  }

  function updateRule(id: string, updates: Partial<RuleRow>) {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== id) return rule;
        const next: RuleRow = { ...rule, ...updates };
        if (updates.allowedType) {
          if (updates.allowedType === "list") {
            next.allowedInstruction = "";
          } else {
            next.allowedValues = [];
          }
        }
        if (next.allowedType === "list" && updates.allowedInstruction !== undefined) {
          next.allowedInstruction = "";
        }
        if (next.allowedType === "instruction" && updates.allowedValues !== undefined) {
          next.allowedValues = [];
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

  return (
    <main className="min-h-screen bg-slate-50 p-6 transition-colors duration-300 dark:bg-slate-950 md:p-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{hero.title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{hero.description}</p>
          <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/40">
            <span className="text-base font-medium text-slate-700 dark:text-slate-200">{hero.uploadLabel}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{hero.uploadHint}</span>
            <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFileChange} ref={fileInputRef} />
          </label>
        </header>

        <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{rulesText.heading}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{rulesText.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {rulesText.countLabel(rules.length)}
              </span>
              <button
                type="button"
                onClick={addRule}
                className="inline-flex items-center rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              >
                {rulesText.addButton}
              </button>
            </div>
          </header>

          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            <p className="font-medium">{rulesText.tipTitle}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {rulesText.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          {rules.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <p>{rulesText.emptyState.description}</p>
              <button
                type="button"
                onClick={addRule}
                className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                {rulesText.emptyState.action}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {rules.map((rule) => {
                const fieldIsEmpty = rule.field.trim().length === 0;
                return (
                  <div key={rule.id} className="rounded-xl border border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-end">
                    <div className="flex-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{rulesText.field.label}</label>
                        <input
                          type="text"
                          value={rule.field}
                          onChange={(event) => updateRule(rule.id, { field: event.target.value })}
                          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400 ${fieldIsEmpty ? "border-rose-400 dark:border-rose-400" : "border-slate-200 dark:border-slate-700"}`}
                          placeholder={rulesText.field.placeholder}
                        />
                        {fieldIsEmpty && (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{rulesText.field.error}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-400/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        {rulesText.removeButton}
                      </button>
                    </div>

                    <div className="grid gap-6 p-5 md:grid-cols-2">
                      <div className="space-y-5">
                        <fieldset className="grid grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-200">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.checked}
                              onChange={(event) => updateRule(rule.id, { checked: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-indigo-400 dark:focus:ring-indigo-400"
                            />
                            {rulesText.toggles.checked}
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.required}
                              onChange={(event) => updateRule(rule.id, { required: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-indigo-400 dark:focus:ring-indigo-400"
                            />
                            {rulesText.toggles.required}
                          </label>
                        </fieldset>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{rulesText.length.minLabel}</label>
                            <input
                              type="number"
                              value={rule.minLength ?? ""}
                              onChange={(event) => updateRule(rule.id, { minLength: parseNumberInput(event.target.value) })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                              placeholder={rulesText.length.placeholder}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{rulesText.length.maxLabel}</label>
                            <input
                              type="number"
                              value={rule.maxLength ?? ""}
                              onChange={(event) => updateRule(rule.id, { maxLength: parseNumberInput(event.target.value) })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                              placeholder={rulesText.length.placeholder}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{rulesText.pattern.label}</label>
                          <input
                            type="text"
                            value={rule.pattern ?? ""}
                            onChange={(event) => updateRule(rule.id, { pattern: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                            placeholder={rulesText.pattern.placeholder}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{rulesText.customRule.label}</label>
                          <input
                            type="text"
                            value={rule.customRule ?? ""}
                            onChange={(event) => updateRule(rule.id, { customRule: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                            placeholder={rulesText.customRule.placeholder}
                          />
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {rulesText.allowed.label}
                          </label>
                          <select
                            value={rule.allowedType}
                            onChange={(event) => updateRule(rule.id, { allowedType: event.target.value as AllowedType })}
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="list">{rulesText.allowed.options.list}</option>
                            <option value="instruction">{rulesText.allowed.options.instruction}</option>
                          </select>
                        </div>

                        {rule.allowedType === "list" ? (
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
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                              placeholder={rulesText.allowed.valuesPlaceholder}
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rulesText.allowed.valuesHint}</p>
                            {rule.allowedValues.length > 0 && (
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
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {rulesText.allowed.instructionLabel}
                            </label>
                            <textarea
                              value={rule.allowedInstruction}
                              onChange={(event) => updateRule(rule.id, { allowedInstruction: event.target.value })}
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-400"
                              placeholder={rulesText.allowed.instructionPlaceholder}
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rulesText.allowed.instructionHint}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <footer className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">{statusMessage}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => resetSelection()}
              disabled={!file || isSubmitting}
              className="rounded-lg border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400 dark:text-rose-300"
            >
              {footer.removeFile}
            </button>
            <button
              type="button"
              disabled={!file || isSubmitting || hasMissingField}
              onClick={launchValidation}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
            >
              {isSubmitting ? footer.validating : footer.startValidation}
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              >
                {footer.downloadReport}
              </a>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}

