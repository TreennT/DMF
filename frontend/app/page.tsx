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

type Theme = "light" | "dark";

type Language = "fr" | "en";

type StatusState =
  | { type: "default" }
  | { type: "customPending" }
  | { type: "rulesAdded" }
  | { type: "rulesUpdated" }
  | { type: "analyzingFile"; filename: string }
  | { type: "fileAnalyzed" }
  | { type: "noRulesTemplateImported" }
  | { type: "noRulesNoHeaders" }
  | { type: "readError" }
  | { type: "validating" }
  | { type: "validationError"; message?: string }
  | { type: "validationFailed"; message?: string }
  | { type: "validationSuccess"; message?: string }
  | { type: "networkError" };

type Translation = {
  toggles: {
    language: string;
    theme: string;
  };
  themeToggle: {
    light: string;
    dark: string;
  };
  languageOptions: Record<Language, string>;
  upload: {
    title: string;
    description: string;
    dropLabel: string;
    dropHint: string;
  };
  ruleSummary: {
    title: string;
    subtitle: string;
    addRule: string;
    rulesCount: (count: number) => string;
    tipsTitle: string;
    tips: string[];
  };
  emptyState: {
    description: string;
    action: string;
  };
  ruleCard: {
    fieldLabel: string;
    fieldPlaceholder: string;
    fieldRequiredHint: string;
    removeRule: string;
    activeLabel: string;
    requiredLabel: string;
    minLabel: string;
    maxLabel: string;
    optionalPlaceholder: string;
    patternLabel: string;
    patternPlaceholder: string;
    customRuleLabel: string;
    customRulePlaceholder: string;
    sourceLabel: string;
    sourceOptions: {
      list: string;
      instruction: string;
    };
    valuesLabel: string;
    valuesPlaceholder: string;
    valuesHelp: string;
    instructionLabel: string;
    instructionPlaceholder: string;
    instructionHelp: string;
  };
  footer: {
    removeFile: string;
    launch: string;
    launching: string;
    downloadReport: string;
  };
  statuses: {
    default: string;
    customPending: string;
    rulesAdded: string;
    rulesUpdated: string;
    analyzingFile: (filename: string) => string;
    fileAnalyzed: string;
    noRulesTemplateImported: string;
    noRulesNoHeaders: string;
    readError: string;
    validating: string;
    validationError: (message?: string) => string;
    validationFailed: (message?: string) => string;
    validationSuccess: (message?: string) => string;
    networkError: string;
  };
};

