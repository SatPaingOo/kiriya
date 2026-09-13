/** A TCP port from 1 to 65535 written in digits, or null. */
export function parsePort(text: string): number | null {
  if (!/^\d{1,5}$/.test(text.trim())) return null;
  const port = Number(text.trim());
  return port >= 1 && port <= 65_535 ? port : null;
}
