export type ExpenseDraftSource = 'prompt' | 'speech' | 'ocr' | 'rules'

/** Concrete pipeline used to produce the draft (for method toasts). */
export type ExpenseCaptureMethod =
  | 'promptAudio'
  | 'promptImage'
  | 'promptApi'
  | 'webSpeech'
  | 'webSpeech · promptApi'
  | 'tesseractOcr'
  | 'tesseractOcr · promptApi'

export interface ExpenseDraft {
  amount: number | null
  category: string
  description: string | null
  date: string
  source: ExpenseDraftSource
  /** Which capture/AI path produced this draft. */
  method?: ExpenseCaptureMethod
  confidence: 'high' | 'medium' | 'low'
  rawText: string
  receiptFile?: File | null
}
