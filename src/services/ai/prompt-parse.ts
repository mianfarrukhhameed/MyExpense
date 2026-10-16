import { EXPENSE_CATEGORIES } from '../../core/config/app.config'
import type { ExpenseDraft } from '../../core/types/expense-draft'
import { toDateKey } from '../../core/utils/date'
import { getLanguageModelApi } from './capability'
import { localParseExpense } from './local-parse'
import { decodeAudioBlob } from './speech'

type PromptContentPart = {
  type: 'text' | 'image' | 'audio'
  value: unknown
}

type PromptMessage =
  | string
  | {
      role: 'user' | 'system' | 'assistant'
      content: string | PromptContentPart[]
      prefix?: boolean
    }

type PromptSession = {
  prompt: (input: string | PromptMessage[]) => Promise<string>
  destroy?: () => void
}

function buildSystemPrompt(): string {
  return [
    'Extract a personal expense from the user input.',
    'Reply with ONLY a JSON object, no markdown:',
    '{"amount":number|null,"category":string,"description":string|null,"date":"YYYY-MM-DD"}',
    `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`,
    `If date is missing use ${toDateKey()}.`,
    'If amount is unclear use null.',
    'description should be short.',
  ].join(' ')
}

function parseJsonDraft(raw: string, sourceText: string): ExpenseDraft {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return localParseExpense(sourceText || raw, 'prompt')

  try {
    const data = JSON.parse(match[0]) as {
      amount?: number | null
      category?: string
      description?: string | null
      date?: string
    }

    const amount =
      typeof data.amount === 'number' && data.amount > 0 ? data.amount : null
    const category = EXPENSE_CATEGORIES.includes(
      data.category as (typeof EXPENSE_CATEGORIES)[number],
    )
      ? (data.category as string)
      : localParseExpense(sourceText || raw, 'prompt').category

    const date =
      typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
        ? data.date
        : toDateKey()

    return {
      amount,
      category,
      description:
        typeof data.description === 'string' && data.description.trim()
          ? data.description.trim().slice(0, 120)
          : null,
      date,
      source: 'prompt',
      confidence: amount != null ? 'high' : 'medium',
      rawText: sourceText || raw,
    }
  } catch {
    return localParseExpense(sourceText || raw, 'prompt')
  }
}

async function createSession(
  expectedInputs: Array<{ type: string; languages?: string[] }>,
): Promise<PromptSession> {
  const lm = getLanguageModelApi()
  if (!lm) throw new Error('Prompt API is not available')

  try {
    const session = (await lm.create({
      expectedInputs,
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
      ],
      monitor(m: {
        addEventListener: (
          type: string,
          cb: (e: { loaded?: number; total?: number }) => void,
        ) => void
      }) {
        m.addEventListener('downloadprogress', () => {
          /* model download in progress — UI toast handles wait time */
        })
      },
    })) as PromptSession
    return session
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Could not start on-device AI (${message}). Open chrome://on-device-internals and ensure the model is downloaded.`,
    )
  }
}

export async function parseExpenseWithPromptText(
  text: string,
): Promise<ExpenseDraft> {
  const session = await createSession([{ type: 'text', languages: ['en'] }])
  try {
    const raw = await session.prompt(
      `Parse this expense utterance:\n${text}`,
    )
    return parseJsonDraft(raw, text)
  } finally {
    session.destroy?.()
  }
}

export async function parseExpenseWithPromptImage(
  imageBlob: Blob,
): Promise<ExpenseDraft> {
  const session = await createSession([
    { type: 'text', languages: ['en'] },
    { type: 'image' },
  ])
  try {
    const raw = await session.prompt([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            value: 'Parse the expense from this receipt image.',
          },
          { type: 'image', value: imageBlob },
        ],
      },
    ])
    return parseJsonDraft(raw, raw)
  } finally {
    session.destroy?.()
  }
}

export async function parseExpenseWithPromptAudio(
  audioBlob: Blob,
): Promise<ExpenseDraft> {
  const audioBuffer = await decodeAudioBlob(audioBlob)
  const session = await createSession([
    { type: 'text', languages: ['en'] },
    { type: 'audio' },
  ])
  try {
    const raw = await session.prompt([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            value:
              'Transcribe the spoken expense and return only the JSON object described in the system prompt.',
          },
          { type: 'audio', value: audioBuffer },
        ],
      },
    ])
    return parseJsonDraft(raw, raw)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `AI voice failed (${message}). Needs desktop Chrome with GPU and a downloaded Prompt API model.`,
    )
  } finally {
    session.destroy?.()
  }
}
