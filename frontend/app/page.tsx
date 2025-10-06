"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

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

function createEmptyRule(): RuleRow {
  return {
    id: createId(),
    field: "",
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

export default function HomePage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>(
    "Aucun fichier importé. Déposez un template Excel ou créez vos règles manuellement.",
  );
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rulesEdited, setRulesEdited] = useState<boolean>(false);

  const hasMissingField = useMemo(() => rules.some((rule) => !rule.field.trim()), [rules]);

  function markRulesEdited(message?: string) {
    setRulesEdited(true);
    if (!isSubmitting) {
      setStatus(message ?? "Règles personnalisées en attente de validation.");
    }
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
    markRulesEdited("Nouvelle règle ajoutée. Complétez-la avant la validation.");
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    markRulesEdited("Règles mises à jour.");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setReportUrl(null);
    setRules([]);
    setRulesEdited(false);

    if (!selected) {
      setFile(null);
      setStatus("Aucun fichier importé. Déposez un template Excel ou créez vos règles manuellement.");
      return;
    }

    setFile(selected);
    setStatus(`Analyse de ${selected.name}…`);

    try {
      const data = await selected.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets["ValidationRules"];
      if (!sheet) {
        setStatus(
          "La feuille 'ValidationRules' est introuvable. Ajoutez vos règles ci-dessous avant de lancer la validation.",
        );
        return;
      }

      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        blankrows: false,
      });

      const mappedRules = mapRowsToRules(jsonRows);

      setRules(mappedRules);
      setRulesEdited(false);
      setStatus("Fichier analysé. Modifiez les règles si nécessaire avant validation.");
    } catch (error) {
      console.error(error);
      setStatus("Erreur lors de la lecture du fichier. Vérifiez le format Excel.");
    }
  }

  async function launchValidation() {
    if (!file) return;
    setIsSubmitting(true);
    setStatus("Validation en cours…");
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
        const message = await response.text();
        setStatus(`Erreur validation: ${message}`);
        return;
      }

      const payload: {
        success: boolean;
        message?: string;
        downloadUrl?: string;
      } = await response.json();

      if (!payload.success) {
        setStatus(payload.message ?? "La validation a échoué.");
        return;
      }

      setStatus(payload.message ?? "Validation terminée.");
      if (payload.downloadUrl) {
        setReportUrl(payload.downloadUrl);
      }
    } catch (error) {
      console.error(error);
      setStatus("Erreur réseau: impossible de contacter le service de validation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-2xl font-semibold text-slate-900">Validation DMF</h1>
          <p className="mt-2 text-sm text-slate-600">
            Déposez votre template Excel pour visualiser les règles, personnalisez-les dans l'application puis lancez la
            validation Python.
          </p>
          <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-indigo-400">
            <span className="text-base font-medium text-slate-700">Déposer un fichier Excel</span>
            <span className="text-sm text-slate-500">Feuilles attendues: Template &amp; ValidationRules</span>
            <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFileChange} />
          </label>
        </header>

        <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Règles détectées</h2>
              <p className="text-sm text-slate-500">
                Interprétation lisible de la feuille ValidationRules et édition directement dans l'interface.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {rules.length} règle{rules.length > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={addRule}
                className="inline-flex items-center rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
              >
                Ajouter une règle
              </button>
            </div>
          </header>

          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            <p className="font-medium">Astuce d'utilisation</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Activez ou désactivez les contrôles comme dans la feuille Excel.</li>
              <li>Basculer sur « Instruction » permet de référencer une feuille annexe avec SHEET=NomFeuille.</li>
              <li>Ajoutez autant de valeurs autorisées que nécessaire en saisissant une valeur par ligne.</li>
            </ul>
          </div>

          {rules.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              <p>
                Aucune règle à afficher pour l'instant. Importez un fichier ou créez votre première règle pour démarrer la
                configuration.
              </p>
              <button
                type="button"
                onClick={addRule}
                className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Créer une première règle
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {rules.map((rule) => {
                const fieldIsEmpty = rule.field.trim().length === 0;
                return (
                  <div key={rule.id} className="rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 p-5 md:flex-row md:items-end">
                      <div className="flex-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Champ</label>
                        <input
                          type="text"
                          value={rule.field}
                          onChange={(event) => updateRule(rule.id, { field: event.target.value })}
                          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${fieldIsEmpty ? "border-rose-400" : "border-slate-200"}`}
                          placeholder="Nom du champ dans la feuille Template"
                        />
                        {fieldIsEmpty && (
                          <p className="mt-1 text-xs text-rose-600">Le nom du champ est requis pour lancer la validation.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Supprimer
                      </button>
                    </div>

                    <div className="grid gap-6 p-5 md:grid-cols-2">
                      <div className="space-y-5">
                        <fieldset className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.checked}
                              onChange={(event) => updateRule(rule.id, { checked: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Checker activé
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.required}
                              onChange={(event) => updateRule(rule.id, { required: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Champ obligatoire
                          </label>
                        </fieldset>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taille min</label>
                            <input
                              type="number"
                              value={rule.minLength ?? ""}
                              onChange={(event) => updateRule(rule.id, { minLength: parseNumberInput(event.target.value) })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="Optionnel"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taille max</label>
                            <input
                              type="number"
                              value={rule.maxLength ?? ""}
                              onChange={(event) => updateRule(rule.id, { maxLength: parseNumberInput(event.target.value) })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="Optionnel"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pattern (RegExp)</label>
                          <input
                            type="text"
                            value={rule.pattern ?? ""}
                            onChange={(event) => updateRule(rule.id, { pattern: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="Ex: ^[0-9]{5}$"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Règle personnalisée</label>
                          <input
                            type="text"
                            value={rule.customRule ?? ""}
                            onChange={(event) => updateRule(rule.id, { customRule: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="Nom de la fonction Python personnalisée"
                          />
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Source des valeurs autorisées
                          </label>
                          <select
                            value={rule.allowedType}
                            onChange={(event) => updateRule(rule.id, { allowedType: event.target.value as AllowedType })}
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          >
                            <option value="list">Liste de valeurs</option>
                            <option value="instruction">Instruction (VALUE=, SHEET=, etc.)</option>
                          </select>
                        </div>

                        {rule.allowedType === "list" ? (
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Valeurs autorisées
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
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="Saisissez une valeur par ligne"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                              Ces valeurs seront converties en instruction VALUE= lors de la validation.
                            </p>
                            {rule.allowedValues.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {rule.allowedValues.map((value) => (
                                  <span
                                    key={`${rule.id}-${value}`}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                                  >
                                    {value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Instruction AllowedValues
                            </label>
                            <textarea
                              value={rule.allowedInstruction}
                              onChange={(event) => updateRule(rule.id, { allowedInstruction: event.target.value })}
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="Ex: SHEET=AnnuaireCodes ou VALUE=A;B;C"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                              Utilisez SHEET=NomFeuille pour charger une feuille annexe ou toute instruction personnalisée.
                            </p>
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

        <footer className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600">{status}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file || isSubmitting || hasMissingField}
              onClick={launchValidation}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Validation…" : "Lancer la validation Python"}
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600"
              >
                Télécharger le rapport
              </a>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
        if (!field) {
          return acc;
        }

        const allowedValue = row["AllowedValues"];
        const allowedRaw = typeof allowedValue === "string" ? allowedValue.trim() : "";
        let allowedValues: string[] | undefined;
        let allowedInstruction: string | undefined;
        if (allowedRaw) {
          allowedInstruction = allowedRaw;
          if (allowedRaw.toUpperCase().startsWith("VALUE=")) {
            allowedValues = allowedRaw
              .slice(6)
              .split(";")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0);
          }
        }

        const rule: RuleRow = {
          field,
          checked: toBoolean(row["Checked"]),
          required: toBoolean(row["Required"]),
          minLength: toNumber(row["MinLength"]),
          maxLength: toNumber(row["MaxLength"]),
          allowedValues,
          allowedInstruction,
          pattern: row["Pattern"] ? String(row["Pattern"]).trim() : undefined,
          customRule: row["CustomRule"] ? String(row["CustomRule"]).trim() : undefined,
        };

        acc.push(rule);
        return acc;
      }, []);


      setRules(mappedRules);
      setStatus("Fichier analysé. Vérifiez les règles avant validation.");
    } catch (error) {
      console.error(error);
      setStatus("Erreur lors de la lecture du fichier. Vérifiez le format Excel.");
    }
  }

  async function launchValidation() {
    if (!file) return;
    setIsSubmitting(true);
    setStatus("Validation en cours…");
    setReportUrl(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/validate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        setStatus(`Erreur validation: ${message}`);
        return;
      }

      const payload: {
        success: boolean;
        message?: string;
        downloadUrl?: string;
      } = await response.json();

      if (!payload.success) {
        setStatus(payload.message ?? "La validation a échoué.");
        return;
      }

      setStatus(payload.message ?? "Validation terminée.");
      if (payload.downloadUrl) {
        setReportUrl(payload.downloadUrl);
      }
    } catch (error) {
      console.error(error);
      setStatus("Erreur réseau: impossible de contacter le service de validation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-2xl font-semibold text-slate-900">Validation DMF</h1>
          <p className="mt-2 text-sm text-slate-600">
            Déposez votre template Excel pour visualiser les règles et lancer la validation Python.
          </p>
          <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-indigo-400">
            <span className="text-base font-medium text-slate-700">Déposer un fichier Excel</span>
            <span className="text-sm text-slate-500">Feuilles attendues: Template &amp; ValidationRules</span>
            <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFileChange} />
          </label>
        </header>

        <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Règles détectées</h2>
              <p className="text-sm text-slate-500">Interprétation lisible de la feuille ValidationRules.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {rules.length} règle{rules.length > 1 ? "s" : ""}
            </span>
          </header>

          {rules.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Chargez un fichier pour afficher le détail des règles.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {rules.map((rule) => (
                <div key={rule.field} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-5">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{rule.field}</h3>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Checker &amp; obligations</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                      <span className={`rounded-full px-3 py-1 ${rule.checked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        Checker: {rule.checked ? "activé" : "désactivé"}
                      </span>
                      <span className={`rounded-full px-3 py-1 ${rule.required ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                        Obligatoire: {rule.required ? "oui" : "non"}
                      </span>
                      {rule.minLength !== undefined && (
                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">
                          Taille min: {rule.minLength}
                        </span>
                      )}
                      {rule.maxLength !== undefined && (
                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">
                          Taille max: {rule.maxLength}
                        </span>
                      )}
                    </div>
                  </div>

                  {rule.allowedValues && rule.allowedValues.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Valeurs autorisées</p>
                      <ul className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                        {rule.allowedValues.map((value) => (
                          <li key={value} className="rounded bg-slate-100 px-2 py-1">
                            {value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rule.allowedInstruction && (!rule.allowedValues || rule.allowedValues.length === 0) && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Valeurs</p>
                      <p className="mt-1 text-sm text-slate-700">{rule.allowedInstruction}</p>
                    </div>
                  )}

                  {(rule.pattern || rule.customRule) && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Autres règles</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {rule.pattern && (
                          <li>
                            Pattern: <code className="rounded bg-slate-100 px-1 py-0.5">{rule.pattern}</code>
                          </li>
                        )}
                        {rule.customRule && <li>Custom: {rule.customRule}</li>}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>

        <footer className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600">{status}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file || isSubmitting}
              onClick={launchValidation}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Validation…" : "Lancer la validation Python"}
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600"
              >
                Télécharger le rapport
              </a>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}