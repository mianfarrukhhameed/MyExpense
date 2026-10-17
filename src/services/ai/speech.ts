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

type ActiveRecording = {
  recorder: MediaRecorder
  stream: MediaStream
  chunks: BlobPart[]
  mimeType: string
  startedAt: number
}

let activeRecording: ActiveRecording | null = null
let activeRecognition: SpeechRecognitionLike | null = null
let recognitionTranscript = ''

function createRecognition(): SpeechRecognitionLike {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) throw new Error('Speech recognition is not supported on this device')
  return new Ctor()
}

/** Listen once and resolve with the final transcript (legacy timeout path). */
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

/** Start hold-to-talk MediaRecorder (Prompt API path). */
export async function startHoldRecording(): Promise<void> {
  if (activeRecording) return
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4'

  const chunks: BlobPart[] = []
  const recorder = new MediaRecorder(stream, { mimeType })
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  activeRecording = {
    recorder,
    stream,
    chunks,
    mimeType,
    startedAt: Date.now(),
  }
  recorder.start(250)
}

/** Stop hold-to-talk recording and return the audio blob. */
export async function stopHoldRecording(): Promise<Blob> {
  const current = activeRecording
  if (!current) throw new Error('Not recording')

  const { recorder, stream, chunks, mimeType, startedAt } = current
  activeRecording = null

  if (Date.now() - startedAt < 300) {
    try {
      if (recorder.state === 'recording') recorder.stop()
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((track) => track.stop())
    throw new Error('Hold the mic button while speaking')
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop())
      reject(new Error('Audio recording failed'))
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      const result = new Blob(chunks, { type: mimeType.split(';')[0] })
      if (result.size === 0) {
        reject(new Error('No audio captured — try again'))
        return
      }
      resolve(result)
    }
    try {
      if (recorder.state === 'recording') recorder.stop()
      else {
        stream.getTracks().forEach((track) => track.stop())
        reject(new Error('Recording already stopped'))
      }
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop())
      reject(err instanceof Error ? err : new Error('Could not stop recording'))
    }
  })

  return blob
}

export async function cancelHoldRecording(): Promise<void> {
  const current = activeRecording
  if (!current) return
  activeRecording = null
  try {
    if (current.recorder.state === 'recording') current.recorder.stop()
  } catch {
    /* ignore */
  }
  current.stream.getTracks().forEach((track) => track.stop())
}

/** Start hold-to-talk Web Speech recognition (mobile path). */
export function startHoldSpeech(lang = 'en-US'): void {
  if (activeRecognition) return
  const recognition = createRecognition()
  recognition.lang = lang
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  recognition.continuous = true
  recognitionTranscript = ''

  recognition.onresult = (event) => {
    const parts: string[] = []
    for (let i = 0; i < event.results.length; i += 1) {
      const row = event.results[i]
      if (row?.[0]?.transcript) parts.push(row[0].transcript)
    }
    recognitionTranscript = parts.join(' ').trim()
  }
  recognition.onerror = () => {
    /* resolved on stop */
  }
  recognition.onend = () => {
    /* resolved on stop */
  }

  activeRecognition = recognition
  recognition.start()
}

/** Stop hold-to-talk speech and return transcript. */
export async function stopHoldSpeech(): Promise<string> {
  const recognition = activeRecognition
  if (!recognition) throw new Error('Not listening')
  activeRecognition = null

  await new Promise<void>((resolve) => {
    const prev = recognition.onend
    recognition.onend = () => {
      prev?.()
      resolve()
    }
    try {
      recognition.stop()
    } catch {
      resolve()
    }
    window.setTimeout(() => resolve(), 800)
  })

  const text = recognitionTranscript.trim()
  recognitionTranscript = ''
  if (!text) throw new Error('No speech detected')
  return text
}

export async function cancelHoldSpeech(): Promise<void> {
  const recognition = activeRecognition
  if (!recognition) return
  activeRecognition = null
  recognitionTranscript = ''
  try {
    recognition.abort()
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer startHoldRecording/stopHoldRecording */
export async function recordAudioBlob(durationMs = 6000): Promise<Blob> {
  await startHoldRecording()
  await new Promise((resolve) => window.setTimeout(resolve, durationMs))
  return stopHoldRecording()
}

/** Decode a recorded Blob into an AudioBuffer for the Prompt API. */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctx) throw new Error('Web Audio is not available')

  const ctx = new Ctx()
  try {
    const bytes = await blob.arrayBuffer()
    return await ctx.decodeAudioData(bytes.slice(0))
  } catch {
    throw new Error('Could not decode recorded audio for AI')
  } finally {
    await ctx.close().catch(() => undefined)
  }
}
