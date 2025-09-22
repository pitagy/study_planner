export function toCsv(rows: any[]) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const body = rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
  return [headers.join(','), ...body].join('\r\n');
}

export function downloadCsv(filename: string, rows: any[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
