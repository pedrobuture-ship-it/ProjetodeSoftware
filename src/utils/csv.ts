export type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue) {
  const text = value === null || value === undefined ? '' : String(value);
  const escaped = text.replace(/"/g, '""');

  return `"${escaped}"`;
}

export function buildCsv(headers: string[], rows: CsvValue[][]) {
  const csvRows = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(';'));

  return `\uFEFF${csvRows.join('\r\n')}`;
}
