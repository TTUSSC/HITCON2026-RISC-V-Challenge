// Renders a StepBase.prompt (or any other free-text schema field) through
// engine/richText.ts's tiny parser — gives **bold**/`code`/"- " bullet
// structure real typographic hierarchy instead of a single flat <p>. Every
// widget's `<p>{schema.prompt}</p>` is meant to become
// `<RichText text={schema.prompt} />` (see widgets.css's .rich-text rules for
// the styling — inline code gets the JetBrains Mono treatment already used
// for asm/register names, bold gets the STYLE.md text-strong weight, bullets
// get real list styling, not raw browser defaults).

import type { RichInlineToken } from "../engine/richText";
import { parseRichText } from "../engine/richText";

function InlineTokens({ tokens }: { tokens: RichInlineToken[] }) {
  return (
    <>
      {tokens.map((token, i) => {
        if (token.kind === "bold") {
          return <strong key={i}>{token.value}</strong>;
        }
        if (token.kind === "code") {
          return (
            <code key={i} className="rich-text-code">
              {token.value}
            </code>
          );
        }
        return <span key={i}>{token.value}</span>;
      })}
    </>
  );
}

export function RichText({ text }: { text: string }) {
  const blocks = parseRichText(text);
  return (
    <div className="rich-text">
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul className="rich-text-list" key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineTokens tokens={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <InlineTokens tokens={block.tokens} />
          </p>
        ),
      )}
    </div>
  );
}
