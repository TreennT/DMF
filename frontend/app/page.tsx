"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Language = "fr" | "en";
type Theme = "light" | "dark";

type TranslationReplacements = Record<string, string | number>;

const translations = {
  fr: {
    appTitle: "Validation DMF",
    appDescription:
      "Déposez votre template Excel pour visualiser les règles, personnalisez-les dans l'application puis lancez la validation Python.",
    uploadCallToAction: "Déposer un fichier Excel",
    uploadDetails: "Feuilles attendues: Template & ValidationRules",
    detectedRulesTitle: "Règles détectées",
    detectedRulesDescription:
      "Interprétation lisible de la feuille ValidationRules et édition directement dans l'interface.",
    rulesBadge: "{count} règle{plural}",
    addRule: "Ajouter une règle",
    usageTipsTitle: "Astuce d'utilisation",
    usageTipsBullet1: "Activez ou désactivez les contrôles comme dans la feuille Excel.",
    usageTipsBullet2: "Basculer sur « Instruction » permet de référencer une feuille annexe avec SHEET=NomFeuille.",
    usageTipsBullet3: "Ajoutez autant de valeurs autorisées que nécessaire en saisissant une valeur par ligne.",
    noRulesMessage:
      "Aucune règle à afficher pour l'instant. Importez un fichier ou créez votre première règle pour démarrer la configuration.",
    createFirstRule: "Créer une première règle",
    fieldLabel: "Champ",
    fieldPlaceholder: "Nom du champ dans la feuille Template",
    fieldRequired: "Le nom du champ est requis pour lancer la validation.",
    removeRule: "Supprimer la règle",
    toggleChecked: "Activer le contrôle",
    toggleRequired: "Champ requis",
    minLengthLabel: "Taille min",
    maxLengthLabel: "Taille max",
    optionalPlaceholder: "Optionnel",
    patternLabel: "Pattern (RegExp)",
    patternPlaceholder: "Ex: ^[0-9]{5}$",
    customRuleLabel: "Règle personnalisée",
    customRulePlaceholder: "Nom de la fonction Python personnalisée",
    allowedSourceLabel: "Source des valeurs autorisées",
    allowedSourceList: "Liste de valeurs",
    allowedSourceInstruction: "Instruction (VALUE=, SHEET=, etc.)",
    allowedValuesLabel: "Valeurs autorisées",
    allowedValuesPlaceholder: "Saisissez une valeur par ligne",
    allowedValuesHelper: "Ces valeurs seront converties en instruction VALUE= lors de la validation.",
    allowedInstructionLabel: "Instruction AllowedValues",
    allowedInstructionPlaceholder: "Ex: SHEET=AnnuaireCodes ou VALUE=A;B;C",
    allowedInstructionHelper:
      "Utilisez SHEET=NomFeuille pour charger une feuille annexe ou toute instruction personnalisée.",
    statusDefault:
      "Aucun fichier importé. Déposez un template Excel ou créez vos règles manuellement.",
    statusEdited: "Règles personnalisées en attente de validation.",
    statusNewRule: "Nouvelle règle ajoutée. Complétez-la avant la validation.",
    statusRulesUpdated: "Règles mises à jour.",
    statusAnalyzing: "Analyse de {file}…",
    statusAnalyzed: "Fichier analysé. Modifiez les règles si nécessaire avant validation.",
    statusTemplate:
      'Aucune règle trouvée. Les colonnes de la feuille "Template" ont été importées comme base par défaut.',
    statusNoRules:
      'Aucune règle trouvée et aucun en-tête détecté dans la feuille "Template". Ajoutez vos règles manuellement.',
    statusReadError: "Erreur lors de la lecture du fichier. Vérifiez le format Excel.",
    statusValidating: "Validation en cours…",
    statusValidationError: "Erreur validation: {message}",
    statusValidationFailed: "La validation a échoué.",
    statusValidationComplete: "Validation terminée.",
    statusNetworkError: "Erreur réseau: impossible de contacter le service de validation.",
    deleteFile: "Supprimer le fichier",
    launchValidation: "Lancer la validation Python",
    validating: "Validation…",
    downloadReport: "Télécharger le rapport",
    languageLabel: "Langue",
    themeLabel: "Thème",
    lightTheme: "Clair",
    darkTheme: "Sombre",
  },
  en: {
    appTitle: "DMF validation",
    appDescription:
      "Drop your Excel template to inspect the rules, tweak them in the app, then run the Python validation.",
    uploadCallToAction: "Upload an Excel file",
    uploadDetails: "Expected sheets: Template & ValidationRules",
    detectedRulesTitle: "Detected rules",
    detectedRulesDescription:
      "Human-friendly interpretation of the ValidationRules sheet with inline editing capabilities.",
    rulesBadge: "{count} rule{plural}",
    addRule: "Add a rule",
    usageTipsTitle: "Usage tip",
    usageTipsBullet1: "Enable or disable checks just like in the Excel sheet.",
    usageTipsBullet2: "Switching to “Instruction” lets you reference an extra sheet with SHEET=NomFeuille.",
    usageTipsBullet3: "Add as many allowed values as needed by entering one per line.",
    noRulesMessage:
      "No rule to display yet. Import a file or create your first rule to start configuring.",
    createFirstRule: "Create a first rule",
    fieldLabel: "Field",
    fieldPlaceholder: "Field name in the Template sheet",
    fieldRequired: "The field name is required to start the validation.",
    removeRule: "Remove the rule",
    toggleChecked: "Enable validation",
    toggleRequired: "Required field",
    minLengthLabel: "Min length",
    maxLengthLabel: "Max length",
    optionalPlaceholder: "Optional",
    patternLabel: "Pattern (RegExp)",
    patternPlaceholder: "e.g. ^[0-9]{5}$",
    customRuleLabel: "Custom rule",
    customRulePlaceholder: "Name of the custom Python function",
    allowedSourceLabel: "Source of allowed values",
    allowedSourceList: "List of values",
    allowedSourceInstruction: "Instruction (VALUE=, SHEET=, etc.)",
    allowedValuesLabel: "Allowed values",
    allowedValuesPlaceholder: "Enter one value per line",
    allowedValuesHelper: "These values will be converted into a VALUE= instruction during validation.",
    allowedInstructionLabel: "AllowedValues instruction",
    allowedInstructionPlaceholder: "e.g. SHEET=ReferenceCodes or VALUE=A;B;C",
    allowedInstructionHelper:
      "Use SHEET=SheetName to load an extra sheet or any custom instruction.",
    statusDefault:
      "No file imported yet. Drop an Excel template or create your rules manually.",
    statusEdited: "Custom rules pending validation.",
    statusNewRule: "New rule added. Complete it before running the validation.",
    statusRulesUpdated: "Rules updated.",
    statusAnalyzing: "Analysing {file}…",
    statusAnalyzed: "File analysed. Adjust the rules if needed before running the validation.",
    statusTemplate:
      'No rule found. Columns from the "Template" sheet were imported as a default baseline.',
    statusNoRules:
      'No rule found and no header detected in the "Template" sheet. Add your rules manually.',
    statusReadError: "Error while reading the file. Check the Excel format.",
    statusValidating: "Validation in progress…",
    statusValidationError: "Validation error: {message}",
    statusValidationFailed: "Validation failed.",
    statusValidationComplete: "Validation completed.",
    statusNetworkError: "Network error: unable to contact the validation service.",
    deleteFile: "Remove file",
    launchValidation: "Launch Python validation",
    validating: "Validating…",
    downloadReport: "Download report",
    languageLabel: "Language",
    themeLabel: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
  },
} as const;

