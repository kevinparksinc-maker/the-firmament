#!/usr/bin/env python3
"""
Fixes the botched patch from wire_aspect_motion.py (raw-string escaping bug
put literal backslash-n and backslash-quote characters into the TS file
instead of real newlines/quotes).

Run from repo root: python3 fix_aspect_motion_patch.py
"""

import re
import glob
import sys
from pathlib import Path

PATTERN_ENGINE = Path("server") / "patternEngine.ts"


def find_latest_backup() -> Path:
    candidates = sorted(glob.glob("server/patternEngine.ts.bak.*"))
    if not candidates:
        print("✗ No backup found — cannot safely restore. Aborting.")
        sys.exit(1)
    return Path(candidates[-1])


def main():
    backup_path = find_latest_backup()
    print(f"Restoring from {backup_path}...")
    text = backup_path.read_text()

    if "getAspectMotion" in text:
        print("✗ Backup already contains a patch attempt — grab an earlier backup or paste the file so I can inspect it directly.")
        sys.exit(1)

    # 1. Add import after last import line
    lines = text.split("\n")
    last_import_idx = max(
        (i for i, l in enumerate(lines) if l.strip().startswith("import ")),
        default=-1,
    )
    lines.insert(last_import_idx + 1, 'import { getAspectMotion } from "./aspectMotion";')
    text = "\n".join(lines)

    # 2. Extend RawAspect interface with `motion` field (proper escaping this time)
    text = re.sub(
        r"(orb:\s*number;)",
        lambda m: m.group(1) + "\n  motion: \"applying\" | \"separating\" | \"exact\";",
        text,
        count=1,
    )

    # 3. Inject signed delta + motion calc before the strength calc
    old_block = "if (delta <= def.orb) {\n          const strength = 1 - delta / def.orb;\n"
    if old_block not in text:
        print("✗ Could not find expected block in restored file. Aborting — paste server/patternEngine.ts around 'detectAspects' so I can patch it directly.")
        sys.exit(1)

    new_block = (
        "if (delta <= def.orb) {\n"
        "          const strength = 1 - delta / def.orb;\n"
        "          const signedDelta = diff - def.angle;\n"
        "          const motion = getAspectMotion(\n"
        "            name1,\n"
        "            name2,\n"
        "            signedDelta,\n"
        "            def.angle\n"
        "          );\n"
    )
    text = text.replace(old_block, new_block, 1)

    # 4. Add motion field to the pushed aspect object (proper newline this time)
    text = re.sub(
        r"(aspects\.push\(\{[^}]*?orb:\s*delta,)",
        lambda m: m.group(1) + "\n            motion,",
        text,
        count=1,
        flags=re.DOTALL,
    )

    PATTERN_ENGINE.write_text(text)
    print(f"✓ rewrote {PATTERN_ENGINE} cleanly")
    print("\nNow run: npx tsc --noEmit server/patternEngine.ts server/aspectMotion.ts")


if __name__ == "__main__":
    main()
