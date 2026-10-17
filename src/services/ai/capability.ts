export type AiAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'

export interface CaptureCapabilities {
  promptText: boolean
  promptImage: boolean
  promptAudio: boolean
  speech: boolean
  translator: boolean
  languageDetector: boolean
  writer: boolean
  rewriter: boolean
  embedder: boolean
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

type WriterLike = {
  availability: (options?: unknown) => Promise<AiAvailability>
  create: (options?: unknown) => Promise<unknown>
}

type RewriterLike = {
  availability: (options?: unknown) => Promise<AiAvailability>
  create: (options?: unknown) => Promise<unknown>
}

type SemanticEmbedderLike = {
  availability: (options?: unknown) => Promise<AiAvailability>
  create: (options?: unknown) => Promise<unknown>
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

function getWriter(): WriterLike | null {
  const g = globalThis as { Writer?: WriterLike }
  return g.Writer ?? null
}

function getRewriter(): RewriterLike | null {
  const g = globalThis as { Rewriter?: RewriterLike }
  return g.Rewriter ?? null
}

function getSemanticEmbedder(): SemanticEmbedderLike | null {
  const g = globalThis as {
    SemanticEmbedder?: SemanticEmbedderLike
    Embedder?: SemanticEmbedderLike
  }
  return g.SemanticEmbedder ?? g.Embedder ?? null
}

export function isAiSurfaceReady(status: AiAvailability): boolean {
  return status === 'available' || status === 'downloadable'
}

/** True for non-mobile desktop browsers that can host Chrome built-in AI. */
export function isDesktopPromptHost(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  if (mobile) return false
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
    return isAiSurfaceReady(status)
  } catch {
    return false
  }
}

async function isNamedAiReady(
  check: () => Promise<AiAvailability>,
): Promise<boolean> {
  try {
    return isAiSurfaceReady(await check())
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
  let writer = false
  let rewriter = false
  let embedder = false

  try {
    promptText = await isPromptReady([{ type: 'text', languages: ['en'] }])
  } catch {
    promptText = false
  }

  try {
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
    languageDetector = await isNamedAiReady(() => detector.availability())
  }

  const translatorApi = getTranslator()
  if (translatorApi?.availability) {
    translator = await isNamedAiReady(() =>
      translatorApi.availability({
        sourceLanguage: 'ur',
        targetLanguage: 'en',
      }),
    )
  }

  const writerApi = getWriter()
  if (writerApi?.availability) {
    writer = await isNamedAiReady(() =>
      writerApi.availability({
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
        outputLanguage: 'en',
      }),
    )
  }

  const rewriterApi = getRewriter()
  if (rewriterApi?.availability) {
    rewriter = await isNamedAiReady(() =>
      rewriterApi.availability({
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
        outputLanguage: 'en',
      }),
    )
  }

  const embedderApi = getSemanticEmbedder()
  if (embedderApi?.availability) {
    embedder = await isNamedAiReady(() => embedderApi.availability())
  }

  return {
    promptText,
    promptImage,
    promptAudio,
    speech,
    translator,
    languageDetector,
    writer,
    rewriter,
    embedder,
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

export function getWriterApi(): WriterLike | null {
  return getWriter()
}

export function getRewriterApi(): RewriterLike | null {
  return getRewriter()
}

export function getSemanticEmbedderApi(): SemanticEmbedderLike | null {
  return getSemanticEmbedder()
}

export function canCaptureVoice(caps: CaptureCapabilities): boolean {
  if (caps.desktopPromptPreferred) return caps.promptAudio
  return caps.promptAudio || caps.speech
}

export function canCaptureReceipt(_caps?: CaptureCapabilities): boolean {
  return true
}
