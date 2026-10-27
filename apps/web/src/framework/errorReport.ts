const maxCauseDepth = 10;

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? `${item}n` : item), 2);
  } catch {
    return String(value);
  }
}

/**
 * Everything known about an unexpected failure, so a developer can be sent it:
 * each error in the cause chain with its stack and own properties (query,
 * params, Postgres code and detail).
 */
export function errorReport(error: unknown): string {
  const sections: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (sections.length < maxCauseDepth && !seen.has(current)) {
    seen.add(current);
    if (!(current instanceof Error)) {
      sections.push(`Thrown value (not an Error): ${stringify(current)}`);
      break;
    }
    // The cause gets its own section; Drizzle assigns it as a plain property.
    const { cause, ...properties } = current;
    const lines = [current.stack ?? `${current.name}: ${current.message}`];
    if (Object.keys(properties).length > 0) lines.push(`Properties: ${stringify(properties)}`);
    sections.push(lines.join("\n"));
    if (current.cause === undefined) break;
    current = current.cause;
  }
  return sections
    .map((section, index) => (index === 0 ? section : `Caused by: ${section}`))
    .join("\n\n");
}
