import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ensureLocalProfileForUser } from '../db/migration.repo'
import { enqueueSyncItem } from '../db/sync-queue.repo'
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from '../lib/supabase/auth'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { hydrateFromRemoteIfEmpty } from '../services/offline/hydration'
import {
  ensureRemoteProfile,
  pushAllLocalExpenses,
  startSyncListeners,
  syncNow,
} from '../services/sync/sync-engine'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function bootstrapAuthenticatedUser(user: User): Promise<void> {
  const profile = await ensureLocalProfileForUser(user.id)
  await ensureRemoteProfile(user.id)
  await enqueueSyncItem({
    entity: 'profile',
    operation: 'update',
    payload: profile,
  })
  await pushAllLocalExpenses(user.id)
  await hydrateFromRemoteIfEmpty()
  await syncNow()
  await startSyncListeners()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()
  const bootstrappedUserId = useRef<string | null>(null)

  const runBootstrap = useCallback(async (nextUser: User) => {
    if (bootstrappedUserId.current === nextUser.id) {
      await startSyncListeners()
      return
    }
    bootstrappedUserId.current = nextUser.id
    await bootstrapAuthenticatedUser(nextUser)
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const current = await getSession()
        if (cancelled) return
        setSession(current)
        setUser(current?.user ?? null)
        if (current?.user) {
          await runBootstrap(current.user)
        }
      } catch {
        if (!cancelled) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()

    const unsubscribe = onAuthStateChange((next) => {
      setSession(next)
      setUser(next?.user ?? null)
      if (next?.user) {
        void runBootstrap(next.user)
      } else {
        bootstrappedUserId.current = null
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [runBootstrap])

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const data = await signIn(email, password)
      if (data.user) {
        setSession(data.session)
        setUser(data.user)
        await runBootstrap(data.user)
      }
    },
    [runBootstrap],
  )

  const register = useCallback(async (email: string, password: string) => {
    const data = await signUp(email, password)
    if (data.session?.user) {
      setSession(data.session)
      setUser(data.session.user)
      await runBootstrap(data.session.user)
    }
  }, [runBootstrap])

  const logOut = useCallback(async () => {
    await signOut()
    bootstrappedUserId.current = null
    setSession(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      configured,
      signInWithPassword,
      register,
      logOut,
    }),
    [user, session, loading, configured, signInWithPassword, register, logOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
