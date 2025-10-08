import sys
import re
import os
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
import pandas as pd

def find_column(source_name, template_cols):
    for col in template_cols:
        if str(col).strip().lower() == str(source_name).strip().lower():
            return col
    return None

def parse_concat_expression(expression, template_row, template_cols):
    expression = expression.replace("'CONCAT=", "", 1).replace("CONCAT=", "", 1).strip()
    parts = [p.strip() for p in expression.split("+")]
    result = ""
    for part in parts:
        if part.startswith("'") and part.endswith("'"):
            result += part.strip("'")
        else:
            matched_col = find_column(part, template_cols)
            if matched_col:
                val = template_row.get(matched_col, "")
                result += "" if pd.isna(val) else str(val)
            else:
                result += ""
    return result

def build_result_dataframe(xls):
    try:
        template = xls["Template"]
        parameters = xls["Parameters"]
    except Exception as e:
        raise ValueError(f"Missing required sheets 'Template' and 'Parameters': {e}")

    result_df = pd.DataFrame()

    for _, row in parameters.iterrows():
        target_col = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        rule = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""

        if not target_col:
            continue

        # Empty rule creates an empty column
        if not rule or rule.lower() == "nan":
            result_df[target_col] = [""] * len(template)
            continue

        if rule.startswith("NS="):
            sequence_template = rule.split("NS=")[-1]
            num_hashes = sequence_template.count("#")
            prefix = sequence_template.split("#")[0]
            result_df[target_col] = [
                prefix + str(idx + 1).zfill(num_hashes) for idx in range(len(template))
            ]

        elif rule.startswith("INVARIABLE="):
            default_val = rule.split("INVARIABLE=")[-1]
            result_df[target_col] = [default_val] * len(template)

        elif rule.startswith("MAPPING="):
            try:
                tail = rule.split("MAPPING=")[-1]
                if ";" not in tail:
                    raise ValueError("Expected format MAPPING=<column>;<sheet>")
                value1, mapping_sheet = [s.strip() for s in tail.split(";", 1)]

                if mapping_sheet in xls:
                    mapping_df = xls[mapping_sheet]

                    # Detect key and value columns
                    if (mapping_sheet + "Mapping") in mapping_df.columns:
                        mapping_key_col = mapping_df.columns[0]
                        mapping_val_col = mapping_sheet + "Mapping"
                    else:
                        if len(mapping_df.columns) < 2:
                            raise ValueError("Mapping sheet needs at least 2 columns")
                        mapping_key_col = mapping_df.columns[0]
                        mapping_val_col = mapping_df.columns[1]

                    mapping_dict = dict(zip(mapping_df[mapping_key_col], mapping_df[mapping_val_col]))

                    matched_col = find_column(value1, template.columns)
                    if matched_col:
                        original_values = template[matched_col]
                        mapped_values = original_values.map(mapping_dict)
                        final_values = [
                            mapped if pd.notna(mapped) and str(mapped).lower() not in ["", "nan"] else original
                            for mapped, original in zip(mapped_values, original_values)
                        ]
                        result_df[target_col] = final_values
                    else:
                        result_df[target_col] = [""] * len(template)
                else:
                    result_df[target_col] = [""] * len(template)
            except Exception as e:
                print(f"Mapping error: {e}")
                result_df[target_col] = [""] * len(template)

        elif "CONCAT=" in rule:
            result_df[target_col] = [
                parse_concat_expression(rule, template.iloc[i], template.columns) or ""
                for i in range(len(template))
            ]

        elif "+" in rule:
            parts = [p.strip() for p in rule.split("+")]
            concat_values = []
            for i in range(len(template)):
                concat = ""
                for p in parts:
                    matched = find_column(p, template.columns)
                    if matched:
                        val = template.iloc[i][matched]
                        concat += "" if pd.isna(val) else str(val)
                    elif p.startswith("'") and p.endswith("'"):
                        concat += p.strip("'")
                    else:
                        concat += ""
                concat_values.append(concat)
            result_df[target_col] = concat_values

        elif rule.startswith("COLUMN="):
            source_col = rule.split("COLUMN=")[-1].strip()
            matched_col = find_column(source_col, template.columns)
            if matched_col:
                result_df[target_col] = template[matched_col]
            else:
                result_df[target_col] = [""] * len(template)
        else:
            # Unknown rule -> empty column but keep the header so nothing breaks
            result_df[target_col] = [""] * len(template)

    return result_df

def process_file(filepath, output_folder):
    try:
        xls = pd.read_excel(filepath, sheet_name=None, engine="openpyxl", keep_default_na=False)
    except Exception as e:
        messagebox.showerror("Error", f"Cannot read '{os.path.basename(filepath)}': {e}")
        return

    try:
        result_df = build_result_dataframe(xls)
    except Exception as e:
        messagebox.showerror("Error", f"Failed to build result for '{os.path.basename(filepath)}': {e}")
        return

    original_filename = os.path.splitext(os.path.basename(filepath))[0]
    default_name = f"{original_filename}_result.xlsx"

    # Ask user for the output file name inside the chosen folder
    base_name = simpledialog.askstring(
        "Output file name",
        f"Enter a name for the output file for:\n{os.path.basename(filepath)}",
        initialvalue=default_name
    )
    if not base_name:
        messagebox.showwarning("Skipped", f"Skipped saving for '{os.path.basename(filepath)}'.")
        return

    # Ensure .xlsx extension
    if not base_name.lower().endswith(".xlsx"):
        base_name += ".xlsx"

    output_path = os.path.join(output_folder, base_name)

    try:
        result_df.to_excel(output_path, index=False)
        messagebox.showinfo("Success", f"Generated:\n{output_path}")
    except Exception as e:
        messagebox.showerror("Error", f"Failed to save '{base_name}': {e}")

def select_files_and_run():
    filepaths = filedialog.askopenfilenames(
        title="Select one or more Excel files",
        filetypes=[("Excel files", "*.xlsx *.xlsm")]
    )
    if not filepaths:
        messagebox.showwarning("Cancelled", "No files selected.")
        return

    output_folder = filedialog.askdirectory(title="Select Output Folder")
    if not output_folder:
        messagebox.showwarning("Cancelled", "No output folder selected.")
        return

    for fp in filepaths:
        process_file(fp, output_folder)

if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    select_files_and_run()
