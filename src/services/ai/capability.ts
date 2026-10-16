export type AiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

export interface CaptureCapabilities {
  promptText: boolean
  promptImage: boolean
  promptAudio: boolean
  speech: boolean
  translator: boolean
  languageDetector: boolean
  /** Desktop Chromium (Chrome/Edge) — Prompt API preferred, no speech fallback. */
  desktopPromptPreferred: boolean
}

type LanguageModelLike = {
  availability: (options?: unknown) => Promise<AiAvailability>
  create: (options?: unknown) => Promise<unknown>
}

type TranslatorLike = {
  availability: (options: {
    sourceLanguage: string
    targetLanguage: string
  }) => Promise<AiAvailability>
  create: (options: {
    sourceLanguage: string
    targetLanguage: string
  }) => Promise<unknown>
}

type LanguageDetectorLike = {
  availability: () => Promise<AiAvailability>
  create: () => Promise<unknown>
}

function getLanguageModel(): LanguageModelLike | null {
  const g = globalThis as { LanguageModel?: LanguageModelLike }
  return g.LanguageModel ?? null
}

function getTranslator(): TranslatorLike | null {
  const g = globalThis as { Translator?: TranslatorLike }
  return g.Translator ?? null
}

function getLanguageDetector(): LanguageDetectorLike | null {
  const g = globalThis as { LanguageDetector?: LanguageDetectorLike }
  return g.LanguageDetector ?? null
}

/** True for non-mobile desktop browsers that can host Chrome built-in AI. */
export function isDesktopPromptHost(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  if (mobile) return false
  // Chrome, Edge, Opera, Brave (Chromium family)
  return /Chrome\//.test(ua) || /Edg\//.test(ua) || /OPR\//.test(ua)
}

export function hasSpeechRecognition(): boolean {
  const w = window as unknown as {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
  }
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

async function isPromptReady(
  expectedInputs: Array<{ type: string; languages?: string[] }>,
  /** Multimodal audio/image often fail unless the model is fully downloaded. */
  requireAvailable = false,
): Promise<boolean> {
  const lm = getLanguageModel()
  if (!lm?.availability) return false
  try {
    const status = await lm.availability({
      expectedInputs,
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    })
    if (requireAvailable) return status === 'available'
    return status === 'available' || status === 'downloadable'
  } catch {
    return false
  }
}

export async function getCaptureCapabilities(): Promise<CaptureCapabilities> {
  const speech = hasSpeechRecognition()
  const desktopPromptPreferred = isDesktopPromptHost()
  let promptText = false
  let promptImage = false
  let promptAudio = false
  let translator = false
  let languageDetector = false

  try {
    promptText = await isPromptReady([
      { type: 'text', languages: ['en'] },
    ])
  } catch {
    promptText = false
  }

  try {
    // Allow downloadable — LanguageModel.create() will fetch the model
    promptImage = await isPromptReady(
      [{ type: 'text', languages: ['en'] }, { type: 'image' }],
      false,
    )
  } catch {
    promptImage = false
  }

  try {
    promptAudio = await isPromptReady(
      [{ type: 'text', languages: ['en'] }, { type: 'audio' }],
      false,
    )
  } catch {
    promptAudio = false
  }

  const detector = getLanguageDetector()
  if (detector?.availability) {
    try {
      const status = await detector.availability()
      languageDetector =
        status === 'available' || status === 'downloadable'
    } catch {
      languageDetector = false
    }
  }

  const translatorApi = getTranslator()
  if (translatorApi?.availability) {
    try {
      const status = await translatorApi.availability({
        sourceLanguage: 'ur',
        targetLanguage: 'en',
      })
      translator = status === 'available' || status === 'downloadable'
    } catch {
      translator = false
    }
  }

  return {
    promptText,
    promptImage,
    promptAudio,
    speech,
    translator,
    languageDetector,
    desktopPromptPreferred,
  }
}

export function getLanguageModelApi(): LanguageModelLike | null {
  return getLanguageModel()
}

export function getTranslatorApi(): TranslatorLike | null {
  return getTranslator()
}

export function getLanguageDetectorApi(): LanguageDetectorLike | null {
  return getLanguageDetector()
}

export function canCaptureVoice(caps: CaptureCapabilities): boolean {
  // Desktop Chromium: Prompt audio only (no Web Speech fallback)
  if (caps.desktopPromptPreferred) return caps.promptAudio
  return caps.promptAudio || caps.speech
}

export function canCaptureReceipt(_caps?: CaptureCapabilities): boolean {
  return true // Tesseract always available after lazy load
}
