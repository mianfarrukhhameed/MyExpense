import { useIonToast } from '@ionic/react'
import { useEffect, useRef, useState } from 'react'
import { getRewriterApi, isAiSurfaceReady } from '../services/ai/capability'
import { AiMethod, presentMethodToast } from '../services/ai/method-labels'
import { rewriteExpenseDescription } from '../services/ai/rewriter'

const DEBOUNCE_MS = 1000

async function rewriterAvailable(): Promise<boolean> {
  const api = getRewriterApi()
  if (!api?.availability) return false
  try {
    return isAiSurfaceReady(
      await api.availability({
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
        outputLanguage: 'en',
      }),
    )
  } catch {
    return false
  }
}

/**
 * Debounced Rewriter suggestions for description fields.
 * Never overwrites the field — expose Accept/Dismiss to the UI.
 */
export function useDescriptionSuggest(
  description: string,
  options?: {
    enabled?: boolean
    category?: string
    /** When true, suggest once immediately (voice/image draft / edit open). */
    suggestOnMount?: boolean
  },
) {
  const enabled = options?.enabled !== false
  const category = options?.category
  const suggestOnMount = options?.suggestOnMount ?? false

  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState(false)
  const [present] = useIonToast()
  const lastSuggestedFor = useRef<string>('')
  const seq = useRef(0)
  const mountedOnce = useRef(false)

  useEffect(() => {
    let cancelled = false
    void rewriterAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!enabled || !available) {
      setSuggestion(null)
      setLoading(false)
      return
    }

    const text = description.trim()
    if (text.length < 3) {
      setSuggestion(null)
      setLoading(false)
      return
    }
    if (text === lastSuggestedFor.current) return

    const delay = suggestOnMount && !mountedOnce.current ? 80 : DEBOUNCE_MS
    if (suggestOnMount) mountedOnce.current = true

    setSuggestion(null)
    const timer = window.setTimeout(() => {
      const mySeq = ++seq.current
      setLoading(true)
      void rewriteExpenseDescription(text, { category }).then((result) => {
        if (mySeq !== seq.current) return
        setLoading(false)
        if (result) {
          lastSuggestedFor.current = text
          setSuggestion(result)
          presentMethodToast(present, AiMethod.rewriter)
        } else {
          setSuggestion(null)
        }
      })
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [description, enabled, available, category, suggestOnMount, present])

  const accept = (): string | null => {
    if (!suggestion) return null
    const next = suggestion
    lastSuggestedFor.current = next
    setSuggestion(null)
    return next
  }

  const dismiss = () => {
    lastSuggestedFor.current = description.trim()
    setSuggestion(null)
  }

  const reset = () => {
    lastSuggestedFor.current = ''
    mountedOnce.current = false
    setSuggestion(null)
    setLoading(false)
  }

  return { suggestion, loading, available, accept, dismiss, reset }
}
