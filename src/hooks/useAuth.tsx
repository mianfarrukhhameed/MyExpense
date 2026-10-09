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
import {
  bindLocalDataToUser,
  clearLocalWorkspace,
} from '../db/migration.repo'
import { enqueueSyncItem } from '../db/sync-queue.repo'
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from '../lib/supabase/auth'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { hydrateFromRemote } from '../services/offline/hydration'
import {
  ensureRemoteProfile,
  flushQueue,
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

/**
 * Bring this device in line with the cloud for the signed-in user.
 * Flush any pending local writes first, then replace local workspace from remote
 * so iOS / desktop always converge on the same account data.
 */
async function bootstrapAuthenticatedUser(user: User): Promise<void> {
  const { profile, migratedGuest, switchedUser } = await bindLocalDataToUser(
    user.id,
  )

  if (switchedUser) {
    await hydrateFromRemote()
    await ensureRemoteProfile(user.id)
  } else if (migratedGuest) {
    await ensureRemoteProfile(user.id)
    await enqueueSyncItem({
      entity: 'profile',
      operation: 'update',
      payload: profile,
    })
    await pushAllLocalExpenses(user.id)
    await flushQueue()
    // Pull full cloud workspace (includes this device’s push + other devices)
    await hydrateFromRemote()
  } else {
    // Returning same user on this device: push pending, then take cloud snapshot
    await flushQueue()
    await hydrateFromRemote()
    await ensureRemoteProfile(user.id)
  }

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
      await syncNow()
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
        if (current?.user) {
          await runBootstrap(current.user)
          if (cancelled) return
          setSession(current)
          setUser(current.user)
        } else {
          setSession(null)
          setUser(null)
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
      void (async () => {
        if (next?.user) {
          setLoading(true)
          try {
            await runBootstrap(next.user)
            if (cancelled) return
            setSession(next)
            setUser(next.user)
          } finally {
            if (!cancelled) setLoading(false)
          }
        } else {
          bootstrappedUserId.current = null
          setSession(null)
          setUser(null)
        }
      })()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [runBootstrap])

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      try {
        const data = await signIn(email, password)
        if (data.user) {
          await runBootstrap(data.user)
          setSession(data.session)
          setUser(data.user)
        }
      } finally {
        setLoading(false)
      }
    },
    [runBootstrap],
  )

  const register = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const data = await signUp(email, password)
      if (data.session?.user) {
        await runBootstrap(data.session.user)
        setSession(data.session)
        setUser(data.session.user)
      }
    } finally {
      setLoading(false)
    }
  }, [runBootstrap])

  const logOut = useCallback(async () => {
    setLoading(true)
    try {
      await signOut()
      bootstrappedUserId.current = null
      await clearLocalWorkspace()
      setSession(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
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
