type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

function createRecognition(): SpeechRecognitionLike {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) throw new Error('Speech recognition is not supported on this device')
  return new Ctor()
}

/** Listen once and resolve with the final transcript. */
export function listenForTranscript(options?: {
  lang?: string
  timeoutMs?: number
}): Promise<string> {
  const recognition = createRecognition()
  recognition.lang = options?.lang ?? 'en-US'
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  recognition.continuous = false

  const timeoutMs = options?.timeoutMs ?? 12000

  return new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
      reject(new Error('Listening timed out — try again'))
    }, timeoutMs)

    recognition.onresult = (event) => {
      const parts: string[] = []
      for (let i = 0; i < event.results.length; i += 1) {
        const row = event.results[i]
        if (row?.[0]?.transcript) parts.push(row[0].transcript)
      }
      const transcript = parts.join(' ').trim()
      if (!settled) {
        settled = true
        window.clearTimeout(timer)
        if (!transcript) reject(new Error('No speech detected'))
        else resolve(transcript)
      }
    }

    recognition.onerror = (event) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      reject(new Error(`Speech error: ${event.error}`))
    }

    recognition.onend = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      reject(new Error('Speech recognition ended without a result'))
    }

    try {
      recognition.start()
    } catch (err) {
      settled = true
      window.clearTimeout(timer)
      reject(err instanceof Error ? err : new Error('Could not start microphone'))
    }
  })
}

/** Record a short audio clip for Prompt API multimodal input. */
export async function recordAudioBlob(durationMs = 6000): Promise<Blob> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : 'audio/mp4'

  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream, { mimeType })
    const timer = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, durationMs)

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    recorder.onerror = () => {
      window.clearTimeout(timer)
      stream.getTracks().forEach((track) => track.stop())
      reject(new Error('Audio recording failed'))
    }

    recorder.onstop = () => {
      window.clearTimeout(timer)
      stream.getTracks().forEach((track) => track.stop())
      resolve(new Blob(chunks, { type: mimeType }))
    }

    try {
      recorder.start()
    } catch (err) {
      window.clearTimeout(timer)
      stream.getTracks().forEach((track) => track.stop())
      reject(err instanceof Error ? err : new Error('Could not record audio'))
    }
  })
}
