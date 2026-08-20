// Tiny prose formatter for level-content prose (StepBase.prompt and any other
// free-text schema field rendered as a paragraph). Same spirit as
// asmTemplate.ts's tokenizeAsmLine: a deliberately small, hand-rolled parser
// for hand-authored level copy, not a general-purpose markdown engine — no
// escaping, no nesting, no link/heading/table syntax. Supports exactly three
// things: **bold**, `inline code`, and "- " bullet lists split across lines
// (blank lines separate paragraphs; soft-wrapped non-bullet lines within one
// paragraph are joined with a space so source can be wrapped for readability
// without affecting rendered layout).

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export type RichInlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "code"; value: string };

export type RichBlock =
  | { kind: "paragraph"; tokens: RichInlineToken[] }
  | { kind: "list"; items: RichInlineToken[][] };

/** Splits one line/paragraph of prose into text/bold/code tokens. */
export function tokenizeInline(text: string): RichInlineToken[] {
  const tokens: RichInlineToken[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("**")) {
      tokens.push({ kind: "bold", value: raw.slice(2, -2) });
    } else {
      tokens.push({ kind: "code", value: raw.slice(1, -1) });
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return tokens;
}

/** Parses a prompt string into block-level structure — paragraphs (blank-line
 * separated) and "- "-prefixed bullet lists — each already tokenized at the
 * inline level. Existing plain-prose prompts (no blank lines, no "- ") parse
 * as a single paragraph block, so this is a safe drop-in for every existing
 * `prompt` string. */
export function parseRichText(source: string): RichBlock[] {
  const lines = source.split("\n");
  const blocks: RichBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({
        kind: "paragraph",
        tokens: tokenizeInline(paragraphLines.join(" ")),
      });
      paragraphLines = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({
        kind: "list",
        items: listItems.map((item) => tokenizeInline(item)),
      });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const bulletMatch = /^-\s+(.*)$/.exec(line);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
