from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.mapping.mapper import MappingError, generate_mapped_workbook  # noqa: E402


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "Usage: python mapping_runner.py <input_excel> <output_dir> [output_name]",
            file=sys.stderr,
        )
        return 1

    input_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    output_name = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        destination = generate_mapped_workbook(input_path, output_dir, output_name)
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
