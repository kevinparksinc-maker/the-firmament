import shutil, datetime, sys

path = "server/horary.ts"
backup = f"{path}.bak.{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
shutil.copy(path, backup)
print(f"Backup created: {backup}")
print("(This script only touches server/horary.ts. FirmamentEngine.tsx is not opened or referenced.)")

with open(path, "r") as f:
    content = f.read()

# -- Fix 1: comment out the broken import (not delete it -- kept visible for reference) --
old_import = 'import { buildPrompt } from "@shared/firmamentEngine";'
new_import = '// import { buildPrompt } from "@shared/firmamentEngine"; // removed: pointed at a single-planet function in FirmamentEngine.tsx, not usable here'

if content.count(old_import) != 1:
    print(f"ABORTING fix 1: expected exactly 1 match for the import line, found {content.count(old_import)}. No changes made.")
    sys.exit(1)
content = content.replace(old_import, new_import)
print("Commented out the unresolved buildPrompt import.")

# -- Fix 2: use natalText/transitText directly instead of calling buildPrompt() --
old_call = '''  // Run both charts through the Firmament Engine prompt builder
  const natalPrompt = buildPrompt(natalText, "natal");
  const transitPrompt = buildPrompt(transitText, "transit");'''

new_call = '''  // Use the raw natal/transit text directly. buildPrompt() was pointing at
  // FirmamentEngine.tsx's single-planet function (wrong signature, client-only
  // file the server can't import) -- this text is already chart data, so we
  // pass it straight into the prompt below.
  const natalPrompt = natalText;
  const transitPrompt = transitText;'''

if content.count(old_call) != 1:
    print(f"ABORTING fix 2: expected exactly 1 match for the buildPrompt call block, found {content.count(old_call)}. No changes made to this part.")
    sys.exit(1)
content = content.replace(old_call, new_call)
print("Replaced buildPrompt() calls with direct use of natalText/transitText.")

with open(path, "w") as f:
    f.write(content)

print("server/horary.ts fixed successfully. FirmamentEngine.tsx was never touched.")
