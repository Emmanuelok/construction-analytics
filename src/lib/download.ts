/** Trigger a real client-side file download from generated text content. */
export const MIME: Record<string, string> = {
  CSV: 'text/csv;charset=utf-8',
  JSON: 'application/json',
  GeoJSON: 'application/geo+json',
  IFC: 'text/plain;charset=utf-8',
  XML: 'application/xml',
  HTML: 'text/html;charset=utf-8',
  TXT: 'text/plain;charset=utf-8',
}

/** Open generated HTML in a new tab and trigger the print dialog (Save as PDF). */
export function openPrintable(html: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false // popup blocked
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  // let layout settle before invoking print
  setTimeout(() => { try { w.print() } catch { /* user can print manually */ } }, 350)
  return true
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

/** Download a dataset file: generated/cached content locally, or — for
 *  cloud-stored seller files — via a license-checked signed URL. */
export async function downloadDatasetFile(
  file: import('@/data/catalog').DatasetFile,
  datasetId: string,
  opts: { userId?: string } = {},
): Promise<void> {
  const local = file.generate?.() ?? file.content
  if (local != null) {
    downloadText(file.name, local, file.format)
    return
  }
  if (file.storagePath) {
    const { signedDownloadUrl } = await import('@/lib/cloud')
    const url = await signedDownloadUrl({ datasetId, storagePath: file.storagePath, fileName: file.name, userId: opts.userId })
    if (!url) throw new Error('You need a license to download this file.')
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }
  throw new Error('No content available for this file.')
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
