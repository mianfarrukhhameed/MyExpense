import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from './client'

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await getSupabase().auth.getSession()
  if (error) throw error
  return data.session
}

export async function getUser(): Promise<User | null> {
  const session = await getSession()
  return session?.user ?? null
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!isSupabaseConfigured()) return
  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  if (!isSupabaseConfigured()) {
    callback(null)
    return () => undefined
  }

  const {
    data: { subscription },
  } = getSupabase().auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return () => subscription.unsubscribe()
}
