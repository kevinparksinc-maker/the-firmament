#!/usr/bin/env python3
"""
apply_firmament_upgrades.py

Selectively copies the REAL source-code changes from the Manus zip
(firmament_updated.zip, extracted) into your live The-Firmament project.

Skips: .env / key.env / key.env.save, .bak files, .manus-logs,
_local_fix_scripts, and anything else not on the explicit allow-list below.

Asks for per-file confirmation before overwriting anything, and makes a
timestamped .bak of every file it touches so you can revert instantly.

USAGE:
    python3 apply_firmament_upgrades.py --src /path/to/extracted/The-Firmament --dest /path/to/your/live/The-Firmament

If you don't pass --src / --dest, it will prompt you for both.
"""

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Only these files get touched. Add to this list if you want more copied over.
ALLOWED_FILES = [
    "client/src/lib/astroEngine.ts",
    "server/horary.ts",
    "server/routers.ts",
    "server/firmamentKnowledge.ts",
    "client/src/pages/Home.tsx",
]


def confirm(prompt: str) -> bool:
    resp = input(f"{prompt} [y/N]: ").strip().lower()
    return resp in ("y", "yes")


def main():
    parser = argparse.ArgumentParser(description="Apply vetted Firmament upgrades file-by-file.")
    parser.add_argument("--src", type=str, help="Path to extracted zip's The-Firmament folder")
    parser.add_argument("--dest", type=str, help="Path to your live The-Firmament project")
    parser.add_argument("--yes-to-all", action="store_true", help="Skip per-file confirmation (not recommended)")
    args = parser.parse_args()

    src_root = Path(args.src or input("Path to extracted zip's The-Firmament folder: ").strip()).expanduser().resolve()
    dest_root = Path(args.dest or input("Path to your LIVE The-Firmament project: ").strip()).expanduser().resolve()

    if not src_root.is_dir():
        sys.exit(f"Source not found: {src_root}")
    if not dest_root.is_dir():
        sys.exit(f"Destination not found: {dest_root}")

    print(f"\nSource:      {src_root}")
    print(f"Destination: {dest_root}\n")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    applied, skipped, missing = [], [], []

    for rel_path in ALLOWED_FILES:
        src_file = src_root / rel_path
        dest_file = dest_root / rel_path

        if not src_file.is_file():
            print(f"⚠ Not found in zip, skipping: {rel_path}")
            missing.append(rel_path)
            continue

        print("-" * 60)
        print(f"FILE: {rel_path}")
        if dest_file.is_file():
            same = dest_file.read_bytes() == src_file.read_bytes()
            if same:
                print("  -> identical to your live file, nothing to do.")
                skipped.append(rel_path)
                continue
            print(f"  -> differs from your live version ({dest_file.stat().st_size} bytes -> {src_file.stat().st_size} bytes)")
        else:
            print("  -> new file, does not exist in your live project yet")

        do_copy = args.yes_to_all or confirm("  Apply this file?")
        if not do_copy:
            print("  Skipped.")
            skipped.append(rel_path)
            continue

        dest_file.parent.mkdir(parents=True, exist_ok=True)
        if dest_file.is_file():
            backup_path = dest_file.with_name(f"{dest_file.name}.bak.{timestamp}")
            shutil.copy2(dest_file, backup_path)
            print(f"  Backed up existing file to: {backup_path.name}")

        shutil.copy2(src_file, dest_file)
        print(f"  Applied -> {dest_file}")
        applied.append(rel_path)

    print("\n" + "=" * 60)
    print(f"Applied: {len(applied)}")
    for f in applied:
        print(f"  ✓ {f}")
    print(f"Skipped: {len(skipped)}")
    for f in skipped:
        print(f"  - {f}")
    if missing:
        print(f"Missing from zip: {len(missing)}")
        for f in missing:
            print(f"  ! {f}")

    print("\nReminder: .env / key.env / key.env.save / .bak files / _local_fix_scripts / .manus-logs")
    print("were intentionally NOT touched. Your live secrets are untouched.")
    print("\nOuter-planet scoring in astroEngine.ts is now live if you applied that file --")
    print("dignity/rulership tables for Uranus/Neptune/Pluto still need to be built out.")


if __name__ == "__main__":
    main()
