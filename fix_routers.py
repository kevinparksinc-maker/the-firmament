import re

with open('server/routers.ts', 'r') as f:
    content = f.read()

# Remove duplicate crisisEngine imports
lines = content.split('\n')
unique_lines = []
seen_imports = set()

for line in lines:
    if 'import { crisisEngine } from "./crisisEngine";' in line:
        if 'crisisEngine' not in seen_imports:
            seen_imports.add('crisisEngine')
            unique_lines.append(line)
    else:
        unique_lines.append(line)

content = '\n'.join(unique_lines)

# Make sure crisisEngine is imported once at the top
if 'import { crisisEngine }' not in content:
    content = 'import { crisisEngine } from "./crisisEngine";\n' + content

# Remove stray crisis detection code inside string literals
content = re.sub(r'(\s*\/\/ ─── CRISIS DETECTION ─────────────────────────────────────────────────────────\s*const transitAspects = calculateAspects\(result\.planets, result\.planets\);\s*const crisisResult = crisisEngine\.analyze\(transitAspects\);)', '', content)

with open('server/routers.ts', 'w') as f:
    f.write(content)

print("✅ routers.ts cleaned up!")
