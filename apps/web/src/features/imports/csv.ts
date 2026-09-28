export function escapeSpreadsheetCell(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value
}

export function csvCell(value: unknown): string {
  const escaped = escapeSpreadsheetCell(value == null ? '' : String(value))
  return /[",\r\n]/.test(escaped) ? `"${escaped.replaceAll('"', '""')}"` : escaped
}

