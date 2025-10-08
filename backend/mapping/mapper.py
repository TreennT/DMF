from __future__ import annotations

from pathlib import Path
from typing import Iterable, Mapping, Sequence

import pandas as pd


class MappingError(Exception):
    """Raised when the mapping engine fails to produce a result."""


def _find_column(source_name: str, template_cols: Iterable[str]) -> str | None:
    lowered = str(source_name).strip().lower()
    for col in template_cols:
        if str(col).strip().lower() == lowered:
            return str(col)
    return None


def _parse_concat_expression(
    expression: str, template_row: pd.Series, template_cols: Iterable[str]
) -> str:
    cleaned = expression.replace("'CONCAT=", "", 1).replace("CONCAT=", "", 1).strip()
    parts = [part.strip() for part in cleaned.split("+")]
    result = ""
    for part in parts:
        if part.startswith("'") and part.endswith("'"):
            result += part.strip("'")
            continue

        matched_col = _find_column(part, template_cols)
        if matched_col is None:
            continue

        value = template_row.get(matched_col, "")
        result += "" if pd.isna(value) else str(value)
    return result


def _build_result_dataframe(
    xls: dict[str, pd.DataFrame],
    rules_override: Sequence[Mapping[str, str]] | None = None,
) -> pd.DataFrame:
    try:
        template = xls["Template"]
    except KeyError as exc:  # pragma: no cover - defensive programming
        raise MappingError("Missing required sheet 'Template'.") from exc

    if rules_override is not None:
        if rules_override:
            parameters = pd.DataFrame(
                [(entry["target"], entry.get("rule", "")) for entry in rules_override],
                columns=["Target", "Rule"],
            )
        else:
            parameters = pd.DataFrame(columns=["Target", "Rule"])
    else:
        try:
            parameters = xls["Parameters"]
        except KeyError as exc:  # pragma: no cover - defensive programming
            raise MappingError("Missing required sheet 'Parameters'.") from exc

    result_df = pd.DataFrame()

    for _, row in parameters.iterrows():
        target_col = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        rule = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""

        if not target_col:
            continue

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
            continue

        if rule.startswith("INVARIABLE="):
            default_val = rule.split("INVARIABLE=")[-1]
            result_df[target_col] = [default_val] * len(template)
            continue

        if rule.startswith("MAPPING="):
            tail = rule.split("MAPPING=")[-1]
            if ";" not in tail:
                raise MappingError("Expected format MAPPING=<column>;<sheet>.")

            value1, mapping_sheet = [segment.strip() for segment in tail.split(";", 1)]
            mapping_df = xls.get(mapping_sheet)
            if mapping_df is None:
                result_df[target_col] = [""] * len(template)
                continue

            if f"{mapping_sheet}Mapping" in mapping_df.columns:
                mapping_key_col = str(mapping_df.columns[0])
                mapping_val_col = f"{mapping_sheet}Mapping"
            else:
                if len(mapping_df.columns) < 2:
                    raise MappingError("Mapping sheet needs at least 2 columns.")
                mapping_key_col = str(mapping_df.columns[0])
                mapping_val_col = str(mapping_df.columns[1])

            mapping_dict = dict(zip(mapping_df[mapping_key_col], mapping_df[mapping_val_col]))

            matched_col = _find_column(value1, template.columns)
            if matched_col is None:
                result_df[target_col] = [""] * len(template)
                continue

            original_values = template[matched_col]
            mapped_values = original_values.map(mapping_dict)
            final_values = [
                mapped if pd.notna(mapped) and str(mapped).strip().lower() not in {"", "nan"} else original
                for mapped, original in zip(mapped_values, original_values)
            ]
            result_df[target_col] = final_values
            continue

        if "CONCAT=" in rule:
            result_df[target_col] = [
                _parse_concat_expression(rule, template.iloc[i], template.columns) or ""
                for i in range(len(template))
            ]
            continue

        if "+" in rule:
            parts = [part.strip() for part in rule.split("+")]
            concat_values: list[str] = []
            for i in range(len(template)):
                concat = ""
                for part in parts:
                    matched = _find_column(part, template.columns)
                    if matched:
                        val = template.iloc[i][matched]
                        concat += "" if pd.isna(val) else str(val)
                    elif part.startswith("'") and part.endswith("'"):
                        concat += part.strip("'")
                concat_values.append(concat)
            result_df[target_col] = concat_values
            continue

        if rule.startswith("COLUMN="):
            source_col = rule.split("COLUMN=")[-1].strip()
            matched_col = _find_column(source_col, template.columns)
            if matched_col is not None:
                result_df[target_col] = template[matched_col]
            else:
                result_df[target_col] = [""] * len(template)
            continue

        # Unknown rule -> empty column but keep the header so nothing breaks
        result_df[target_col] = [""] * len(template)

    return result_df


def generate_mapped_workbook(
    input_excel: str | Path,
    output_dir: str | Path,
    output_name: str | None = None,
    *,
    rules_override: Sequence[Mapping[str, str]] | None = None,
) -> Path:
    input_path = Path(input_excel).resolve()
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    try:
        xls = pd.read_excel(
            input_path,
            sheet_name=None,
            engine="openpyxl",
            keep_default_na=False,
        )
    except Exception as exc:  # noqa: BLE001
        raise MappingError(f"Cannot read '{input_path.name}': {exc}") from exc

    try:
        result_df = _build_result_dataframe(xls, rules_override)
    except MappingError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise MappingError(
            f"Failed to build result for '{input_path.name}': {exc}"
        ) from exc

    default_name = f"{input_path.stem}_result.xlsx"
    final_name = (output_name or default_name).strip() or default_name
    if not final_name.lower().endswith(".xlsx"):
        final_name = f"{final_name}.xlsx"

    destination = output_path / final_name

    try:
        result_df.to_excel(destination, index=False)
    except Exception as exc:  # noqa: BLE001
        raise MappingError(f"Failed to save '{final_name}': {exc}") from exc

    return destination
