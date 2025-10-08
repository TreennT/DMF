from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.mapping.mapper import MappingError, generate_mapped_workbook  # noqa: E402


def _sanitize_rules(payload: Any) -> list[dict[str, str]]:
    if not isinstance(payload, list):
        return []

    sanitized: list[dict[str, str]] = []
    for entry in payload:
        if not isinstance(entry, dict):
            continue

        target_raw = entry.get("target", "")
        rule_raw = entry.get("rule", "")

        target = str(target_raw).strip()
        if not target:
            continue

        rule = "" if rule_raw is None else str(rule_raw).strip()
        sanitized.append({"target": target, "rule": rule})

    return sanitized


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "Usage: python mapping_runner.py <input_excel> <output_dir> [output_name] [rules_json]",
            file=sys.stderr,
        )
        return 1

    input_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    output_name = sys.argv[3] if len(sys.argv) > 3 else None
    rules_path = Path(sys.argv[4]).resolve() if len(sys.argv) > 4 else None

    rules_override = None
    if rules_path is not None:
        try:
            payload = json.loads(rules_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR:Failed to read rules override: {exc}", file=sys.stderr)
            return 1

        rules_override = _sanitize_rules(payload)

    try:
        destination = generate_mapped_workbook(
            input_path,
            output_dir,
            output_name,
            rules_override=rules_override,
        )
    except MappingError as exc:
        print(f"ERROR:{exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR:{exc}", file=sys.stderr)
        return 1

    print(f"RESULT:{destination.name}")
    print(f"INFO:Generated {destination.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
