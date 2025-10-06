"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

const truthyValues = new Set(["true", "1", "yes", "oui", "y", "x"]);

type RuleRow = {
  field: string;
  checked: boolean;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
  allowedInstruction?: string;
  pattern?: string;
  customRule?: string;
};

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

export default function HomePage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("Aucun fichier");
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setReportUrl(null);
    setRules([]);

    if (!selected) {
      setFile(null);
      setStatus("Aucun fichier");
      return;
    }

    setFile(selected);
    setStatus(`Analyse de ${selected.name}…`);

    try {
      const data = await selected.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets["ValidationRules"];
      if (!sheet) {
        setStatus("La feuille 'ValidationRules' est introuvable dans ce fichier.");
        return;
      }

      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        blankrows: false,
      });

      const mappedRules = jsonRows.reduce<RuleRow[]>((acc, row) => {
        const fieldValue = row["Field"];
        const field = typeof fieldValue === "string" ? fieldValue.trim() : String(fieldValue ?? "").trim();
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