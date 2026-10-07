import { getDb } from './index'
import { STORE_RECEIPT_BLOBS } from './schema'

export async function putReceiptBlob(key: string, blob: Blob): Promise<void> {
  const db = await getDb()
  await db.put(STORE_RECEIPT_BLOBS, blob, key)
}

export async function getReceiptBlob(key: string): Promise<Blob | undefined> {
  const db = await getDb()
  return db.get(STORE_RECEIPT_BLOBS, key)
}

export async function deleteReceiptBlob(key: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_RECEIPT_BLOBS, key)
}
