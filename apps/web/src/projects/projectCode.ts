/**
 * Codes are a letter prefix and a number (TET1005). Follows the client's most used prefix,
 * or the first letters of its name, and takes the next number free across all projects.
 */
export function suggestProjectCode(clientName: string, clientCodes: string[], allCodes: string[]) {
  const prefix =
    mostCommon(clientCodes.flatMap((code) => code.match(/^[A-Z]+/) ?? [])) ??
    clientName
      .normalize("NFD")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
  if (!prefix) return undefined;
  const numbers = allCodes.flatMap((code) => {
    const number = code.match(new RegExp(`^${prefix}(\\d+)$`))?.[1];
    return number ? [Number(number)] : [];
  });
  return `${prefix}${numbers.length > 0 ? Math.max(...numbers) + 1 : 1000}`;
}

function mostCommon(values: string[]) {
  const counts = Map.groupBy(values, (value) => value);
  return [...counts].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
}
