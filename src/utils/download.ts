export function timestampForFilename(date = new Date()) {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadTextFile(content: string, filename: string, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([content], { type }), filename);
}