type TranslationKey = keyof (typeof translations)["fr"];
type StatusKey =
  | "statusDefault"
  | "statusEdited"
  | "statusNewRule"
  | "statusRulesUpdated"
  | "statusAnalyzing"
  | "statusAnalyzed"
  | "statusTemplate"
  | "statusNoRules"
  | "statusReadError"
  | "statusValidating"
  | "statusValidationError"
  | "statusValidationFailed"
  | "statusValidationComplete"
  | "statusNetworkError";

type StatusMessage =
  | { kind: "key"; key: StatusKey; replacements?: TranslationReplacements }
  | { kind: "custom"; text: string };

function translate(language: Language, key: TranslationKey, replacements?: TranslationReplacements): string {
  const template = translations[language][key];
  if (!template) {
    return key;
  }

  if (!replacements) {
    return template;
  }

  return Object.entries(replacements).reduce((acc, [token, value]) => {
    return acc.split(`{${token}}`).join(String(value));
  }, template);
}

function createStatus(key: StatusKey, replacements?: TranslationReplacements): StatusMessage {
  return { kind: "key", key, replacements };
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
  const [language, setLanguage] = useState<Language>("fr");
  const [theme, setTheme] = useState<Theme>("light");
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(createStatus("statusDefault"));
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rulesEdited, setRulesEdited] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasMissingField = useMemo(() => rules.some((rule) => !rule.field.trim()), [rules]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedLanguage = window.localStorage.getItem("dmf-language");
    if (storedLanguage === "fr" || storedLanguage === "en") {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedTheme = window.localStorage.getItem("dmf-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      return;
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dmf-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.lang = language;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dmf-language", language);
    }
  }, [language]);

  const t = useMemo(
    () =>
      (key: TranslationKey, replacements?: TranslationReplacements) =>
        translate(language, key, replacements),
    [language],
  );

  const statusText = statusMessage.kind === "key"
    ? t(statusMessage.key, statusMessage.replacements)
    : statusMessage.text;

  function markRulesEdited(message?: StatusMessage) {
    setRulesEdited(true);
    if (!isSubmitting) {
      setStatusMessage(message ?? createStatus("statusEdited"));
    }
  }

  function resetSelection(message?: StatusMessage) {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFile(null);
    setRules([]);
    setRulesEdited(false);
    setReportUrl(null);
    setStatusMessage(message ?? createStatus("statusDefault"));
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
    markRulesEdited(createStatus("statusNewRule"));
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    markRulesEdited(createStatus("statusRulesUpdated"));
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
    setStatusMessage(createStatus("statusAnalyzing", { file: selected.name }));

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
        setStatusMessage(createStatus("statusAnalyzed"));
        return;
      }

      const templateFields = extractTemplateFields(templateSheet);
      if (templateFields.length > 0) {
        const generatedRules = templateFields.map((field) => createRuleFromField(field));
        setRules(generatedRules);
        setRulesEdited(true);
        setStatusMessage(createStatus("statusTemplate"));
        return;
      }

      setRules([]);
      setRulesEdited(false);
      setStatusMessage(createStatus("statusNoRules"));
    } catch (error) {
      console.error(error);
      setStatusMessage(createStatus("statusReadError"));
    }
  }

  async function launchValidation() {
    if (!file) return;
    setIsSubmitting(true);
    setStatusMessage(createStatus("statusValidating"));
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
        setStatusMessage(createStatus("statusValidationError", { message }));
        return;
      }

      const payload: {
        success: boolean;
        message?: string;
        downloadUrl?: string;
      } = await response.json();

      if (!payload.success) {
        setStatusMessage(
          payload.message ? { kind: "custom", text: payload.message } : createStatus("statusValidationFailed"),
        );
        return;
      }

      setStatusMessage(
        payload.message ? { kind: "custom", text: payload.message } : createStatus("statusValidationComplete"),
      );
      if (payload.downloadUrl) {
        setReportUrl(payload.downloadUrl);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage(createStatus("statusNetworkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const ruleBadge = t("rulesBadge", {
    count: String(rules.length),
    plural: rules.length > 1 ? "s" : "",
  });

  const languageOptions: { code: Language; icon: string; label: string }[] = [
    { code: "fr", icon: "🇫🇷", label: "Français" },
    { code: "en", icon: "🇬🇧", label: "English" },
  ];

  const themeOptions: { value: Theme; icon: string; labelKey: "lightTheme" | "darkTheme" }[] = [
    { value: "light", icon: "☀️", labelKey: "lightTheme" },
    { value: "dark", icon: "🌙", labelKey: "darkTheme" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6 transition-colors duration-300 dark:bg-slate-900 md:p-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col items-stretch gap-3 self-end sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("languageLabel")}
            </span>
            <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {languageOptions.map((option) => {
                const isActive = option.code === language;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setLanguage(option.code)}
                    aria-pressed={isActive}
                    aria-label={option.label}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span aria-hidden="true">{option.icon}</span>
                    <span>{option.code.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("themeLabel")}
            </span>
            <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {themeOptions.map((option) => {
                const isActive = option.value === theme;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={isActive}
                    aria-label={t(option.labelKey)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span aria-hidden="true">{option.icon}</span>
                    <span>{t(option.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition dark:bg-slate-950 dark:ring-slate-800">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("appTitle")}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t("appDescription")}</p>
          <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-indigo-400 dark:border-slate-700 dark:hover:border-indigo-400">
            <span className="text-base font-medium text-slate-700 dark:text-slate-200">{t("uploadCallToAction")}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{t("uploadDetails")}</span>
            <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFileChange} ref={fileInputRef} />
          </label>
        </header>

        <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition dark:bg-slate-950 dark:ring-slate-800">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("detectedRulesTitle")}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("detectedRulesDescription")}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {ruleBadge}
              </span>
              <button
                type="button"
                onClick={addRule}
                className="inline-flex items-center rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-indigo-500/10"
              >
                {t("addRule")}
              </button>
            </div>
          </header>

          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-100">
            <p className="font-medium">{t("usageTipsTitle")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>{t("usageTipsBullet1")}</li>
              <li>{t("usageTipsBullet2")}</li>
              <li>{t("usageTipsBullet3")}</li>
            </ul>
          </div>

          {rules.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <p>{t("noRulesMessage")}</p>
              <button
                type="button"
                onClick={addRule}
                className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {t("createFirstRule")}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {rules.map((rule) => {
                const fieldIsEmpty = rule.field.trim().length === 0;
                return (
                  <div key={rule.id} className="rounded-xl border border-slate-200 shadow-sm transition dark:border-slate-800">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 p-5 transition dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-end">
                      <div className="flex-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {t("fieldLabel")}
                        </label>
                        <input
                          type="text"
                          value={rule.field}
                          onChange={(event) => updateRule(rule.id, { field: event.target.value })}
                          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-500 ${
                            fieldIsEmpty ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
                          }`}
                          placeholder={t("fieldPlaceholder")}
                        />
                        {fieldIsEmpty && (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{t("fieldRequired")}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        {t("removeRule")}
                      </button>
                    </div>

                    <div className="grid gap-6 p-5 md:grid-cols-2">
                      <div className="space-y-5">
                        <fieldset className="grid grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.checked}
                              onChange={(event) => updateRule(rule.id, { checked: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                            />
                            <span>{t("toggleChecked")}</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.required}
                              onChange={(event) => updateRule(rule.id, { required: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                            />
                            <span>{t("toggleRequired")}</span>
                          </label>
                        </fieldset>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {t("minLengthLabel")}
                            </label>
                            <input
                              type="number"
                              value={rule.minLength ?? ""}
                              onChange={(event) =>
                                updateRule(rule.id, { minLength: parseNumberInput(event.target.value) })
                              }
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                              placeholder={t("optionalPlaceholder")}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {t("maxLengthLabel")}
                            </label>
                            <input
                              type="number"
                              value={rule.maxLength ?? ""}
                              onChange={(event) =>
                                updateRule(rule.id, { maxLength: parseNumberInput(event.target.value) })
                              }
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                              placeholder={t("optionalPlaceholder")}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t("patternLabel")}
                          </label>
                          <input
                            type="text"
                            value={rule.pattern ?? ""}
                            onChange={(event) => updateRule(rule.id, { pattern: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            placeholder={t("patternPlaceholder")}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t("customRuleLabel")}
                          </label>
                          <input
                            type="text"
                            value={rule.customRule ?? ""}
                            onChange={(event) => updateRule(rule.id, { customRule: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            placeholder={t("customRulePlaceholder")}
                          />
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t("allowedSourceLabel")}
                          </label>
                          <select
                            value={rule.allowedType}
                            onChange={(event) => updateRule(rule.id, { allowedType: event.target.value as AllowedType })}
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="list">{t("allowedSourceList")}</option>
                            <option value="instruction">{t("allowedSourceInstruction")}</option>
                          </select>
                        </div>

                        {rule.allowedType === "list" ? (
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {t("allowedValuesLabel")}
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
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                              placeholder={t("allowedValuesPlaceholder")}
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("allowedValuesHelper")}</p>
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
                              {t("allowedInstructionLabel")}
                            </label>
                            <textarea
                              value={rule.allowedInstruction}
                              onChange={(event) => updateRule(rule.id, { allowedInstruction: event.target.value })}
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                              placeholder={t("allowedInstructionPlaceholder")}
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("allowedInstructionHelper")}</p>
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

        <footer className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition dark:bg-slate-950 dark:ring-slate-800 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">{statusText}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => resetSelection()}
              disabled={!file || isSubmitting}
              className="rounded-lg border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              {t("deleteFile")}
            </button>
            <button
              type="button"
              disabled={!file || isSubmitting || hasMissingField}
              onClick={launchValidation}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
            >
              {isSubmitting ? t("validating") : t("launchValidation")}
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-indigo-500/10"
              >
                {t("downloadReport")}
              </a>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
