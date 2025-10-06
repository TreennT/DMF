import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.dmf_validation.validator import generate_result_from_excel  # type: ignore  # noqa: E402
from tkinter import messagebox  # type: ignore  # noqa: E402

messages: list[str] = []


def _info(title: str, message: str) -> None:
    messages.append(f"INFO:{message}")


def _warning(title: str, message: str) -> None:
    messages.append(f"WARN:{message}")


def _error(title: str, message: str) -> None:
    messages.append(f"ERROR:{message}")
    raise RuntimeError(message)


messagebox.showinfo = _info  # type: ignore[assignment]
messagebox.showwarning = _warning  # type: ignore[assignment]
messagebox.showerror = _error  # type: ignore[assignment]


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python python_runner.py <input_excel> <output_dir>", file=sys.stderr)
        return 1

    input_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()

    try:
        generate_result_from_excel(str(input_path), str(output_dir))
    except Exception as exc:  # noqa: BLE001
        if all(not msg.startswith("ERROR:") for msg in messages):
            messages.append(f"ERROR:{exc}")
        for msg in messages:
            print(msg, file=sys.stderr)
        return 1

    for msg in messages:
        print(msg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
