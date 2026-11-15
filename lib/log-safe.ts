// Values written into server logs.
//
// Two problems with `console.error(\`failed for ${userInput}:\`, err)`:
// the first argument is a format string, so a value containing "%s" or "%o"
// eats the next argument and the real error disappears from the log; and a
// value containing a newline writes a second, forged log line that a reader
// (or an alert rule) takes at face value.
//
// So: a constant format string first, and every outside value through this.

/** One line, no control characters, bounded. Safe to interpolate into a log. */
export function logValue(value: unknown, max = 300): string {
  let s: string;
  if (value instanceof Error) s = value.message;
  else if (typeof value === "string") s = value;
  else { try { s = JSON.stringify(value) ?? String(value); } catch { s = String(value); } }
  s = s.replace(/[\r\n\u2028\u2029]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "");
  // Already newline-free; this is the exact form code scanning recognises as
  // a log-injection sanitiser, so the guarantee is visible to it too.
  s = s.replace(/\n/g, "").replace(/\r/g, "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
