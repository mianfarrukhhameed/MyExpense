import type { ExpenseDraft } from '../../core/types/expense-draft'
import {
  canCaptureVoice,
  getCaptureCapabilities,
  type CaptureCapabilities,
} from './capability'
import { ocrReceiptImage } from './ocr'
import {
  parseExpenseWithPromptAudio,
  parseExpenseWithPromptImage,
  parseExpenseWithPromptText,
} from './prompt-parse'
import { localParseExpense } from './local-parse'
import { listenForTranscript, recordAudioBlob } from './speech'
import { maybeTranslateToEnglish } from './translate'

export type CaptureProgress = (message: string) => void

let cachedCaps: CaptureCapabilities | null = null

export async function loadCaptureCapabilities(
  force = false,
): Promise<CaptureCapabilities> {
  if (!force && cachedCaps) return cachedCaps
  cachedCaps = await getCaptureCapabilities()
  return cachedCaps
}

export async function captureExpenseFromVoice(
  onProgress?: CaptureProgress,
): Promise<ExpenseDraft> {
  const caps = await loadCaptureCapabilities()
  if (!canCaptureVoice(caps)) {
    throw new Error('Voice entry is not supported on this device')
  }

  if (caps.promptAudio) {
    onProgress?.('Listening (AI)…')
    const audio = await recordAudioBlob(6500)
    onProgress?.('Understanding…')
    return parseExpenseWithPromptAudio(audio)
  }

  onProgress?.('Listening…')
  const transcript = await listenForTranscript({ timeoutMs: 12000 })
  onProgress?.('Processing…')
  const english = await maybeTranslateToEnglish(transcript)

  if (caps.promptText) {
    try {
      return await parseExpenseWithPromptText(english)
    } catch {
      /* fall through to rules */
    }
  }

  return localParseExpense(english, 'speech')
}

export async function captureExpenseFromReceipt(
  file: File,
  onProgress?: CaptureProgress,
): Promise<ExpenseDraft> {
  const caps = await loadCaptureCapabilities()

  if (caps.promptImage) {
    onProgress?.('Reading receipt (AI)…')
    try {
      const draft = await parseExpenseWithPromptImage(file)
      return { ...draft, receiptFile: file }
    } catch {
      /* fall through to OCR */
    }
  }

  const text = await ocrReceiptImage(file, onProgress)
  onProgress?.('Processing text…')
  const english = await maybeTranslateToEnglish(text)

  if (caps.promptText) {
    try {
      const draft = await parseExpenseWithPromptText(english)
      return { ...draft, receiptFile: file, rawText: text }
    } catch {
      /* fall through */
    }
  }

  return {
    ...localParseExpense(english, 'ocr'),
    receiptFile: file,
    rawText: text,
  }
}
