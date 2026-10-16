export type ExpenseDraftSource = 'prompt' | 'speech' | 'ocr' | 'rules'

export interface ExpenseDraft {
  amount: number | null
  category: string
  description: string | null
  date: string
  source: ExpenseDraftSource
  confidence: 'high' | 'medium' | 'low'
  rawText: string
  receiptFile?: File | null
}