const translations: Record<Language, Translation> = {
  fr: {
    toggles: {
      language: "Langue",
      theme: "Thème",
    },
    themeToggle: {
      light: "Mode clair",
      dark: "Mode sombre",
    },
    languageOptions: {
      fr: "Français",
      en: "Anglais",
    },
    upload: {
      title: "Validation DMF",
      description:
        "Déposez votre template Excel pour visualiser les règles, personnalisez-les dans l'application puis lancez la validation Python.",
      dropLabel: "Déposer un fichier Excel",
      dropHint: "Feuilles attendues : Template & ValidationRules",
    },
    ruleSummary: {
      title: "Règles détectées",
      subtitle: "Interprétation lisible de la feuille ValidationRules et édition directement dans l'interface.",
      addRule: "Ajouter une règle",
      rulesCount: (count: number) => `${count} règle${count > 1 ? "s" : ""}`,
      tipsTitle: "Astuce d'utilisation",
      tips: [
        "Activez ou désactivez les contrôles comme dans la feuille Excel.",
        'Basculer sur « Instruction » permet de référencer une feuille annexe avec SHEET=NomFeuille.',
        "Ajoutez autant de valeurs autorisées que nécessaire en saisissant une valeur par ligne.",
      ],
    },
    emptyState: {
      description:
        "Aucune règle à afficher pour l'instant. Importez un fichier ou créez votre première règle pour démarrer la configuration.",
      action: "Créer une première règle",
    },
    ruleCard: {
      fieldLabel: "Champ",
      fieldPlaceholder: "Nom du champ dans la feuille Template",
      fieldRequiredHint: "Le nom du champ est requis pour lancer la validation.",
      removeRule: "Supprimer la règle",
      activeLabel: "Actif",
      requiredLabel: "Obligatoire",
      minLabel: "Taille min",
      maxLabel: "Taille max",
      optionalPlaceholder: "Optionnel",
      patternLabel: "Pattern (RegExp)",
      patternPlaceholder: "Ex: ^[0-9]{5}$",
      customRuleLabel: "Règle personnalisée",
      customRulePlaceholder: "Nom de la fonction Python personnalisée",
      sourceLabel: "Source des valeurs autorisées",
      sourceOptions: {
        list: "Liste de valeurs",
        instruction: "Instruction (VALUE=, SHEET=, etc.)",
      },
      valuesLabel: "Valeurs autorisées",
      valuesPlaceholder: "Saisissez une valeur par ligne",
      valuesHelp: "Ces valeurs seront converties en instruction VALUE= lors de la validation.",
      instructionLabel: "Instruction AllowedValues",
      instructionPlaceholder: "Ex: SHEET=AnnuaireCodes ou VALUE=A;B;C",
      instructionHelp:
        "Utilisez SHEET=NomFeuille pour charger une feuille annexe ou toute instruction personnalisée.",
    },
    footer: {
      removeFile: "Supprimer le fichier",
      launch: "Lancer la validation Python",
      launching: "Validation…",
      downloadReport: "Télécharger le rapport",
    },
    statuses: {
      default: "Aucun fichier importé. Déposez un template Excel ou créez vos règles manuellement.",
      customPending: "Règles personnalisées en attente de validation.",
      rulesAdded: "Nouvelle règle ajoutée. Complétez-la avant la validation.",
      rulesUpdated: "Règles mises à jour.",
      analyzingFile: (filename: string) => `Analyse de ${filename}…`,
      fileAnalyzed: "Fichier analysé. Modifiez les règles si nécessaire avant validation.",
      noRulesTemplateImported:
        'Aucune règle trouvée. Les colonnes de la feuille "Template" ont été importées comme base par défaut.',
      noRulesNoHeaders:
        'Aucune règle trouvée et aucun en-tête détecté dans la feuille "Template". Ajoutez vos règles manuellement.',
      readError: "Erreur lors de la lecture du fichier. Vérifiez le format Excel.",
      validating: "Validation en cours…",
      validationError: (message?: string) =>
        message ? `Erreur validation: ${message}` : "Erreur validation: réponse inattendue.",
      validationFailed: (message?: string) => message ?? "La validation a échoué.",
      validationSuccess: (message?: string) => message ?? "Validation terminée.",
      networkError: "Erreur réseau: impossible de contacter le service de validation.",
    },
  },
  en: {
    toggles: {
      language: "Language",
      theme: "Theme",
    },
    themeToggle: {
      light: "Light mode",
      dark: "Dark mode",
    },
    languageOptions: {
      fr: "French",
      en: "English",
    },
    upload: {
      title: "DMF Validation",
      description:
        "Drop your Excel template to review the rules, customize them in the app, and launch the Python validation.",
      dropLabel: "Upload an Excel file",
      dropHint: "Expected sheets: Template & ValidationRules",
    },
    ruleSummary: {
      title: "Detected rules",
      subtitle: "Readable interpretation of the ValidationRules sheet with inline editing.",
      addRule: "Add a rule",
      rulesCount: (count: number) => `${count} rule${count === 1 ? "" : "s"}`,
      tipsTitle: "Usage tips",
      tips: [
        "Enable or disable controls just like in the Excel sheet.",
        'Switching to "Instruction" lets you reference an auxiliary sheet with SHEET=SheetName.',
        "Add as many allowed values as needed by entering one value per line.",
      ],
    },
    emptyState: {
      description:
        "No rules to display yet. Import a file or create your first rule to get started.",
      action: "Create the first rule",
    },
    ruleCard: {
      fieldLabel: "Field",
      fieldPlaceholder: "Column name from the Template sheet",
      fieldRequiredHint: "The field name is required before you can run the validation.",
      removeRule: "Delete rule",
      activeLabel: "Active",
      requiredLabel: "Required",
      minLabel: "Min length",
      maxLabel: "Max length",
      optionalPlaceholder: "Optional",
      patternLabel: "Pattern (RegExp)",
      patternPlaceholder: "E.g. ^[0-9]{5}$",
      customRuleLabel: "Custom rule",
      customRulePlaceholder: "Name of the custom Python function",
      sourceLabel: "Source of allowed values",
      sourceOptions: {
        list: "List of values",
        instruction: "Instruction (VALUE=, SHEET=, etc.)",
      },
      valuesLabel: "Allowed values",
      valuesPlaceholder: "Enter one value per line",
      valuesHelp: "These values will be converted into a VALUE= instruction during validation.",
      instructionLabel: "AllowedValues instruction",
      instructionPlaceholder: "E.g. SHEET=CodeDirectory or VALUE=A;B;C",
      instructionHelp:
        "Use SHEET=SheetName to load an auxiliary sheet or any custom instruction.",
    },
    footer: {
      removeFile: "Remove file",
      launch: "Run Python validation",
      launching: "Validating…",
      downloadReport: "Download report",
    },
    statuses: {
      default: "No file imported. Drop an Excel template or create your rules manually.",
      customPending: "Custom rules pending validation.",
      rulesAdded: "New rule added. Complete it before launching the validation.",
      rulesUpdated: "Rules updated.",
      analyzingFile: (filename: string) => `Analyzing ${filename}…`,
      fileAnalyzed: "File analyzed. Update the rules if needed before validation.",
      noRulesTemplateImported:
        'No rules found. Columns from the "Template" sheet were imported as a default starting point.',
      noRulesNoHeaders:
        'No rules found and no headers detected in the "Template" sheet. Add your rules manually.',
      readError: "Error while reading the file. Please check the Excel format.",
      validating: "Validation in progress…",
      validationError: (message?: string) =>
        message ? `Validation error: ${message}` : "Validation error: unexpected response.",
      validationFailed: (message?: string) => message ?? "Validation failed.",
      validationSuccess: (message?: string) => message ?? "Validation completed.",
      networkError: "Network error: unable to reach the validation service.",
    },
  },
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

function getStatusMessage(dictionary: Translation["statuses"], state: StatusState): string {
  switch (state.type) {
    case "default":
      return dictionary.default;
    case "customPending":
      return dictionary.customPending;
    case "rulesAdded":
      return dictionary.rulesAdded;
    case "rulesUpdated":
      return dictionary.rulesUpdated;
    case "analyzingFile":
      return dictionary.analyzingFile(state.filename);
    case "fileAnalyzed":
      return dictionary.fileAnalyzed;
    case "noRulesTemplateImported":
      return dictionary.noRulesTemplateImported;
    case "noRulesNoHeaders":
      return dictionary.noRulesNoHeaders;
    case "readError":
      return dictionary.readError;
    case "validating":
      return dictionary.validating;
    case "validationError":
      return dictionary.validationError(state.message);
    case "validationFailed":
      return dictionary.validationFailed(state.message);
    case "validationSuccess":
      return dictionary.validationSuccess(state.message);
    case "networkError":
      return dictionary.networkError;
    default:
      return dictionary.default;
  }
}

export default function HomePage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [statusState, setStatusState] = useState<StatusState>({ type: "default" });
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rulesEdited, setRulesEdited] = useState<boolean>(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("fr");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const t = translations[language];
  const hasMissingField = useMemo(() => rules.some((rule) => !rule.field.trim()), [rules]);
  const statusMessage = getStatusMessage(t.statuses, statusState);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("dmf-language");
    if (storedLanguage === "fr" || storedLanguage === "en") {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dmf-language", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("dmf-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      return;
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.setProperty("color-scheme", theme === "dark" ? "dark" : "light");
    window.localStorage.setItem("dmf-theme", theme);
  }, [theme]);

  function markRulesEdited(type: "customPending" | "rulesAdded" | "rulesUpdated" = "customPending") {
    setRulesEdited(true);
    if (!isSubmitting) {
      setStatusState({ type });
    }
  }

  function resetSelection() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFile(null);
    setRules([]);
    setRulesEdited(false);
    setReportUrl(null);
    setStatusState({ type: "default" });
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
    markRulesEdited("rulesAdded");
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    markRulesEdited("rulesUpdated");
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
    setStatusState({ type: "analyzingFile", filename: selected.name });

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
        setStatusState({ type: "fileAnalyzed" });
        return;
      }

      const templateFields = extractTemplateFields(templateSheet);
      if (templateFields.length > 0) {
        const generatedRules = templateFields.map((field) => createRuleFromField(field));
        setRules(generatedRules);
        setRulesEdited(true);
        setStatusState({ type: "noRulesTemplateImported" });
        return;
      }

      setRules([]);
      setRulesEdited(false);
      setStatusState({ type: "noRulesNoHeaders" });
    } catch (error) {
      console.error(error);
      setStatusState({ type: "readError" });
    }
  }

  async function launchValidation() {
    if (!file) return;
    setIsSubmitting(true);
    setStatusState({ type: "validating" });
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
        const message = (await response.text()).trim();
        setStatusState({ type: "validationError", message: message || undefined });
        return;
      }

      const payload: {
        success: boolean;
        message?: string;
        downloadUrl?: string;
      } = await response.json();

      if (!payload.success) {
        setStatusState({ type: "validationFailed", message: payload.message });
        return;
      }

      setStatusState({ type: "validationSuccess", message: payload.message });
      if (payload.downloadUrl) {
        setReportUrl(payload.downloadUrl);
      }
    } catch (error) {
      console.error(error);
      setStatusState({ type: "networkError" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderLanguageButtons(option: Language) {
    const isActive = language === option;
    return (
      <button
        key={option}
        type="button"
        onClick={() => setLanguage(option)}
        className={`flex-1 px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isActive
            ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300"
            : "text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300"
        }`}
        aria-pressed={isActive}
      >
        {t.languageOptions[option]}
      </button>
    );
  }

  return (
    <main className="min-h-screen p-6 transition-colors md:p-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800 dark:ring-slate-700 dark:shadow-lg/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 transition-colors dark:text-slate-100">{t.upload.title}</h1>
              <p className="mt-2 text-sm text-slate-600 transition-colors dark:text-slate-300">{t.upload.description}</p>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                  {t.toggles.language}
                </span>
                <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white/60 shadow-inner dark:border-slate-600 dark:bg-slate-800/60">
                  {(["fr", "en"] as Language[]).map((option) => renderLanguageButtons(option))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                  {t.toggles.theme}
                </span>
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                >
                  <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
                  <span>{theme === "dark" ? t.themeToggle.light : t.themeToggle.dark}</span>
                </button>
              </div>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-indigo-400 dark:border-slate-600 dark:hover:border-indigo-400">
            <span className="text-base font-medium text-slate-700 transition-colors dark:text-slate-200">{t.upload.dropLabel}</span>
            <span className="text-sm text-slate-500 transition-colors dark:text-slate-400">{t.upload.dropHint}</span>
            <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFileChange} ref={fileInputRef} />
          </label>
        </header>

        <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800 dark:ring-slate-700 dark:shadow-lg/5">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 transition-colors dark:text-slate-100">{t.ruleSummary.title}</h2>
              <p className="text-sm text-slate-500 transition-colors dark:text-slate-300">{t.ruleSummary.subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition-colors dark:bg-slate-700 dark:text-slate-200">
                {t.ruleSummary.rulesCount(rules.length)}
              </span>
              <button
                type="button"
                onClick={addRule}
                className="inline-flex items-center rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                {t.ruleSummary.addRule}
              </button>
            </div>
          </header>

          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900 transition-colors dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
            <p className="font-medium">{t.ruleSummary.tipsTitle}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {t.ruleSummary.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          {rules.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 transition-colors dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              <p>{t.emptyState.description}</p>
              <button
                type="button"
                onClick={addRule}
                className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {t.emptyState.action}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {rules.map((rule) => {
                const fieldIsEmpty = rule.field.trim().length === 0;
                return (
                  <div key={rule.id} className="rounded-xl border border-slate-200 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 p-5 transition-colors dark:border-slate-700 dark:bg-slate-800/80 md:flex-row md:items-end">
                      <div className="flex-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                          {t.ruleCard.fieldLabel}
                        </label>
                        <input
                          type="text"
                          value={rule.field}
                          onChange={(event) => updateRule(rule.id, { field: event.target.value })}
                          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40 ${
                            fieldIsEmpty ? "border-rose-400 focus:ring-rose-200 dark:border-rose-500/70" : "border-slate-200 dark:border-slate-700"
                          }`}
                          placeholder={t.ruleCard.fieldPlaceholder}
                        />
                        {fieldIsEmpty && (
                          <p className="mt-1 text-xs text-rose-600 transition-colors dark:text-rose-300">{t.ruleCard.fieldRequiredHint}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-500/60 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        {t.ruleCard.removeRule}
                      </button>
                    </div>

                    <div className="grid gap-6 p-5 transition-colors md:grid-cols-2">
                      <div className="space-y-5">
                        <fieldset className="grid grid-cols-2 gap-3 text-sm text-slate-700 transition-colors dark:text-slate-200">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.checked}
                              onChange={(event) => updateRule(rule.id, { checked: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                            />
                            <span>{t.ruleCard.activeLabel}</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.required}
                              onChange={(event) => updateRule(rule.id, { required: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                            />
                            <span>{t.ruleCard.requiredLabel}</span>
                          </label>
                        </fieldset>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                              {t.ruleCard.minLabel}
                            </label>
                            <input
                              type="number"
                              value={rule.minLength ?? ""}
                              onChange={(event) => updateRule(rule.id, { minLength: parseNumberInput(event.target.value) })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40"
                              placeholder={t.ruleCard.optionalPlaceholder}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                              {t.ruleCard.maxLabel}
                            </label>
                            <input
                              type="number"
                              value={rule.maxLength ?? ""}
                              onChange={(event) => updateRule(rule.id, { maxLength: parseNumberInput(event.target.value) })}
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40"
                              placeholder={t.ruleCard.optionalPlaceholder}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                            {t.ruleCard.patternLabel}
                          </label>
                          <input
                            type="text"
                            value={rule.pattern ?? ""}
                            onChange={(event) => updateRule(rule.id, { pattern: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40"
                            placeholder={t.ruleCard.patternPlaceholder}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                            {t.ruleCard.customRuleLabel}
                          </label>
                          <input
                            type="text"
                            value={rule.customRule ?? ""}
                            onChange={(event) => updateRule(rule.id, { customRule: event.target.value || undefined })}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40"
                            placeholder={t.ruleCard.customRulePlaceholder}
                          />
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                            {t.ruleCard.sourceLabel}
                          </label>
                          <select
                            value={rule.allowedType}
                            onChange={(event) => updateRule(rule.id, { allowedType: event.target.value as AllowedType })}
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40"
                          >
                            <option value="list">{t.ruleCard.sourceOptions.list}</option>
                            <option value="instruction">{t.ruleCard.sourceOptions.instruction}</option>
                          </select>
                        </div>

                        {rule.allowedType === "list" ? (
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                              {t.ruleCard.valuesLabel}
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
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40"
                              placeholder={t.ruleCard.valuesPlaceholder}
                            />
                            <p className="mt-1 text-xs text-slate-500 transition-colors dark:text-slate-400">{t.ruleCard.valuesHelp}</p>
                            {rule.allowedValues.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {rule.allowedValues.map((value) => (
                                  <span
                                    key={`${rule.id}-${value}`}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors dark:bg-slate-700 dark:text-slate-100"
                                  >
                                    {value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors dark:text-slate-400">
                              {t.ruleCard.instructionLabel}
                            </label>
                            <textarea
                              value={rule.allowedInstruction}
                              onChange={(event) => updateRule(rule.id, { allowedInstruction: event.target.value })}
                              className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40"
                              placeholder={t.ruleCard.instructionPlaceholder}
                            />
                            <p className="mt-1 text-xs text-slate-500 transition-colors dark:text-slate-400">{t.ruleCard.instructionHelp}</p>
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

        <footer className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800 dark:ring-slate-700 dark:shadow-lg/5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600 transition-colors dark:text-slate-300">{statusMessage}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => resetSelection()}
              disabled={!file || isSubmitting}
              className="rounded-lg border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-600 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400 dark:text-rose-300 dark:hover:border-rose-300 dark:hover:text-rose-200"
            >
              {t.footer.removeFile}
            </button>
            <button
              type="button"
              disabled={!file || isSubmitting || hasMissingField}
              onClick={launchValidation}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
            >
              {isSubmitting ? t.footer.launching : t.footer.launch}
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                {t.footer.downloadReport}
              </a>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
