import type { ReactNode } from "react";

/**
 * Parses messages like:  "ARCHIVE:: meet at 8 ::stable"
 *   - "ARCHIVE::"  -> dim decorative wrapper
 *   - "meet at 8"  -> bright core message
 *   - "::stable"   -> dim decorative wrapper
 *
 * Falls back to plain bright text if no wrappers are present.
 */
export function formatMessage(text: string): ReactNode {
  const match = text.match(
    /^(\s*[A-Z][A-Z0-9_]*::\s*)?([\s\S]*?)(\s*::[a-zA-Z0-9_]+\s*)?$/,
  );

  if (!match || (!match[1] && !match[3])) {
    return <span className="text-sm text-foreground">{text}</span>;
  }

  const [, prefix, core, suffix] = match;

  return (
    <span>
      {prefix && (
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
          {prefix.trim()}{" "}
        </span>
      )}
      <span className="text-sm text-foreground">{core}</span>
      {suffix && (
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
          {" "}
          {suffix.trim()}
        </span>
      )}
    </span>
  );
}
