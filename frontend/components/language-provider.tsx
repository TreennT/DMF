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
    common: {
      backToHome: "Revenir à l'accueil",
    },
    home: {
      badge: "Portail DMF",
      title: "Choisissez votre parcours",
      description:
        "Sélectionnez le module adapté à votre besoin : revue des fichiers ou génération d'un fichier mappé.",
      options: {
        review: {
          label: "Vérifier les fichiers",
          title: "Valider vos fichiers DMF",
          description:
            "Retrouvez le processus historique pour analyser les règles, les ajuster et lancer la validation Python.",
          action: "Accéder à la validation",
        },
        mapping: {
          label: "Fichier mappé",
          title: "Générez votre fichier mappé",
          description:
            "Exécutez le script de mapping pour transformer un template Excel selon vos règles personnalisées.",
          action: "Accéder au mapping",
        },
      },
    },
    mapping: {
      hero: {
        badge: "Mapping Excel",
        title: "Générez votre fichier mappé",
        description:
          "Utilisez le moteur Python pour appliquer vos règles de mapping et produire automatiquement un fichier mappé.",
        uploadLabel: "Déposez ou sélectionnez votre fichier Template",
        uploadHint: "Feuilles nécessaires : Template, Règles et onglets de mapping associés",
        unknownType: "Type non défini",
      },
      actions: {
        selectFile: "Sélectionner un fichier",
        changeFile: "Changer de fichier",
        removeFile: "Retirer le fichier",
        start: "Lancer le mapping",
        processing: "Mapping en cours…",
        download: "Télécharger le résultat",
      },
      status: {
        idle: "Importez un fichier Excel pour démarrer le mapping.",
        ready: (filename: string) => `Fichier prêt : ${filename}.`,
        processing: (filename: string) => `Mapping en cours pour ${filename}…`,
        success: (originalName: string) => `Mapping terminé. Téléchargez ${originalName}.`,
        error: (message: string) => `Erreur lors du mapping : ${message}`,
        genericError: "Le service de mapping a renvoyé une erreur.",
        networkError: "Erreur réseau : impossible de contacter le service de mapping.",
      },
      rules: {
        summary: (count: number) =>
          count > 0
            ? `${count} règle${count > 1 ? "s" : ""}`
            : "Afficher les règles",
        editedBadge: "Modifié",
        description: "Prévisualisez et ajustez les instructions de la feuille Règles.",
        helper: "Les changements seront envoyés au script Python sous forme de JSON.",
        emptyState: {
          description:
            "Aucune règle détectée. Créez des instructions manuellement pour les colonnes à générer.",
        },
        addButton: "Ajouter une règle",
        removeButton: "Supprimer",
        ruleLabel: (index: number) => `Règle ${index}`,
        targetLabel: "Colonne cible",
        targetPlaceholder: "Nom de la colonne générée",
        targetError: "La colonne cible est obligatoire.",
        typeLabel: "Type de règle",
        typeHelper: "Choisissez comment remplir la colonne cible.",
        typeOptions: {
          column: "Copier une colonne du Template",
          mapping: "Feuille de correspondance",
          invariable: "Valeur fixe",
          ns: "Numérotation",
          concat: "Assembler des champs",
          custom: "Instruction avancée",
          empty: "Colonne vide",
        },
        typeDescriptions: {
          COLUMN:
            "Reproduit une colonne existante du Template.",
          MAPPING:
            "Recherche une valeur dans une feuille annexe à partir d'une colonne du Template.",
          INVARIABLE:
            "Applique la même valeur sur toutes les lignes.",
          NS:
            "Génère une séquence numérique selon le motif fourni (# pour les chiffres).",
          CONCAT:
            "Assemble plusieurs colonnes et textes pour produire la valeur finale.",
          CUSTOM:
            "Saisissez une instruction Rules personnalisée.",
          EMPTY:
            "Crée une colonne vide tout en conservant l'en-tête.",
        },
        fields: {
          column: {
            sourceLabel: "Colonne source Template",
            sourcePlaceholder: "Choisir une colonne",
            helper:
              "Indiquez le nom exact de la colonne à recopier depuis la feuille Template.",
          },
          invariable: {
            valueLabel: "Valeur appliquée",
            valuePlaceholder: "Ex : France",
            helper:
              "La valeur saisie sera écrite sur chaque ligne du fichier mappé.",
          },
          mapping: {
            sourceLabel: "Colonne Template",
            sourcePlaceholder: "Choisir une colonne",
            sheetLabel: "Feuille de correspondance",
            sheetPlaceholder: "Ex : Country",
            helper:
              "Renseignez la colonne Template à rechercher et l'onglet contenant la table de correspondance.",
          },
          ns: {
            patternLabel: "Motif de numérotation",
            patternPlaceholder: "Ex : DMF###",
            helper:
              "Utilisez # pour chaque chiffre à incrémenter (ex : DMF### donnera DMF001, DMF002, …).",
          },
          concat: {
            expressionLabel: "Expression de concaténation",
            expressionPlaceholder: "Ex : COLUMN1 + ' - ' + COLUMN2",
            helper:
              "Combinez des colonnes Template et du texte entre apostrophes.",
          },
          custom: {
            instructionLabel: "Instruction personnalisée",
            instructionPlaceholder: "Ex : VALUE=A;B;C",
            helper:
              "Saisissez librement une instruction Rules avancée.",
          },
          empty: {
            helper:
              "La colonne restera vide ; utilisez-la pour forcer une colonne dans le résultat.",
          },
        },
        examples: {
          COLUMN: "Ex. : copie la colonne 'NuméroCompte'.",
          MAPPING: "Ex. : cherche 'Pays' dans la feuille 'Pays'.",
          INVARIABLE: "Ex. : met 'France' sur toutes les lignes.",
          NS: "Ex. : DMF### donne DMF001, DMF002…",
          CONCAT: "Ex. : COLONNE1 + ' - ' + COLONNE2.",
          CUSTOM: "Instruction avancée si nécessaire.",
          EMPTY: "Colonne vide (aucune instruction).",
        },
        detailError:
          "Complétez les informations de la règle sélectionnée.",
        detailWarning:
          "Vérifiez chaque règle avant de lancer le mapping.",
        launchWarning:
          "Complétez toutes les colonnes cibles avant de lancer le mapping.",
      },
      tips: {
        title: "Conseils d'utilisation",
        items: [
          "Assurez-vous que les onglets Template et Rules sont présents et complétés.",
          "Les feuilles mentionnées dans les règles MAPPING= doivent exister dans votre fichier Excel.",
          "Le fichier généré porte automatiquement le suffixe _mapping pour être identifié facilement.",
        ],
      },
    },
    hero: {
      badge: "Validation Excel",
      title: "Validation DMF",
      description:
        "Déposez votre template Excel pour visualiser les règles, personnalisez-les dans l'application puis lancez la validation Python.",
      uploadLabel: "Déposer un fichier Excel",
      uploadHint: "Feuilles attendues: Template & ValidationRules",
      selectButton: "Sélectionner un fichier",
      changeButton: "Changer de fichier",
      unknownType: "Type non défini",
    },
    rules: {
      heading: "Règles détectées",
      description:
        "Interprétation lisible de la feuille ValidationRules et édition directement dans l'interface.",
      helper:
        "Les modifications seront envoyées au service Python sous forme de JSON si vous lancez la validation.",
      summary: (count: number) =>
        count > 0 ? `${count} règle${count > 1 ? "s" : ""}` : "Afficher les règles",
      editedBadge: "Modifié",
      countLabel: (count: number) => `${count} règle${count > 1 ? "s" : ""}`,
      ruleLabel: (index: number) => `Règle ${index}`,
      addButton: "Ajouter une règle",
      removeButton: "Supprimer",
      tipTitle: "Conseils d'utilisation",
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
      detailWarning:
        "Complétez les informations de chaque règle avant de lancer la validation.",
      launchWarning:
        "Indiquez un champ pour chaque règle afin de pouvoir lancer la validation.",
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
    common: {
      backToHome: "Back to home",
    },
    home: {
      badge: "DMF workspace",
      title: "Choose your workflow",
      description:
        "Pick the module that matches your needs: review existing files or generate a mapped file.",
      options: {
        review: {
          label: "Review files",
          title: "Validate your DMF files",
          description:
            "Use the historical process to inspect the rules, adjust them and launch the Python validation.",
          action: "Go to validation",
        },
        mapping: {
          label: "Mapping files",
          title: "Produce a mapped file",
          description:
            "Run the mapping script on your Excel template to generate the transformed workbook.",
          action: "Go to mapping",
        },
      },
    },
    mapping: {
      hero: {
        badge: "Excel mapping",
        title: "Generate your mapped file",
        description:
          "Use the Python engine to apply the Rules sheet instructions and automatically produce a mapped workbook.",
        uploadLabel: "Drop or select your Template file",
        uploadHint: "Required sheets: Template, Rules and referenced mapping tabs",
        unknownType: "Unknown type",
      },
      actions: {
        selectFile: "Select a file",
        changeFile: "Change file",
        removeFile: "Remove file",
        start: "Start mapping",
        processing: "Mapping in progress…",
        download: "Download result",
      },
      status: {
        idle: "Upload an Excel file to start the mapping run.",
        ready: (filename: string) => `File ready: ${filename}.`,
        processing: (filename: string) => `Mapping ${filename}…`,
        success: (originalName: string) => `Mapping completed. Download ${originalName}.`,
        error: (message: string) => `Mapping failed: ${message}`,
        genericError: "The mapping service returned an error.",
        networkError: "Network error: unable to reach the mapping service.",
      },
      rules: {
        summary: (count: number) =>
          count > 0 ? `${count} rule${count > 1 ? "s" : ""}` : "Show rules",
        editedBadge: "Edited",
        description: "Review and tweak the instructions coming from the Rules sheet.",
        helper: "Changes are sent to the Python script as JSON overrides.",
        emptyState: {
          description: "No rule detected. Create instructions manually for the generated columns.",
        },
        addButton: "Add a rule",
        removeButton: "Delete",
        ruleLabel: (index: number) => `Rule ${index}`,
        targetLabel: "Target column",
        targetPlaceholder: "Name of the generated column",
        targetError: "Target column is required.",
        typeLabel: "Rule type",
        typeHelper: "Choose how to populate the target column.",
        typeOptions: {
          column: "Copy a Template column",
          mapping: "Mapping sheet lookup",
          invariable: "Fixed value",
          ns: "Sequential numbering",
          concat: "Concatenate fields",
          custom: "Advanced instruction",
          empty: "Empty column",
        },
        typeDescriptions: {
          COLUMN:
            "Copies an existing column from the Template sheet.",
          MAPPING:
            "Looks up a value from another sheet using a Template column.",
          INVARIABLE:
            "Applies the same value to every row.",
          NS:
            "Generates a numeric sequence based on the provided pattern (# equals one digit).",
          CONCAT:
            "Combines columns and literals into a single result.",
          CUSTOM:
            "Enter a custom Rules instruction.",
          EMPTY:
            "Keeps an empty column in the output.",
        },
        fields: {
          column: {
            sourceLabel: "Template source column",
            sourcePlaceholder: "Select a column",
            helper:
              "Provide the exact Template column name to copy.",
          },
          invariable: {
            valueLabel: "Value to apply",
            valuePlaceholder: "Eg: France",
            helper:
              "This value will be written on every row of the mapped file.",
          },
          mapping: {
            sourceLabel: "Template column",
            sourcePlaceholder: "Select a column",
            sheetLabel: "Mapping sheet",
            sheetPlaceholder: "Eg: Country",
            helper:
              "Specify the Template column to search and the sheet containing the lookup table.",
          },
          ns: {
            patternLabel: "Numbering pattern",
            patternPlaceholder: "Eg: DMF###",
            helper:
              "Use # for each incremented digit (e.g. DMF### becomes DMF001, DMF002, …).",
          },
          concat: {
            expressionLabel: "Concatenation expression",
            expressionPlaceholder: "Eg: COLUMN1 + ' - ' + COLUMN2",
            helper:
              "Combine Template columns and quoted text.",
          },
          custom: {
            instructionLabel: "Custom instruction",
            instructionPlaceholder: "Eg: VALUE=A;B;C",
            helper:
              "Enter any advanced Rules instruction.",
          },
          empty: {
            helper:
              "The column remains empty; use it to force a header in the result.",
          },
        },
        examples: {
          COLUMN: "E.g.: copies the 'AccountNumber' column.",
          MAPPING: "E.g.: looks up 'Country' in the 'Country' sheet.",
          INVARIABLE: "E.g.: writes 'France' on every row.",
          NS: "E.g.: DMF### becomes DMF001, DMF002…",
          CONCAT: "E.g.: Account + ' - ' + Name.",
          CUSTOM: "Advanced instruction if needed.",
          EMPTY: "Empty column (no instruction).",
        },
        detailError:
          "Complete the selected rule information.",
        detailWarning:
          "Review every rule before launching the mapping.",
        launchWarning:
          "Fill every target column before running the mapping.",
      },
      tips: {
        title: "Usage tips",
        items: [
          "Make sure the Template and Rules sheets are present and filled in.",
          "Sheets referenced in MAPPING= rules must exist in your workbook.",
          "The generated file automatically receives the _mapping suffix for easier identification.",
        ],
      },
    },
    hero: {
      badge: "Validation",
      title: "DMF validation",
      description:
        "Drop your Excel template to visualize the rules, customize them in the app, then launch the Python validation.",
      uploadLabel: "Upload an Excel file",
      uploadHint: "Expected sheets: Template & ValidationRules",
      selectButton: "Select a file",
      changeButton: "Change file",
      unknownType: "Unknown type",
    },
    rules: {
      heading: "Detected rules",
      description:
        "Readable interpretation of the ValidationRules sheet with direct editing in the interface.",
      helper:
        "Changes will be sent to the Python service as JSON overrides when you launch the validation.",
      summary: (count: number) =>
        count > 0 ? `${count} rule${count === 1 ? "" : "s"}` : "Show rules",
      editedBadge: "Edited",
      countLabel: (count: number) => `${count} rule${count === 1 ? "" : "s"}`,
      ruleLabel: (index: number) => `Rule ${index}`,
      addButton: "Add a rule",
      removeButton: "Delete",
      tipTitle: "Usage tips",
      tips: [
        "Enable or disable controls just like in the Excel sheet.",
        "Switching to \"Instruction\" lets you reference another sheet with SHEET=SheetName.",
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
      detailWarning: "Complete every rule before launching the validation.",
      launchWarning: "Provide a field name for each rule before starting the validation.",
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
    let next: Language | undefined;
    if (stored === "en" || stored === "fr") {
      next = stored;
    } else if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
      next = navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
    } else {
      next = "fr";
    }
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










