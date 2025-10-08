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
      toLight: "Passer au thÃ¨me clair",
      toDark: "Passer au thÃ¨me sombre",
    },
    languageToggle: {
      label: "Choisir la langue",
      languages: {
        fr: {
          label: "FranÃ§ais",
          title: "Afficher l'interface en franÃ§ais",
        },
        en: {
          label: "Anglais",
          title: "Afficher l'interface en anglais",
        },
      },
    },
    common: {
      backToHome: "Revenir Ã  l'accueil",
    },
    home: {
      badge: "Portail DMF",
      title: "Choisissez votre parcours",
      description:
        "SÃ©lectionnez le module adaptÃ© Ã  votre besoin : revue des fichiers ou gÃ©nÃ©ration d'un fichier mappÃ©.",
      options: {
        review: {
          label: "Review files",
          title: "Valider vos fichiers DMF",
          description:
            "Retrouvez le processus historique pour analyser les rÃ¨gles, les ajuster et lancer la validation Python.",
          action: "AccÃ©der Ã  la validation",
        },
        mapping: {
          label: "Mapping files",
          title: "GÃ©nÃ©rer un fichier mappÃ©",
          description:
            "ExÃ©cutez le script de mapping pour transformer un template Excel selon vos rÃ¨gles Rules.",
          action: "AccÃ©der au mapping",
        },
      },
    },
    mapping: {
      hero: {
        badge: "Mapping Excel",
        title: "GÃ©nÃ©rez votre fichier mappÃ©",
        description:
          "Utilisez le moteur Python pour appliquer vos rÃ¨gles Rules et produire automatiquement un fichier mappÃ©.",
        uploadLabel: "DÃ©posez ou sÃ©lectionnez votre fichier Template",
        uploadHint: "Feuilles nÃ©cessaires : Template, Règles et onglets de mapping associÃ©s",
        unknownType: "Type non dÃ©fini",
      },
      actions: {
        selectFile: "SÃ©lectionner un fichier",
        changeFile: "Changer de fichier",
        removeFile: "Retirer le fichier",
        start: "Lancer le mapping",
        processing: "Mapping en coursâ€¦",
        download: "TÃ©lÃ©charger le rÃ©sultat",
      },
      status: {
        idle: "Importez un fichier Excel pour dÃ©marrer le mapping.",
        ready: (filename: string) => `Fichier prÃªt : ${filename}.`,
        processing: (filename: string) => `Mapping en cours pour ${filename}â€¦`,
        success: (originalName: string) => `Mapping terminÃ©. TÃ©lÃ©chargez ${originalName}.`,
        error: (message: string) => `Erreur lors du mapping : ${message}`,
        genericError: "Le service de mapping a renvoyÃ© une erreur.",
        networkError: "Erreur rÃ©seau : impossible de contacter le service de mapping.",
      },
      rules: {
        summary: (count: number) =>
          count > 0
            ? `${count} rÃ¨gle${count > 1 ? "s" : ""} Rules`
            : "Afficher les rÃ¨gles Rules",
        editedBadge: "ModifiÃ©",
        description: "PrÃ©visualisez et ajustez les instructions de la feuille Règles.",
        helper: "Les changements seront envoyÃ©s au script Python sous forme de JSON.",
        emptyState: {
          description:
            "Aucune rÃ¨gle dÃ©tectÃ©e. CrÃ©ez des instructions manuellement pour les colonnes Ã  gÃ©nÃ©rer.",
        },
        addButton: "Ajouter une rÃ¨gle",
        removeButton: "Supprimer",
        ruleLabel: (index: number) => `RÃ¨gle ${index}`,
        targetLabel: "Colonne cible",
        targetPlaceholder: "Nom de la colonne gÃ©nÃ©rÃ©e",
        targetError: "La colonne cible est obligatoire.",
        typeLabel: "Type de rÃ¨gle / Rule type",
        typeHelper:
          "Choisissez comment remplir la colonne cible / Choose how to populate the target column.",
        typeOptions: {
          column: "Copier une colonne du Template / Copy a Template column",
          mapping: "Feuille de correspondance / Mapping sheet lookup",
          invariable: "Valeur fixe / Fixed value",
          ns: "Numérotation / Sequential numbering",
          concat: "Assembler des champs / Concatenate fields",
          custom: "Instruction avancée / Advanced instruction",
          empty: "Colonne vide / Empty column",
        },
        typeDescriptions: {
          COLUMN:
            "Reproduit une colonne existante du Template. / Copies an existing Template column.",
          MAPPING:
            "Recherche une valeur dans une feuille annexe Ã  partir d'une colonne du Template. / Looks up values from another sheet based on a Template column.",
          INVARIABLE:
            "Applique la mÃªme valeur sur toutes les lignes. / Applies the same value to every row.",
          NS:
            "GÃ©nÃ¨re une sÃ©quence numÃ©rique selon le motif fourni (# pour les chiffres). / Generates a numeric sequence from the provided pattern (# for digits).",
          CONCAT:
            "Assemble plusieurs colonnes et textes pour produire la valeur finale. / Concatenates multiple columns or literals into the final value.",
          CUSTOM:
            "Saisissez une instruction Rules personnalisÃ©e. / Enter a custom Rules instruction.",
          EMPTY:
            "CrÃ©e une colonne vide tout en conservant l'en-tÃªte. / Creates an empty column while keeping the header.",
        },
        fields: {
          column: {
            sourceLabel: "Colonne source Template / Template source column",
            sourcePlaceholder: "Choisir une colonne / Select a column",
            helper:
              "Indiquez le nom exact de la colonne Ã  recopier depuis la feuille Template. / Provide the exact Template column name to copy.",
          },
          invariable: {
            valueLabel: "Valeur appliquÃ©e / Applied value",
            valuePlaceholder: "Ex : France",
            helper:
              "La valeur saisie sera Ã©crite sur chaque ligne du fichier mappÃ©. / This value will be written on every row of the mapped file.",
          },
          mapping: {
            sourceLabel: "Colonne Template / Template column",
            sourcePlaceholder: "Choisir une colonne / Select a column",
            sheetLabel: "Feuille de correspondance / Mapping sheet",
            sheetPlaceholder: "Ex : Country",
            helper:
              "Renseignez la colonne Template Ã  rechercher et l'onglet contenant la table de correspondance. / Specify the Template column to search and the sheet containing the lookup table.",
          },
          ns: {
            patternLabel: "Motif de numÃ©rotation / Numbering pattern",
            patternPlaceholder: "Ex : DMF###",
            helper:
              "Utilisez # pour chaque chiffre Ã  incrÃ©menter (ex : DMF### donnera DMF001, DMF002, â€¦). / Use # for each digit to increment (e.g. DMF### becomes DMF001, DMF002, ...).",
          },
          concat: {
            expressionLabel: "Expression de concatÃ©nation / Concatenation expression",
            expressionPlaceholder: "Ex : COLUMN1 + ' - ' + COLUMN2",
            helper:
              "Combinez des colonnes Template et du texte entre apostrophes. / Combine Template columns and text between quotes.",
          },
          custom: {
            instructionLabel: "Instruction personnalisÃ©e / Custom instruction",
            instructionPlaceholder:
              "Ex : VALUE=A;B;C / Example: SHEET=AnnuaireCodes",
            helper:
              "Saisissez librement une instruction Rules avancÃ©e. / Enter any advanced Rules instruction.",
          },
          empty: {
            helper:
              "La colonne restera vide ; utilisez-la pour forcer une colonne dans le rÃ©sultat. / The column stays empty; use it to force a column in the result.",
          },
        },
        examples: {
  COLUMN: "Ex.: copie la colonne ‘AccountNumber’. / Copies ‘AccountNumber’.",
  MAPPING: "Ex.: cherche ‘Country’ dans la feuille ‘Country’. / Lookup in ‘Country’ sheet.",
  INVARIABLE: "Ex.: met ‘France’ sur toutes les lignes. / Puts ‘France’ on every row.",
  NS: "Ex.: DMF### donne DMF001, DMF002… / DMF### -> DMF001…",
  CONCAT: "Ex.: Account + ‘ - ’ + Name. / Account + ‘ - ’ + Name.",
  CUSTOM: "Instruction avancée si nécessaire. / Advanced instruction if needed.",
  EMPTY: "Colonne vide (aucune instruction). / Empty column (no instruction).",
},
        detailError:
          "ComplÃ©tez les informations de la rÃ¨gle sÃ©lectionnÃ©e. / Complete the selected rule information.",
        detailWarning:
          "VÃ©rifiez chaque rÃ¨gle avant de lancer le mapping. / Check every rule before starting the mapping.",
        launchWarning:
          "ComplÃ©tez toutes les colonnes cibles avant de lancer le mapping. / Fill every target column before running the mapping.",
      },
      tips: {
        title: "Conseils d'utilisation",
        items: [
          "Assurez-vous que les onglets Template et Rules sont prÃ©sents et complÃ©tÃ©s.",
          "Les feuilles mentionnÃ©es dans les rÃ¨gles MAPPING= doivent exister dans votre fichier Excel.",
          "Le fichier gÃ©nÃ©rÃ© porte automatiquement le suffixe _mapping pour Ãªtre identifiÃ© facilement.",
        ],
      },
    },
    hero: {
      title: "Validation DMF",
      description:
        "DÃ©posez votre template Excel pour visualiser les rÃ¨gles, personnalisez-les dans l'application puis lancez la validation Python.",
      uploadLabel: "DÃ©poser un fichier Excel",
      uploadHint: "Feuilles attendues: Template & ValidationRules",
    },
    rules: {
      heading: "RÃ¨gles dÃ©tectÃ©es",
      description:
        "InterprÃ©tation lisible de la feuille ValidationRules et Ã©dition directement dans l'interface.",
      countLabel: (count: number) => `${count} rÃ¨gle${count > 1 ? "s" : ""}`,
      addButton: "Ajouter une rÃ¨gle",
      tipTitle: "Astuce d'utilisation",
      tips: [
        "Activez ou dÃ©sactivez les contrÃ´les comme dans la feuille Excel.",
        "Basculer sur Â« Instruction Â» permet de rÃ©fÃ©rencer une feuille annexe avec SHEET=NomFeuille.",
        "Ajoutez autant de valeurs autorisÃ©es que nÃ©cessaire en saisissant une valeur par ligne.",
      ],
      emptyState: {
        description:
          "Aucune rÃ¨gle Ã  afficher pour l'instant. Importez un fichier ou crÃ©ez votre premiÃ¨re rÃ¨gle pour dÃ©marrer la configuration.",
        action: "CrÃ©er une premiÃ¨re rÃ¨gle",
      },
      field: {
        label: "Champ",
        placeholder: "Nom du champ dans la feuille Template",
        error: "Le nom du champ est requis pour lancer la validation.",
      },
      removeButton: "Supprimer",
      toggles: {
        checked: "Checker activÃ©",
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
        label: "RÃ¨gle personnalisÃ©e",
        placeholder: "Nom de la fonction Python personnalisÃ©e",
      },
      allowed: {
        label: "Source des valeurs autorisÃ©es",
        options: {
          list: "Liste de valeurs",
          instruction: "Instruction (VALUE=, SHEET=, etc.)",
        },
        valuesLabel: "Valeurs autorisÃ©es",
        valuesPlaceholder: "Saisissez une valeur par ligne",
        valuesHint: "Ces valeurs seront converties en instruction VALUE= lors de la validation.",
        instructionLabel: "Instruction AllowedValues",
        instructionPlaceholder: "Ex: SHEET=AnnuaireCodes ou VALUE=A;B;C",
        instructionHint:
          "Utilisez SHEET=NomFeuille pour charger une feuille annexe ou toute instruction personnalisÃ©e.",
      },
    },
    footer: {
      removeFile: "Supprimer le fichier",
      startValidation: "Lancer la validation Python",
      validating: "Validationâ€¦",
      downloadReport: "TÃ©lÃ©charger le rapport",
    },
    statuses: {
      default:
        "Aucun fichier importÃ©. DÃ©posez un template Excel ou crÃ©ez vos rÃ¨gles manuellement.",
      awaiting: "RÃ¨gles personnalisÃ©es en attente de validation.",
      newRule: "Nouvelle rÃ¨gle ajoutÃ©e. ComplÃ©tez-la avant la validation.",
      rulesUpdated: "RÃ¨gles mises Ã  jour.",
      analyzing: (filename: string) => `Analyse de ${filename}â€¦`,
      analyzed:
        "Fichier analysÃ©. Modifiez les rÃ¨gles si nÃ©cessaire avant validation.",
      importedTemplate:
        'Aucune rÃ¨gle trouvÃ©e. Les colonnes de la feuille "Template" ont Ã©tÃ© importÃ©es comme base par dÃ©faut.',
      importedNoHeaders:
        'Aucune rÃ¨gle trouvÃ©e et aucun en-tÃªte dÃ©tectÃ© dans la feuille "Template". Ajoutez vos rÃ¨gles manuellement.',
      readError: "Erreur lors de la lecture du fichier. VÃ©rifiez le format Excel.",
      validating: "Validation en coursâ€¦",
      validationError: (message: string) => `Erreur validation: ${message}`,
      validationFailed: "La validation a Ã©chouÃ©.",
      validationSuccess: "Validation terminÃ©e.",
      networkError:
        "Erreur rÃ©seau: impossible de contacter le service de validation.",
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
          "Use the Python engine to apply the Rules rules and automatically produce a mapped workbook.",
        uploadLabel: "Drop or select your Template file",
        uploadHint: "Required sheets: Template, Règles and referenced mapping tabs",
        unknownType: "Unknown type",
      },
      actions: {
        selectFile: "Select a file",
        changeFile: "Change file",
        removeFile: "Remove file",
        start: "Start mapping",
        processing: "Mapping in progressâ€¦",
        download: "Download result",
      },
      status: {
        idle: "Upload an Excel file to start the mapping run.",
        ready: (filename: string) => `File ready: ${filename}.`,
        processing: (filename: string) => `Mapping ${filename}â€¦`,
        success: (originalName: string) => `Mapping completed. Download ${originalName}.`,
        error: (message: string) => `Mapping failed: ${message}`,
        genericError: "The mapping service returned an error.",
        networkError: "Network error: unable to reach the mapping service.",
      },
      rules: {
        summary: (count: number) =>
          count > 0 ? `${count} Rules rule${count > 1 ? "s" : ""}` : "Show Rules rules",
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
        typeLabel: "Rule type / Type de rÃ¨gle",
        typeHelper:
          "Choose how to populate the target column / Choisissez comment remplir la colonne cible.",
        typeOptions: {
          column: "Copier une colonne du Template / Copy a Template column",
          mapping: "Feuille de correspondance / Mapping sheet lookup",
          invariable: "Valeur fixe / Fixed value",
          ns: "Numérotation / Sequential numbering",
          concat: "Assembler des champs / Concatenate fields",
          custom: "Instruction avancée / Advanced instruction",
          empty: "Colonne vide / Empty column",
        },
        typeDescriptions: {
          COLUMN:
            "Copies an existing column from the Template sheet. / Reproduit une colonne existante du Template.",
          MAPPING:
            "Looks up a value from another sheet using a Template column. / Recherche une valeur dans une feuille annexe Ã  partir d'une colonne du Template.",
          INVARIABLE:
            "Applies the same value to every row. / Applique la mÃªme valeur sur toutes les lignes.",
          NS:
            "Generates a numeric sequence based on the provided pattern (# equals one digit). / GÃ©nÃ¨re une sÃ©quence numÃ©rique selon le motif fourni (# correspond Ã  un chiffre).",
          CONCAT:
            "Combines columns and literals into a single result. / Assemble plusieurs colonnes et textes pour produire la valeur finale.",
          CUSTOM:
            "Enter a custom Rules instruction. / Saisissez une instruction Rules personnalisÃ©e.",
          EMPTY:
            "Keeps an empty column in the output. / Conserve une colonne vide dans le rÃ©sultat.",
        },
        fields: {
          column: {
            sourceLabel: "Template source column / Colonne source Template",
            sourcePlaceholder: "Choisir une colonne / Select a column",
            helper:
              "Provide the exact Template column name to copy. / Indiquez le nom exact de la colonne Ã  recopier depuis Template.",
          },
          invariable: {
            valueLabel: "Value to apply / Valeur appliquÃ©e",
            valuePlaceholder: "Eg: France",
            helper:
              "This value will be written on every row of the mapped file. / Cette valeur sera Ã©crite sur chaque ligne du fichier mappÃ©.",
          },
          mapping: {
            sourceLabel: "Template column / Colonne Template",
            sourcePlaceholder: "Choisir une colonne / Select a column",
            sheetLabel: "Mapping sheet / Feuille de correspondance",
            sheetPlaceholder: "Eg: Country",
            helper:
              "Specify the Template column to search and the sheet containing the lookup table. / Renseignez la colonne Template Ã  rechercher et l'onglet contenant la table de correspondance.",
          },
          ns: {
            patternLabel: "Numbering pattern / Motif de numÃ©rotation",
            patternPlaceholder: "Eg: DMF###",
            helper:
              "Use # for each incremented digit (e.g. DMF### becomes DMF001, DMF002, â€¦). / Utilisez # pour chaque chiffre incrÃ©mentÃ© (ex. DMF### donnera DMF001, DMF002, â€¦).",
          },
          concat: {
            expressionLabel: "Concatenation expression / Expression de concatÃ©nation",
            expressionPlaceholder: "Eg: COLUMN1 + ' - ' + COLUMN2",
            helper:
              "Combine Template columns and quoted text. / Combinez des colonnes Template et du texte entre apostrophes.",
          },
          custom: {
            instructionLabel: "Custom instruction / Instruction personnalisÃ©e",
            instructionPlaceholder:
              "Eg: VALUE=A;B;C / Ex : SHEET=AnnuaireCodes",
            helper:
              "Enter any advanced Rules instruction. / Saisissez une instruction Rules avancÃ©e.",
          },
          empty: {
            helper:
              "The column remains empty; use it to force a header in the result. / La colonne reste vide ; utilisez-la pour forcer un en-tÃªte dans le rÃ©sultat.",
          },
        },
        examples: {
  COLUMN: "Ex.: copie la colonne ‘AccountNumber’. / Copies ‘AccountNumber’.",
  MAPPING: "Ex.: cherche ‘Country’ dans la feuille ‘Country’. / Lookup in ‘Country’ sheet.",
  INVARIABLE: "Ex.: met ‘France’ sur toutes les lignes. / Puts ‘France’ on every row.",
  NS: "Ex.: DMF### donne DMF001, DMF002… / DMF### -> DMF001…",
  CONCAT: "Ex.: Account + ‘ - ’ + Name. / Account + ‘ - ’ + Name.",
  CUSTOM: "Instruction avancée si nécessaire. / Advanced instruction if needed.",
  EMPTY: "Colonne vide (aucune instruction). / Empty column (no instruction).",
},
        detailError:
          "Complete the selected rule information. / ComplÃ©tez les informations de la rÃ¨gle sÃ©lectionnÃ©e.",
        detailWarning:
          "Review every rule before launching the mapping. / VÃ©rifiez chaque rÃ¨gle avant de lancer le mapping.",
        launchWarning:
          "Fill every target column before running the mapping. / ComplÃ©tez toutes les colonnes cibles avant de lancer le mapping.",
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
        "Switching to â€œInstructionâ€ lets you reference another sheet with SHEET=SheetName.",
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
      validating: "Validatingâ€¦",
      downloadReport: "Download report",
    },
    statuses: {
      default:
        "No file imported. Drop an Excel template or create your rules manually.",
      awaiting: "Custom rules waiting for validation.",
      newRule: "New rule added. Complete it before running the validation.",
      rulesUpdated: "Rules updated.",
      analyzing: (filename: string) => `Analyzing ${filename}â€¦`,
      analyzed:
        "File analyzed. Edit the rules if needed before validation.",
      importedTemplate:
        'No rules found. Columns from the "Template" sheet were imported as the default base.',
      importedNoHeaders:
        'No rules found and no headers detected in the "Template" sheet. Add your rules manually.',
      readError: "Error while reading the file. Check the Excel format.",
      validating: "Validation in progressâ€¦",
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










