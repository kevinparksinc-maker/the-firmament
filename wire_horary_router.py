import shutil, datetime, sys

path = "server/routers.ts"
backup = f"{path}.bak.{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
shutil.copy(path, backup)
print(f"Backup created: {backup}")

with open(path, "r") as f:
    content = f.read()

old_block = '''  ask: publicProcedure
    .input(
      z.object({
        question: z.string().min(3),
        natalPlacements: z.string().optional(),
        transitPlacements: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { question, natalPlacements, transitPlacements } = input;
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: `${COSMOLOGY_PREAMBLE}

You are an expert horary and natal astrologer. Answer the question directly and specifically using the chart. Rules:
- Answer in the FIRST paragraph. No warmup. No preamble.
- Name specific planets, houses, aspects that answer the question.
- Be honest — yes or no, with timing if visible.
- No generic spiritual language. No hedging.
- If the chart is unclear, say what it does show and why it is unclear.`,
        messages: [
          {
            role: "user",
            content: `QUESTION: ${question}

${natalPlacements ? "NATAL CHART:\\n" + natalPlacements + "\\n\\n" : ""}${transitPlacements ? "CURRENT SKY:\\n" + transitPlacements : ""}`,
          },
        ],
      });
      const text = response.content
        .map((b: any) => (b.type === "text" ? b.text : ""))
        .join("");
      return { answer: text };
    }),'''

count = content.count(old_block)
if count != 1:
    print(f"ABORTING: expected exactly 1 match for the ask block, found {count}. No changes made.")
    print("This means routers.ts has already been modified or doesn't match what I expected.")
    sys.exit(1)

new_block = '''  ask: publicProcedure
    .input(
      z.object({
        question: z.string().min(3),
        natalPlacements: z.string().optional(),
        transitPlacements: z.string().optional(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { question, natalPlacements, transitPlacements, name } = input;
      const result = await horaryLayer({
        question,
        natalText: natalPlacements ?? "",
        transitText: transitPlacements ?? "",
        name,
      });
      return {
        answer: result.answer,
        intent: result.intent,
        focus: result.focus,
      };
    }),'''

content = content.replace(old_block, new_block)
print("Replaced the thin inline 'ask' prompt with a call to horaryLayer().")

import_anchor = 'import Anthropic from "@anthropic-ai/sdk";\n'
import_line = 'import { horaryLayer } from "./horary";\n'

if 'from "./horary"' in content:
    print("horaryLayer import already present — skipped.")
elif content.count(import_anchor) >= 1:
    content = content.replace(import_anchor, import_anchor + import_line, 1)
    print("Inserted horaryLayer import after the Anthropic import.")
else:
    print("WARNING: could not find an anchor line to auto-insert the import.")
    print("Add this manually near the top of server/routers.ts:")
    print('  import { horaryLayer } from "./horary";')

with open(path, "w") as f:
    f.write(content)

print("server/routers.ts updated successfully.")
