// Minimalny parser CSV (RFC 4180): pola w cudzysłowach, podwojone cudzysłowy, CRLF/LF.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = []; i++; continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Zamienia wiersze CSV z nagłówkiem na tablicę obiektów {kolumna: wartość}. */
export function csvToObjects(text) {
  const rows = parseCsv(text);
  const header = rows.shift() || [];
  return rows.map((r) => {
    const o = {};
    for (let k = 0; k < header.length; k++) o[header[k]] = r[k] ?? '';
    return o;
  });
}
