import {
  getLanguageDetectorApi,
  getTranslatorApi,
} from './capability'

type DetectorSession = {
  detect: (text: string) => Promise<Array<{ detectedLanguage: string; confidence: number }>>
  destroy?: () => void
}

type TranslatorSession = {
  translate: (text: string) => Promise<string>
  destroy?: () => void
}

/** Optionally detect language and translate non-English text to English. */
export async function maybeTranslateToEnglish(text: string): Promise<string> {
  const detectorApi = getLanguageDetectorApi()
  const translatorApi = getTranslatorApi()
  if (!detectorApi || !translatorApi) return text

  let detector: DetectorSession | null = null
  let translator: TranslatorSession | null = null

  try {
    detector = (await detectorApi.create()) as DetectorSession
    const detected = await detector.detect(text)
    const top = detected[0]
    if (!top || top.detectedLanguage === 'en' || top.confidence < 0.4) {
      return text
    }

    const availability = await translatorApi.availability({
      sourceLanguage: top.detectedLanguage,
      targetLanguage: 'en',
    })
    if (availability !== 'available' && availability !== 'downloadable') {
      return text
    }

    translator = (await translatorApi.create({
      sourceLanguage: top.detectedLanguage,
      targetLanguage: 'en',
    })) as TranslatorSession

    const translated = await translator.translate(text)
    return translated.trim() || text
  } catch {
    return text
  } finally {
    detector?.destroy?.()
    translator?.destroy?.()
  }
}
