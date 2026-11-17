/**
 * Parse pasted or uploaded tabular text. Handles commas, tabs (pasted from
 * Excel / Google Sheets) or semicolons, quoted fields and CRLF line endings.
 */
export function parseTable(input: string): string[][] {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(",") ? "," : firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c !== ""));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Map parsed rows to objects using the expected column keys. If the first row
 * looks like a header (matches a key or alias), columns are matched by name;
 * otherwise they are read in the order of `columns`.
 */
export function rowsToRecords<K extends string>(
  rows: string[][],
  columns: ReadonlyArray<{ key: K; aliases?: readonly string[] }>,
): Array<Record<K, string>> {
  if (rows.length === 0) return [];
  const names = columns.map((c) => [c.key, ...(c.aliases ?? [])].map(norm));
  const header = rows[0].map(norm);
  const isName = (h: string, i: number) => h !== "" && names[i].includes(h);
  const headerHits = header.filter((h) => names.some((_, i) => isName(h, i))).length;
  const hasHeader = headerHits > 0 && headerHits >= Math.min(2, columns.length);
  const index = columns.map((_, i) => (hasHeader ? header.findIndex((h) => isName(h, i)) : i));
  return (hasHeader ? rows.slice(1) : rows).map((r) => {
    const rec = {} as Record<K, string>;
    columns.forEach((c, i) => {
      rec[c.key] = index[i] >= 0 ? (r[index[i]] ?? "").trim() : "";
    });
    return rec;
  });
}
