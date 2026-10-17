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
import {
  startHoldRecording,
  startHoldSpeech,
  stopHoldRecording,
  stopHoldSpeech,
} from './speech'
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

export type VoiceHoldMode = 'prompt-audio' | 'speech'

/** Begin hold-to-talk; call stopVoiceHold when the button is released. */
export async function startVoiceHold(): Promise<VoiceHoldMode> {
  const caps = await loadCaptureCapabilities(true)

  if (caps.desktopPromptPreferred) {
    if (!caps.promptAudio) {
      throw new Error(
        'AI voice needs desktop Chrome/Edge with Prompt API (audio). Check chrome://on-device-internals — model may need download + GPU.',
      )
    }
    await startHoldRecording()
    return 'prompt-audio'
  }

  if (!canCaptureVoice(caps)) {
    throw new Error('Voice entry is not supported on this device')
  }

  if (caps.promptAudio) {
    await startHoldRecording()
    return 'prompt-audio'
  }

  startHoldSpeech('en-US')
  return 'speech'
}

/** Finish hold-to-talk and parse into an expense draft. */
export async function stopVoiceHold(
  mode: VoiceHoldMode,
  onProgress?: CaptureProgress,
): Promise<ExpenseDraft> {
  if (mode === 'prompt-audio') {
    onProgress?.('Understanding…')
    const audio = await stopHoldRecording()
    return parseExpenseWithPromptAudio(audio)
  }

  onProgress?.('Processing…')
  const transcript = await stopHoldSpeech()
  const english = await maybeTranslateToEnglish(transcript)
  const caps = await loadCaptureCapabilities()

  if (caps.promptText) {
    try {
      return await parseExpenseWithPromptText(english)
    } catch {
      /* fall through */
    }
  }
  return localParseExpense(english, 'speech')
}

/** @deprecated Prefer startVoiceHold / stopVoiceHold */
export async function captureExpenseFromVoice(
  onProgress?: CaptureProgress,
): Promise<ExpenseDraft> {
  onProgress?.('Listening… hold the mic')
  const mode = await startVoiceHold()
  // Fallback if someone still calls the old API: record ~4s then stop
  await new Promise((resolve) => window.setTimeout(resolve, 4000))
  return stopVoiceHold(mode, onProgress)
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
