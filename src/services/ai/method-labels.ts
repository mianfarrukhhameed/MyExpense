/** Stable names shown in toasts after AI / capture operations. */
export const AiMethod = {
  promptAudio: 'promptAudio',
  promptImage: 'promptImage',
  promptApi: 'promptApi',
  webSpeech: 'webSpeech',
  tesseractOcr: 'tesseractOcr',
  writer: 'writer',
  rewriter: 'rewriter',
  embeddings: 'embeddings',
  embeddingsSearch: 'embeddingsSearch',
  substringSearch: 'substringSearch',
  keywords: 'keywords',
} as const

export type AiMethodName = (typeof AiMethod)[keyof typeof AiMethod]

export function methodToastMessage(method: string | string[]): string {
  const label = Array.isArray(method) ? method.join(' · ') : method
  return `Used ${label}`
}

export type PresentToast = (opts: {
  message: string
  duration?: number
  color?: string
}) => void | Promise<void>

/** Short success toast naming the method that just ran. */
export function presentMethodToast(
  present: PresentToast,
  method: string | string[],
): void {
  void present({
    message: methodToastMessage(method),
    duration: 1800,
    color: 'medium',
  })
}
