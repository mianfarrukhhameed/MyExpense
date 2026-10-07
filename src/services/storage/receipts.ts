import { getReceiptBlob } from '../../db/receipts.repo'
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client'

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.7

/** Compress an image to JPEG with a max edge length. */
export async function compressImage(
  file: Blob,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error('Failed to compress image'))
        },
        'image/jpeg',
        quality,
      )
    })
    return blob
  } finally {
    bitmap.close()
  }
}

/** Upload a receipt blob to Supabase Storage. Returns storage path. */
export async function uploadReceipt(
  userId: string,
  expenseId: string,
  blob: Blob,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }

  const path = `${userId}/${expenseId}.jpg`
  const { error } = await getSupabase().storage
    .from('receipts')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (error) throw error
  return path
}

/** Resolve a displayable URL for a receipt (local blob or signed remote). */
export async function getReceiptDisplayUrl(
  receiptUrl: string | null | undefined,
  localBlobKey: string | null | undefined,
): Promise<string | null> {
  if (localBlobKey) {
    const blob = await getReceiptBlob(localBlobKey)
    if (blob) return URL.createObjectURL(blob)
  }

  if (!receiptUrl || !isSupabaseConfigured()) return null

  const { data, error } = await getSupabase().storage
    .from('receipts')
    .createSignedUrl(receiptUrl, 60 * 60)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
