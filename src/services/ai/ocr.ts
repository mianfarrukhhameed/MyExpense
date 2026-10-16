import { compressImage } from '../storage/receipts'

let workerPromise: Promise<import('tesseract.js').Worker> | null = null

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      return worker
    })()
  }
  return workerPromise
}

/** OCR a receipt image on-device via Tesseract.js (lazy-loaded). */
export async function ocrReceiptImage(
  file: Blob,
  onProgress?: (status: string) => void,
): Promise<string> {
  onProgress?.('Preparing image…')
  const compressed = await compressImage(file, 1280, 0.75)

  onProgress?.('Loading OCR…')
  const worker = await getWorker()

  onProgress?.('Reading receipt…')
  const result = await worker.recognize(compressed)
  const text = result.data.text?.trim() ?? ''
  if (!text) throw new Error('Could not read text from this image')
  return text
}
