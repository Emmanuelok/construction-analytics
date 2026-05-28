/** Trigger a real client-side file download from generated text content. */
export const MIME: Record<string, string> = {
  CSV: 'text/csv;charset=utf-8',
  JSON: 'application/json',
  GeoJSON: 'application/geo+json',
  IFC: 'text/plain;charset=utf-8',
  XML: 'application/xml',
  TXT: 'text/plain;charset=utf-8',
}

export function downloadText(filename: string, content: string, format = 'TXT') {
  const blob = new Blob([content], { type: MIME[format] ?? MIME.TXT })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** Read an uploaded File as text (for in-browser parsing). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
