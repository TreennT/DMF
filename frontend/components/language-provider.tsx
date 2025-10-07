"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const translations = {
  fr: {
    themeToggle: {
      toLight: "Passer au thème clair",
      toDark: "Passer au thème sombre",
    },
    languageToggle: {
      label: "Choisir la langue",
      languages: {
        fr: {
          label: "Français",
          title: "Afficher l'interface en français",
        },
        en: {
          label: "Anglais",
          title: "Afficher l'interface en anglais",
        },
      },
    },
    hero: {
      title: "Validation DMF",
      description:
        "Déposez votre template Excel pour visualiser les règles, personnalisez-les dans l'application puis lancez la validation Python.",
      uploadLabel: "Déposer un fichier Excel",
      uploadHint: "Feuilles attendues: Template & ValidationRules",
    },
    rules: {
      heading: "Règles détectées",
      description:
        "Interprétation lisible de la feuille ValidationRules et édition directement dans l'interface.",
      countLabel: (count: number) => `${count} règle${count > 1 ? "s" : ""}`,
      addButton: "Ajouter une règle",
      tipTitle: "Astuce d'utilisation",
      tips: [
        "Activez ou désactivez les contrôles comme dans la feuille Excel.",
        "Basculer sur « Instruction » permet de référencer une feuille annexe avec SHEET=NomFeuille.",
        "Ajoutez autant de valeurs autorisées que nécessaire en saisissant une valeur par ligne.",
      ],
      emptyState: {
        description:
          "Aucune règle à afficher pour l'instant. Importez un fichier ou créez votre première règle pour démarrer la configuration.",
        action: "Créer une première règle",
      },
      field: {
        label: "Champ",
        placeholder: "Nom du champ dans la feuille Template",
        error: "Le nom du champ est requis pour lancer la validation.",
      },
      removeButton: "Supprimer",
      toggles: {
        checked: "Checker activé",
        required: "Champ obligatoire",
      },
      length: {
        minLabel: "Taille min",
        maxLabel: "Taille max",
        placeholder: "Optionnel",
      },
      pattern: {
        label: "Pattern (RegExp)",
        placeholder: "Ex: ^[0-9]{5}$",
      },
      customRule: {
        label: "Règle personnalisée",
        placeholder: "Nom de la fonction Python personnalisée",
      },
      allowed: {
        label: "Source des valeurs autorisées",
        options: {
          list: "Liste de valeurs",
          instruction: "Instruction (VALUE=, SHEET=, etc.)",
        },
        valuesLabel: "Valeurs autorisées",
        valuesPlaceholder: "Saisissez une valeur par ligne",
        valuesHint: "Ces valeurs seront converties en instruction VALUE= lors de la validation.",
        instructionLabel: "Instruction AllowedValues",
        instructionPlaceholder: "Ex: SHEET=AnnuaireCodes ou VALUE=A;B;C",
        instructionHint:
          "Utilisez SHEET=NomFeuille pour charger une feuille annexe ou toute instruction personnalisée.",
      },
    },
    footer: {
      removeFile: "Supprimer le fichier",
      startValidation: "Lancer la validation Python",
      validating: "Validation…",
      downloadReport: "Télécharger le rapport",
    },
    statuses: {
      default:
        "Aucun fichier importé. Déposez un template Excel ou créez vos règles manuellement.",
      awaiting: "Règles personnalisées en attente de validation.",
      newRule: "Nouvelle règle ajoutée. Complétez-la avant la validation.",
      rulesUpdated: "Règles mises à jour.",
      analyzing: (filename: string) => `Analyse de ${filename}…`,
      analyzed:
        "Fichier analysé. Modifiez les règles si nécessaire avant validation.",
      importedTemplate:
        'Aucune règle trouvée. Les colonnes de la feuille "Template" ont été importées comme base par défaut.',
      importedNoHeaders:
        'Aucune règle trouvée et aucun en-tête détecté dans la feuille "Template". Ajoutez vos règles manuellement.',
      readError: "Erreur lors de la lecture du fichier. Vérifiez le format Excel.",
      validating: "Validation en cours…",
      validationError: (message: string) => `Erreur validation: ${message}`,
      validationFailed: "La validation a échoué.",
      validationSuccess: "Validation terminée.",
      networkError:
        "Erreur réseau: impossible de contacter le service de validation.",
    },
  },
  en: {
    themeToggle: {
      toLight: "Switch to light mode",
      toDark: "Switch to dark mode",
    },
    languageToggle: {
      label: "Choose language",
      languages: {
        fr: {
          label: "French",
          title: "Switch interface to French",
        },
        en: {
          label: "English",
          title: "Switch interface to English",
        },
      },
    },
    hero: {
      title: "DMF validation",
      description:
        "Drop your Excel template to visualize the rules, customize them in the app, then launch the Python validation.",
      uploadLabel: "Upload an Excel file",
      uploadHint: "Expected sheets: Template & ValidationRules",
    },
    rules: {
      heading: "Detected rules",
      description:
        "Readable interpretation of the ValidationRules sheet with direct editing in the interface.",
      countLabel: (count: number) => `${count} rule${count === 1 ? "" : "s"}`,
      addButton: "Add a rule",
      tipTitle: "Usage tips",
      tips: [
        "Enable or disable controls just like in the Excel sheet.",
        "Switching to “Instruction” lets you reference another sheet with SHEET=SheetName.",
        "Add as many allowed values as needed by entering one value per line.",
      ],
      emptyState: {
        description:
          "No rules to display yet. Import a file or create your first rule to start configuring.",
        action: "Create a first rule",
      },
      field: {
        label: "Field",
        placeholder: "Field name from the Template sheet",
        error: "Field name is required before launching validation.",
      },
      removeButton: "Delete",
      toggles: {
        checked: "Checker enabled",
        required: "Required field",
      },
      length: {
        minLabel: "Min length",
        maxLabel: "Max length",
        placeholder: "Optional",
      },
      pattern: {
        label: "Pattern (RegExp)",
        placeholder: "Example: ^[0-9]{5}$",
      },
      customRule: {
        label: "Custom rule",
        placeholder: "Name of the custom Python function",
      },
      allowed: {
        label: "Source of allowed values",
        options: {
          list: "Value list",
          instruction: "Instruction (VALUE=, SHEET=, etc.)",
        },
        valuesLabel: "Allowed values",
        valuesPlaceholder: "Enter one value per line",
        valuesHint:
          "These values will be converted into a VALUE= instruction during validation.",
        instructionLabel: "AllowedValues instruction",
        instructionPlaceholder:
          "e.g. SHEET=CodeDirectory or VALUE=A;B;C",
        instructionHint:
          "Use SHEET=SheetName to load an auxiliary sheet or any custom instruction.",
      },
    },
    footer: {
      removeFile: "Remove file",
      startValidation: "Start Python validation",
      validating: "Validating…",
      downloadReport: "Download report",
    },
    statuses: {
      default:
        "No file imported. Drop an Excel template or create your rules manually.",
      awaiting: "Custom rules waiting for validation.",
      newRule: "New rule added. Complete it before running the validation.",
      rulesUpdated: "Rules updated.",
      analyzing: (filename: string) => `Analyzing ${filename}…`,
      analyzed:
        "File analyzed. Edit the rules if needed before validation.",
      importedTemplate:
        'No rules found. Columns from the "Template" sheet were imported as the default base.',
      importedNoHeaders:
        'No rules found and no headers detected in the "Template" sheet. Add your rules manually.',
      readError: "Error while reading the file. Check the Excel format.",
      validating: "Validation in progress…",
      validationError: (message: string) => `Validation error: ${message}`,
      validationFailed: "Validation failed.",
      validationSuccess: "Validation completed.",
      networkError: "Network error: unable to reach the validation service.",
    },
  },
} as const;

type Language = keyof typeof translations;
type Translation = (typeof translations)[Language];

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  content: Translation;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("dmf-language");
    const next = stored === "en" || stored === "fr" ? stored : "fr";
    setLanguageState(next);
    document.documentElement.lang = next;
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("dmf-language", language);
    document.documentElement.lang = language;
  }, [language, mounted]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      content: translations[language],
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export type { Language, Translation };
