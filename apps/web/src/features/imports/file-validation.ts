// Fixed parser messages from InspectWorkbook; never display uploaded content or
// arbitrary server errors. This exception applies only to import file validation.
const parserMessages = new Set([
  'The spreadsheet is unavailable or exceeds 5 MiB.',
  'Only CSV and XLSX files are accepted.',
  'The spreadsheet could not be inspected.',
  'The spreadsheet type could not be verified.',
  'The file content does not match CSV.',
  'The CSV could not be read.',
  'The spreadsheet exceeds 500 data rows.',
  'The file content does not match XLSX.',
  'The XLSX workbook is malformed.',
  'The workbook must contain one visible worksheet.',
  'The spreadsheet exceeds the supported shape.',
  'Formulas and executable spreadsheet content are not accepted.',
  'Numeric birthdates must be genuine Excel date cells.',
  'The XLSX package is malformed or too complex.',
  'The XLSX package is malformed.',
  'Macros, links, and embedded executable content are not accepted.',
  'The XLSX package expands beyond safe limits.',
  'Formulas are not accepted.',
  'Macros, external links, and executable workbook content are not accepted.',
  'Hidden worksheets are not accepted.',
  'The spreadsheet has no data rows.',
  'The spreadsheet headers are invalid.',
  'A spreadsheet row contains unexpected columns.',
  'Unsupported spreadsheet cell content.',
  'A spreadsheet cell is too long.',
])

export function safeImportFileErrors(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && parserMessages.has(item)))].slice(0, 3) : []
}
