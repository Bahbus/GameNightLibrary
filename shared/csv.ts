export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV ends inside a quoted field.");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

export function csvRecords(source: string): Array<Record<string, string>> {
  const [headers, ...rows] = parseCsv(source);
  if (!headers) throw new Error("CSV has no header row.");
  const normalized = headers.map((header) => header.trim());
  return rows.map((row, rowIndex) => {
    if (row.length !== normalized.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${row.length} columns; expected ${normalized.length}.`
      );
    }
    return Object.fromEntries(normalized.map((header, index) => [header, row[index].trim()]));
  });
}

const escapeCsv = (value: string | number | boolean | undefined) => {
  const text = value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function recordsToCsv(
  records: Array<Record<string, string | number | boolean | undefined>>,
  headers: string[]
): string {
  return [
    headers.join(","),
    ...records.map((record) => headers.map((header) => escapeCsv(record[header])).join(","))
  ]
    .join("\n")
    .concat("\n");
}
