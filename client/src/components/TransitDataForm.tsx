#!/usr/bin/env python3
"""
apply_transit_form.py
Run from your project root:
    python3 apply_transit_form.py

What it does:
  1. Copies TransitDataForm.tsx into src/components/
  2. Patches Home.tsx — adds the import + replaces the transit Panel block
"""

import os
import re
import shutil

# ── Paths (adjust if your structure differs) ───────────────────────────────────
COMPONENTS_DIR = "src/components"
HOME_TSX       = "src/app/page.tsx"   # change to your actual Home.tsx path

# If Home.tsx lives at src/components/Home.tsx, update the line above.
# Common locations:
#   src/app/page.tsx
#   src/pages/index.tsx
#   src/components/Home.tsx

TRANSIT_FORM_SOURCE = os.path.join(os.path.dirname(__file__), "TransitDataForm.tsx")

# ── 1. Copy TransitDataForm.tsx into components ────────────────────────────────
dest = os.path.join(COMPONENTS_DIR, "TransitDataForm.tsx")
os.makedirs(COMPONENTS_DIR, exist_ok=True)
shutil.copy2(TRANSIT_FORM_SOURCE, dest)
print(f"✓ Copied TransitDataForm.tsx → {dest}")

# ── 2. Patch Home.tsx ──────────────────────────────────────────────────────────
with open(HOME_TSX, "r", encoding="utf-8") as f:
    src = f.read()

# 2a. Add import if not already there
IMPORT_LINE = "import { TransitDataForm } from '@/components/TransitDataForm';"
if IMPORT_LINE not in src:
    # Insert after the last existing @/components import
    src = re.sub(
        r"(import \{ SavedChartManager \} from '@/components/SavedChartManager';)",
        r"\1\n" + IMPORT_LINE,
        src,
    )
    print("✓ Added TransitDataForm import")
else:
    print("· Import already present, skipping")

# 2b. Replace the transit Panel block
OLD_PANEL = """        <Panel title="Current Transits" onClear={transitInput ? () => { setTransitInput(''); setTransitResetKey(k => k + 1); } : undefined}>
          <ScreenshotUploader type="transit" onTextExtracted={handleTransitExtracted} disabled={loading} resetKey={transitResetKey} />
          <textarea value={transitInput} onChange={e => setTransitInput(e.target.value)} placeholder={TRANSIT_PLACEHOLDER}
            style={{ ...textareaStyle, marginTop: '10px' }}
            onFocus={e => (e.target.style.borderColor = 'var(--ice)')}
            onBlur={e => (e.target.style.borderColor = 'var(--rim)')} />
          <div style={hintStyle}>Optional — add transits for a full current-moment reading.</div>
        </Panel>"""

NEW_PANEL = """        <Panel title="Current Transits" onClear={transitInput ? () => { setTransitInput(''); setTransitResetKey(k => k + 1); } : undefined}>
          <TransitDataForm
            onTransitCalculated={(readingText, _planets, lat, lng) => {
              setTransitInput(readingText);
              setObserverLat(lat);
              setObserverLng(lng);
            }}
            disabled={loading}
          />
          <ScreenshotUploader type="transit" onTextExtracted={handleTransitExtracted} disabled={loading} resetKey={transitResetKey} />
          <textarea value={transitInput} onChange={e => setTransitInput(e.target.value)} placeholder={TRANSIT_PLACEHOLDER}
            style={{ ...textareaStyle, marginTop: '10px' }}
            onFocus={e => (e.target.style.borderColor = 'var(--ice)')}
            onBlur={e => (e.target.style.borderColor = 'var(--rim)')} />
          <div style={hintStyle}>Optional — add transits for a full current-moment reading.</div>
        </Panel>"""

if OLD_PANEL in src:
    src = src.replace(OLD_PANEL, NEW_PANEL)
    print("✓ Patched transit Panel in Home.tsx")
elif "<TransitDataForm" in src:
    print("· TransitDataForm already in Home.tsx, skipping panel patch")
else:
    print("⚠ Could not find the transit Panel block — patch it manually (see README above)")

# ── 3. Write patched Home.tsx ──────────────────────────────────────────────────
with open(HOME_TSX, "w", encoding="utf-8") as f:
    f.write(src)
print(f"✓ Saved {HOME_TSX}")
print("\nDone! Run your dev server to verify.")
