// Tiny "{{blankId}}" placeholder templating shared by FillBlankLevel's
// asmLines (displayed as real asm with an inline fill-in slot) and
// setupAsmTemplate (the same substitution, but the result gets assembled and
// run). Deliberately dumb — no escaping, no nested braces — this only needs
// to serve hand-authored level content, not arbitrary templates.

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export type AsmTemplateToken =
  { kind: "text"; value: string } | { kind: "blank"; id: string };

/** Splits one asmLines entry into text/blank tokens for inline rendering. */
export function tokenizeAsmLine(line: string): AsmTemplateToken[] {
  const tokens: AsmTemplateToken[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(PLACEHOLDER)) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", value: line.slice(lastIndex, match.index) });
    }
    tokens.push({ kind: "blank", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    tokens.push({ kind: "text", value: line.slice(lastIndex) });
  }
  return tokens;
}

/** Replaces every "{{blankId}}" in `template` with `values[blankId]`
 * (empty string if unanswered). */
export function substituteAsmTemplate(
  template: string,
  values: Record<string, string | undefined>,
): string {
  return template.replace(PLACEHOLDER, (_, id: string) => values[id] ?? "");
}
