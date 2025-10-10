"use client";`n
`n
import {`n
  createContext,`n
  useCallback,`n
  useContext,`n
  useEffect,`n
  useMemo,`n
  useState,`n
  type ReactNode,`n
} from "react";`n
`n
const translations = {`n
  fr: {`n
    themeToggle: {`n
      toLight: "Passer au thème clair",`n
      toDark: "Passer au thème sombre",`n
    },`n
    languageToggle: {`n
      label: "Choisir la langue",`n
      languages: {`n
        fr: {`n
          label: "Français",`n
          title: "Afficher l'interface en français",`n
        },`n
        en: {`n
          label: "Anglais",`n
          title: "Afficher l'interface en anglais",`n
        },`n
      },`n
    },`n
    common: {`n
      backToHome: "Revenir à l'accueil",`n
    },`n
    home: {`n
      badge: "Portail DMF",`n
      title: "Choisissez votre parcours",`n
      description:`n
        "Sélectionnez le module adapté à votre besoin : revue des fichiers ou génération d'un fichier mappé.",`n
      options: {`n
        review: {`n
          label: "Vérifier les fichiers",`n
          title: "Valider vos fichiers DMF",`n
          description:`n
            "Retrouvez le processus historique pour analyser les règles, les ajuster et lancer la validation Python.",`n
          action: "Accéder à la validation",`n
        },`n
        mapping: {`n
          label: "Fichier mappé",`n
          title: "Générez votre fichier mappé",`n
          description:`n
            "Exécutez le script de mapping pour transformer un template Excel selon vos règles personnalisées.",`n
          action: "Accéder au mapping",`n
        },`n
      },`n
    },`n
    mapping: {`n
      hero: {`n
        badge: "Mapping Excel",`n
        title: "Générez votre fichier mappé",`n
        description:`n
          "Utilisez le moteur Python pour appliquer vos règles de mapping et produire automatiquement un fichier mappé.",`n
        uploadLabel: "Déposez ou sélectionnez votre fichier Template",`n
        uploadHint: "Feuilles nécessaires : Template, Règles et onglets de mapping associés",`n
        unknownType: "Type non défini",`n
      },`n
      actions: {`n
        selectFile: "Sélectionner un fichier",`n
        changeFile: "Changer de fichier",`n
        removeFile: "Retirer le fichier",`n
        start: "Lancer le mapping",`n
        processing: "Mapping en cours…",`n
        download: "Télécharger le résultat",`n
      },`n
      status: {`n
        idle: "Importez un fichier Excel pour démarrer le mapping.",`n
        ready: (filename: string) => `Fichier prêt : ${filename}.`,`n
        processing: (filename: string) => `Mapping en cours pour ${filename}…`,`n
        success: (originalName: string) => `Mapping terminé. Téléchargez ${originalName}.`,`n
        error: (message: string) => `Erreur lors du mapping : ${message}`,`n
        genericError: "Le service de mapping a renvoyé une erreur.",`n
        networkError: "Erreur réseau : impossible de contacter le service de mapping.",`n
      },`n
      rules: {`n
        summary: (count: number) =>`n
          count > 0`n
            ? `${count} règle${count > 1 ? "s" : ""}``n
            : "Afficher les règles",`n
        editedBadge: "Modifié",`n
        description: "Prévisualisez et ajustez les instructions de la feuille Règles.",`n
        helper: "Les changements seront envoyés au script Python sous forme de JSON.",`n
        emptyState: {`n
          description:`n
            "Aucune règle détectée. Créez des instructions manuellement pour les colonnes à générer.",`n
        },`n
        addButton: "Ajouter une règle",`n
        removeButton: "Supprimer",`n
        ruleLabel: (index: number) => `Règle ${index}`,`n
        targetLabel: "Colonne cible",`n
        targetPlaceholder: "Nom de la colonne générée",`n
        targetError: "La colonne cible est obligatoire.",`n
        typeLabel: "Type de règle",`n
        typeHelper: "Choisissez comment remplir la colonne cible.",`n
        typeOptions: {`n
          column: "Copier une colonne du Template",`n
          mapping: "Feuille de correspondance",`n
          invariable: "Valeur fixe",`n
          ns: "Numérotation",`n
          concat: "Assembler des champs",`n
          custom: "Instruction avancée",`n
          empty: "Colonne vide",`n
        },`n
        typeDescriptions: {`n
          COLUMN:`n
            "Reproduit une colonne existante du Template.",`n
          MAPPING:`n
            "Recherche une valeur dans une feuille annexe à partir d'une colonne du Template.",`n
          INVARIABLE:`n
            "Applique la même valeur sur toutes les lignes.",`n
          NS:`n
            "Génère une séquence numérique selon le motif fourni (# pour les chiffres).",`n
          CONCAT:`n
            "Assemble plusieurs colonnes et textes pour produire la valeur finale.",`n
          CUSTOM:`n
            "Saisissez une instruction Rules personnalisée.",`n
          EMPTY:`n
            "Crée une colonne vide tout en conservant l'en-tête.",`n
        },`n
        fields: {`n
          column: {`n
            sourceLabel: "Colonne source Template",`n
            sourcePlaceholder: "Choisir une colonne",`n
            helper:`n
              "Indiquez le nom exact de la colonne à recopier depuis la feuille Template.",`n
          },`n
          invariable: {`n
            valueLabel: "Valeur appliquée",`n
            valuePlaceholder: "Ex : France",`n
            helper:`n
              "La valeur saisie sera écrite sur chaque ligne du fichier mappé.",`n
          },`n
          mapping: {`n
            sourceLabel: "Colonne Template",`n
            sourcePlaceholder: "Choisir une colonne",`n
            sheetLabel: "Feuille de correspondance",`n
            sheetPlaceholder: "Ex : Country",`n
            helper:`n
              "Renseignez la colonne Template à rechercher et l'onglet contenant la table de correspondance.",`n
          },`n
          ns: {`n
            patternLabel: "Motif de numérotation",`n
            patternPlaceholder: "Ex : DMF###",`n
            helper:`n
              "Utilisez # pour chaque chiffre à incrémenter (ex : DMF### donnera DMF001, DMF002, …).",`n
          },`n
          concat: {`n
            expressionLabel: "Expression de concaténation",`n
            expressionPlaceholder: "Ex : COLUMN1 + ' - ' + COLUMN2",`n
            helper:`n
              "Combinez des colonnes Template et du texte entre apostrophes.",`n
          },`n
          custom: {`n
            instructionLabel: "Instruction personnalisée",`n
            instructionPlaceholder: "Ex : VALUE=A;B;C",`n
            helper:`n
              "Saisissez librement une instruction Rules avancée.",`n
          },`n
          empty: {`n
            helper:`n
              "La colonne restera vide ; utilisez-la pour forcer une colonne dans le résultat.",`n
          },`n
        },`n
        examples: {`n
          COLUMN: "Ex. : copie la colonne 'NuméroCompte'.",`n
          MAPPING: "Ex. : cherche 'Pays' dans la feuille 'Pays'.",`n
          INVARIABLE: "Ex. : met 'France' sur toutes les lignes.",`n
          NS: "Ex. : DMF### donne DMF001, DMF002…",`n
          CONCAT: "Ex. : COLONNE1 + ' - ' + COLONNE2.",`n
          CUSTOM: "Instruction avancée si nécessaire.",`n
          EMPTY: "Colonne vide (aucune instruction).",`n
        },`n
        detailError:`n
          "Complétez les informations de la règle sélectionnée.",`n
        detailWarning:`n
          "Vérifiez chaque règle avant de lancer le mapping.",`n
        launchWarning:`n
          "Complétez toutes les colonnes cibles avant de lancer le mapping.",`n
      },`n
      tips: {`n
        title: "Conseils d'utilisation",`n
        items: [`n
          "Assurez-vous que les onglets Template et Rules sont présents et complétés.",`n
          "Les feuilles mentionnées dans les règles MAPPING= doivent exister dans votre fichier Excel.",`n
          "Le fichier généré porte automatiquement le suffixe _mapping pour être identifié facilement.",`n
        ],`n
      },`n
    },`n
    hero: {`n
      badge: "Validation Excel",`n
      title: "Validation DMF",`n
      description:`n
        "Déposez votre template Excel pour visualiser les règles, personnalisez-les dans l'application puis lancez la validation Python.",`n
      uploadLabel: "Déposer un fichier Excel",`n
      uploadHint: "Feuilles attendues: Template & ValidationRules",`n
      selectButton: "Sélectionner un fichier",`n
      changeButton: "Changer de fichier",`n
      unknownType: "Type non défini",`n
    },`n
    rules: {`n
      heading: "Règles détectées",`n
      description:`n
        "Interprétation lisible de la feuille ValidationRules et édition directement dans l'interface.",`n
      helper:`n
        "Les modifications seront envoyées au service Python sous forme de JSON si vous lancez la validation.",`n
      summary: (count: number) =>`n
        count > 0 ? `${count} règle${count > 1 ? "s" : ""}` : "Afficher les règles",`n
      editedBadge: "Modifié",`n
      countLabel: (count: number) => `${count} règle${count > 1 ? "s" : ""}`,`n
      ruleLabel: (index: number) => `Règle ${index}`,`n
      addButton: "Ajouter une règle",`n
      removeButton: "Supprimer",`n
      tipTitle: "Conseils d'utilisation",`n
      tips: [`n
        "Activez ou désactivez les contrôles comme dans la feuille Excel.",`n
        "Basculer sur « Instruction » permet de référencer une feuille annexe avec SHEET=NomFeuille.",`n
        "Ajoutez autant de valeurs autorisées que nécessaire en saisissant une valeur par ligne.",`n
      ],`n
      emptyState: {`n
        description:`n
          "Aucune règle à afficher pour l'instant. Importez un fichier ou créez votre première règle pour démarrer la configuration.",`n
        action: "Créer une première règle",`n
      },`n
      field: {`n
        label: "Champ",`n
        placeholder: "Nom du champ dans la feuille Template",`n
        error: "Le nom du champ est requis pour lancer la validation.",`n
      },`n
      toggles: {`n
        checked: "Checker activé",`n
        required: "Champ obligatoire",`n
      },`n
      length: {`n
        minLabel: "Taille min",`n
        maxLabel: "Taille max",`n
        placeholder: "Optionnel",`n
      },`n
      pattern: {`n
        label: "Pattern (RegExp)",`n
        placeholder: "Ex: ^[0-9]{5}$",`n
      },`n
      customRule: {`n
        label: "Règle personnalisée",`n
        placeholder: "Nom de la fonction Python personnalisée",`n
      },`n
      allowed: {`n
        label: "Source des valeurs autorisées",`n
        options: {`n
          list: "Liste de valeurs",`n
          instruction: "Instruction (VALUE=, SHEET=, etc.)",`n
        },`n
        valuesLabel: "Valeurs autorisées",`n
        valuesPlaceholder: "Saisissez une valeur par ligne",`n
        valuesHint: "Ces valeurs seront converties en instruction VALUE= lors de la validation.",`n
        instructionLabel: "Instruction AllowedValues",`n
        instructionPlaceholder: "Ex: SHEET=AnnuaireCodes ou VALUE=A;B;C",`n
        instructionHint:`n
          "Utilisez SHEET=NomFeuille pour charger une feuille annexe ou toute instruction personnalisée.",`n
      },`n
      detailWarning:`n
        "Complétez les informations de chaque règle avant de lancer la validation.",`n
      launchWarning:`n
        "Indiquez un champ pour chaque règle afin de pouvoir lancer la validation.",`n
    },`n
    footer: {`n
      removeFile: "Supprimer le fichier",`n
      startValidation: "Lancer la validation Python",`n
      validating: "Validation…",`n
      downloadReport: "Télécharger le rapport",`n
    },`n
    statuses: {`n
      default:`n
        "Aucun fichier importé. Déposez un template Excel ou créez vos règles manuellement.",`n
      awaiting: "Règles personnalisées en attente de validation.",`n
      newRule: "Nouvelle règle ajoutée. Complétez-la avant la validation.",`n
      rulesUpdated: "Règles mises à jour.",`n
      analyzing: (filename: string) => `Analyse de ${filename}…`,`n
      analyzed:`n
        "Fichier analysé. Modifiez les règles si nécessaire avant validation.",`n
      importedTemplate:`n
        'Aucune règle trouvée. Les colonnes de la feuille "Template" ont été importées comme base par défaut.',`n
      importedNoHeaders:`n
        'Aucune règle trouvée et aucun en-tête détecté dans la feuille "Template". Ajoutez vos règles manuellement.',`n
      readError: "Erreur lors de la lecture du fichier. Vérifiez le format Excel.",`n
      validating: "Validation en cours…",`n
      validationError: (message: string) => `Erreur validation: ${message}`,`n
      validationFailed: "La validation a échoué.",`n
      validationSuccess: "Validation terminée.",`n
      networkError:`n
        "Erreur réseau: impossible de contacter le service de validation.",`n
    },`n
  },`n
  en: {`n
    themeToggle: {`n
      toLight: "Switch to light mode",`n
      toDark: "Switch to dark mode",`n
    },`n
    languageToggle: {`n
      label: "Choose language",`n
      languages: {`n
        fr: {`n
          label: "French",`n
          title: "Switch interface to French",`n
        },`n
        en: {`n
          label: "English",`n
          title: "Switch interface to English",`n
        },`n
      },`n
    },`n
    common: {`n
      backToHome: "Back to home",`n
    },`n
    home: {`n
      badge: "DMF workspace",`n
      title: "Choose your workflow",`n
      description:`n
        "Pick the module that matches your needs: review existing files or generate a mapped file.",`n
      options: {`n
        review: {`n
          label: "Review files",`n
          title: "Validate your DMF files",`n
          description:`n
            "Use the historical process to inspect the rules, adjust them and launch the Python validation.",`n
          action: "Go to validation",`n
        },`n
        mapping: {`n
          label: "Mapping files",`n
          title: "Produce a mapped file",`n
          description:`n
            "Run the mapping script on your Excel template to generate the transformed workbook.",`n
          action: "Go to mapping",`n
        },`n
      },`n
    },`n
    mapping: {`n
      hero: {`n
        badge: "Excel mapping",`n
        title: "Generate your mapped file",`n
        description:`n
          "Use the Python engine to apply the Rules sheet instructions and automatically produce a mapped workbook.",`n
        uploadLabel: "Drop or select your Template file",`n
        uploadHint: "Required sheets: Template, Rules and referenced mapping tabs",`n
        unknownType: "Unknown type",`n
      },`n
      actions: {`n
        selectFile: "Select a file",`n
        changeFile: "Change file",`n
        removeFile: "Remove file",`n
        start: "Start mapping",`n
        processing: "Mapping in progress…",`n
        download: "Download result",`n
      },`n
      status: {`n
        idle: "Upload an Excel file to start the mapping run.",`n
        ready: (filename: string) => `File ready: ${filename}.`,`n
        processing: (filename: string) => `Mapping ${filename}…`,`n
        success: (originalName: string) => `Mapping completed. Download ${originalName}.`,`n
        error: (message: string) => `Mapping failed: ${message}`,`n
        genericError: "The mapping service returned an error.",`n
        networkError: "Network error: unable to reach the mapping service.",`n
      },`n
      rules: {`n
        summary: (count: number) =>`n
          count > 0 ? `${count} rule${count > 1 ? "s" : ""}` : "Show rules",`n
        editedBadge: "Edited",`n
        description: "Review and tweak the instructions coming from the Rules sheet.",`n
        helper: "Changes are sent to the Python script as JSON overrides.",`n
        emptyState: {`n
          description: "No rule detected. Create instructions manually for the generated columns.",`n
        },`n
        addButton: "Add a rule",`n
        removeButton: "Delete",`n
        ruleLabel: (index: number) => `Rule ${index}`,`n
        targetLabel: "Target column",`n
        targetPlaceholder: "Name of the generated column",`n
        targetError: "Target column is required.",`n
        typeLabel: "Rule type",`n
        typeHelper: "Choose how to populate the target column.",`n
        typeOptions: {`n
          column: "Copy a Template column",`n
          mapping: "Mapping sheet lookup",`n
          invariable: "Fixed value",`n
          ns: "Sequential numbering",`n
          concat: "Concatenate fields",`n
          custom: "Advanced instruction",`n
          empty: "Empty column",`n
        },`n
        typeDescriptions: {`n
          COLUMN:`n
            "Copies an existing column from the Template sheet.",`n
          MAPPING:`n
            "Looks up a value from another sheet using a Template column.",`n
          INVARIABLE:`n
            "Applies the same value to every row.",`n
          NS:`n
            "Generates a numeric sequence based on the provided pattern (# equals one digit).",`n
          CONCAT:`n
            "Combines columns and literals into a single result.",`n
          CUSTOM:`n
            "Enter a custom Rules instruction.",`n
          EMPTY:`n
            "Keeps an empty column in the output.",`n
        },`n
        fields: {`n
          column: {`n
            sourceLabel: "Template source column",`n
            sourcePlaceholder: "Select a column",`n
            helper:`n
              "Provide the exact Template column name to copy.",`n
          },`n
          invariable: {`n
            valueLabel: "Value to apply",`n
            valuePlaceholder: "Eg: France",`n
            helper:`n
              "This value will be written on every row of the mapped file.",`n
          },`n
          mapping: {`n
            sourceLabel: "Template column",`n
            sourcePlaceholder: "Select a column",`n
            sheetLabel: "Mapping sheet",`n
            sheetPlaceholder: "Eg: Country",`n
            helper:`n
              "Specify the Template column to search and the sheet containing the lookup table.",`n
          },`n
          ns: {`n
            patternLabel: "Numbering pattern",`n
            patternPlaceholder: "Eg: DMF###",`n
            helper:`n
              "Use # for each incremented digit (e.g. DMF### becomes DMF001, DMF002, …).",`n
          },`n
          concat: {`n
            expressionLabel: "Concatenation expression",`n
            expressionPlaceholder: "Eg: COLUMN1 + ' - ' + COLUMN2",`n
            helper:`n
              "Combine Template columns and quoted text.",`n
          },`n
          custom: {`n
            instructionLabel: "Custom instruction",`n
            instructionPlaceholder: "Eg: VALUE=A;B;C",`n
            helper:`n
              "Enter any advanced Rules instruction.",`n
          },`n
          empty: {`n
            helper:`n
              "The column remains empty; use it to force a header in the result.",`n
          },`n
        },`n
        examples: {`n
          COLUMN: "E.g.: copies the 'AccountNumber' column.",`n
          MAPPING: "E.g.: looks up 'Country' in the 'Country' sheet.",`n
          INVARIABLE: "E.g.: writes 'France' on every row.",`n
          NS: "E.g.: DMF### becomes DMF001, DMF002…",`n
          CONCAT: "E.g.: Account + ' - ' + Name.",`n
          CUSTOM: "Advanced instruction if needed.",`n
          EMPTY: "Empty column (no instruction).",`n
        },`n
        detailError:`n
          "Complete the selected rule information.",`n
        detailWarning:`n
          "Review every rule before launching the mapping.",`n
        launchWarning:`n
          "Fill every target column before running the mapping.",`n
      },`n
      tips: {`n
        title: "Usage tips",`n
        items: [`n
          "Make sure the Template and Rules sheets are present and filled in.",`n
          "Sheets referenced in MAPPING= rules must exist in your workbook.",`n
          "The generated file automatically receives the _mapping suffix for easier identification.",`n
        ],`n
      },`n
    },`n
    hero: {`n
      badge: "Validation",`n
      title: "DMF validation",`n
      description:`n
        "Drop your Excel template to visualize the rules, customize them in the app, then launch the Python validation.",`n
      uploadLabel: "Upload an Excel file",`n
      uploadHint: "Expected sheets: Template & ValidationRules",`n
      selectButton: "Select a file",`n
      changeButton: "Change file",`n
      unknownType: "Unknown type",`n
    },`n
    rules: {`n
      heading: "Detected rules",`n
      description:`n
        "Readable interpretation of the ValidationRules sheet with direct editing in the interface.",`n
      helper:`n
        "Changes will be sent to the Python service as JSON overrides when you launch the validation.",`n
      summary: (count: number) =>`n
        count > 0 ? `${count} rule${count === 1 ? "" : "s"}` : "Show rules",`n
      editedBadge: "Edited",`n
      countLabel: (count: number) => `${count} rule${count === 1 ? "" : "s"}`,`n
      ruleLabel: (index: number) => `Rule ${index}`,`n
      addButton: "Add a rule",`n
      removeButton: "Delete",`n
      tipTitle: "Usage tips",`n
      tips: [`n
        "Enable or disable controls just like in the Excel sheet.",`n
        "Switching to \"Instruction\" lets you reference another sheet with SHEET=SheetName.",`n
        "Add as many allowed values as needed by entering one value per line.",`n
      ],`n
      emptyState: {`n
        description:`n
          "No rules to display yet. Import a file or create your first rule to start configuring.",`n
        action: "Create a first rule",`n
      },`n
      field: {`n
        label: "Field",`n
        placeholder: "Field name from the Template sheet",`n
        error: "Field name is required before launching validation.",`n
      },`n
      toggles: {`n
        checked: "Checker enabled",`n
        required: "Required field",`n
      },`n
      length: {`n
        minLabel: "Min length",`n
        maxLabel: "Max length",`n
        placeholder: "Optional",`n
      },`n
      pattern: {`n
        label: "Pattern (RegExp)",`n
        placeholder: "Example: ^[0-9]{5}$",`n
      },`n
      customRule: {`n
        label: "Custom rule",`n
        placeholder: "Name of the custom Python function",`n
      },`n
      allowed: {`n
        label: "Source of allowed values",`n
        options: {`n
          list: "Value list",`n
          instruction: "Instruction (VALUE=, SHEET=, etc.)",`n
        },`n
        valuesLabel: "Allowed values",`n
        valuesPlaceholder: "Enter one value per line",`n
        valuesHint:`n
          "These values will be converted into a VALUE= instruction during validation.",`n
        instructionLabel: "AllowedValues instruction",`n
        instructionPlaceholder:`n
          "e.g. SHEET=CodeDirectory or VALUE=A;B;C",`n
        instructionHint:`n
          "Use SHEET=SheetName to load an auxiliary sheet or any custom instruction.",`n
      },`n
      detailWarning: "Complete every rule before launching the validation.",`n
      launchWarning: "Provide a field name for each rule before starting the validation.",`n
    },`n
    footer: {`n
      removeFile: "Remove file",`n
      startValidation: "Start Python validation",`n
      validating: "Validating…",`n
      downloadReport: "Download report",`n
    },`n
    statuses: {`n
      default:`n
        "No file imported. Drop an Excel template or create your rules manually.",`n
      awaiting: "Custom rules waiting for validation.",`n
      newRule: "New rule added. Complete it before running the validation.",`n
      rulesUpdated: "Rules updated.",`n
      analyzing: (filename: string) => `Analyzing ${filename}…`,`n
      analyzed:`n
        "File analyzed. Edit the rules if needed before validation.",`n
      importedTemplate:`n
        'No rules found. Columns from the "Template" sheet were imported as the default base.',`n
      importedNoHeaders:`n
        'No rules found and no headers detected in the "Template" sheet. Add your rules manually.',`n
      readError: "Error while reading the file. Check the Excel format.",`n
      validating: "Validation in progress…",`n
      validationError: (message: string) => `Validation error: ${message}`,`n
      validationFailed: "Validation failed.",`n
      validationSuccess: "Validation completed.",`n
      networkError: "Network error: unable to reach the validation service.",`n
    },`n
  },`n
} as const;`n
`n
type Language = keyof typeof translations;`n
type Translation = (typeof translations)[Language];`n
`n
type LanguageContextValue = {`n
  language: Language;`n
  setLanguage: (language: Language) => void;`n
  content: Translation;`n
};`n
`n
const LanguageContext = createContext<LanguageContextValue | undefined>(`n
  undefined,`n
);`n
`n
export function LanguageProvider({ children }: { children: ReactNode }) {`n
  const [language, setLanguageState] = useState<Language>("fr");`n
  const [mounted, setMounted] = useState(false);`n
`n
  useEffect(() => {`n
    const stored = window.localStorage.getItem("dmf-language");`n
    let next: Language | undefined;`n
    if (stored === "en" || stored === "fr") {`n
      next = stored;`n
    } else if (typeof navigator !== "undefined" && typeof navigator.language === "string") {`n
      next = navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";`n
    } else {`n
      next = "fr";`n
    }`n
    setLanguageState(next);`n
    document.documentElement.lang = next;`n
    setMounted(true);`n
  }, []);`n
`n
  useEffect(() => {`n
    if (!mounted) return;`n
    window.localStorage.setItem("dmf-language", language);`n
    document.documentElement.lang = language;`n
  }, [language, mounted]);`n
`n
  const setLanguage = useCallback((next: Language) => {`n
    setLanguageState(next);`n
  }, []);`n
`n
  const value = useMemo<LanguageContextValue>(`n
    () => ({`n
      language,`n
      setLanguage,`n
      content: translations[language],`n
    }),`n
    [language, setLanguage],`n
  );`n
`n
  return (`n
    <LanguageContext.Provider value={value}>`n
      {children}`n
    </LanguageContext.Provider>`n
  );`n
}`n
`n
export function useLanguage() {`n
  const context = useContext(LanguageContext);`n
  if (!context) {`n
    throw new Error("useLanguage must be used within a LanguageProvider");`n
  }`n
  return context;`n
}`n
`n
export type { Language, Translation };`n
`n
`n
`n
`n
`n
`n
`n
`n
`n
`n

