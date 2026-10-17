import { useIonToast } from '@ionic/react'
import { useEffect, useRef, useState } from 'react'
import {
  suggestCategory,
  type CategorySuggestion,
} from '../services/ai/category-suggest'
import { AiMethod, presentMethodToast } from '../services/ai/method-labels'

const DEBOUNCE_MS = 1000

/**
 * Suggest category from description (strict keywords, then embeddings).
 * Does not auto-apply — Accept/Dismiss in UI.
 */
export function useCategorySuggest(
  description: string,
  currentCategory: string,
  options?: { enabled?: boolean; suggestOnMount?: boolean },
) {
  const enabled = options?.enabled !== false
  const suggestOnMount = options?.suggestOnMount ?? false
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [present] = useIonToast()
  const lastFor = useRef('')
  const seq = useRef(0)
  const mountedOnce = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setSuggestion(null)
      return
    }
    const text = description.trim()
    if (text.length < 3) {
      setSuggestion(null)
      return
    }
    if (text === lastFor.current) return

    const delay = suggestOnMount && !mountedOnce.current ? 100 : DEBOUNCE_MS
    if (suggestOnMount) mountedOnce.current = true

    const timer = window.setTimeout(() => {
      const mySeq = ++seq.current
      setLoading(true)
      void suggestCategory(text).then((result) => {
        if (mySeq !== seq.current) return
        setLoading(false)
        lastFor.current = text
        if (result && result.category !== currentCategory) {
          setSuggestion(result)
          presentMethodToast(
            present,
            result.source === 'embedding' ? AiMethod.embeddings : AiMethod.keywords,
          )
        } else {
          setSuggestion(null)
        }
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [description, currentCategory, enabled, suggestOnMount, present])

  const accept = (): string | null => {
    if (!suggestion) return null
    const next = suggestion.category
    setSuggestion(null)
    return next
  }

  const dismiss = () => {
    lastFor.current = description.trim()
    setSuggestion(null)
  }

  const reset = () => {
    lastFor.current = ''
    mountedOnce.current = false
    setSuggestion(null)
  }

  return { suggestion, loading, accept, dismiss, reset }
}
