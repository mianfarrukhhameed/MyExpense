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
  DEFAULT_CURRENCY,
  DEFAULT_MONTHLY_BUDGET,
} from '../core/config/app.config'
import { SyncConflictDialog } from '../components/sync/SyncConflictDialog'
import {
  bindLocalDataToUser,
  clearLocalWorkspace,
} from '../db/migration.repo'
import { listExpenses } from '../db/expenses.repo'
import { listLoans } from '../db/loans.repo'
import { listMonthBudgets } from '../db/month-budgets.repo'
import { listPlans } from '../db/plans.repo'
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
  applySyncConflictChoice,
  detectSyncConflicts,
  type SyncConflictChoice,
  type SyncConflictReport,
} from '../services/sync/conflict'
import {
  ensureRemoteProfile,
  flushQueue,
  pushAllLocalExpenses,
  pushAllLocalLoans,
  pushAllLocalMonthBudgets,
  pushAllLocalPlans,
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

type AskConflict = (report: SyncConflictReport) => Promise<SyncConflictChoice>

/**
 * Bring this device in line with the cloud for the signed-in user.
 */
async function bootstrapAuthenticatedUser(
  user: User,
  askConflict: AskConflict,
): Promise<void> {
  const { profile, migratedGuest, switchedUser } = await bindLocalDataToUser(
    user.id,
  )

  if (switchedUser) {
    // Reinstall / account switch: cloud is source of truth — never push empty defaults
    await hydrateFromRemote()
    await ensureRemoteProfile(user.id)
    await syncNow()
    await startSyncListeners()
    return
  }

  if (migratedGuest) {
    await ensureRemoteProfile(user.id)
    const expenses = await listExpenses()
    const hasCustomProfile =
      Number(profile.monthly_budget) !== DEFAULT_MONTHLY_BUDGET ||
      profile.currency !== DEFAULT_CURRENCY
    if (hasCustomProfile) {
      await enqueueSyncItem({
        entity: 'profile',
        operation: 'update',
        payload: profile,
      })
    }
    if (expenses.length > 0) {
      await pushAllLocalExpenses(user.id)
    }
    const [plans, loans, monthBudgets] = await Promise.all([
      listPlans(),
      listLoans(),
      listMonthBudgets(),
    ])
    if (plans.length > 0) await pushAllLocalPlans(user.id)
    if (loans.length > 0) await pushAllLocalLoans(user.id)
    if (monthBudgets.length > 0) await pushAllLocalMonthBudgets(user.id)
    await flushQueue()
    await hydrateFromRemote()
    await syncNow()
    await startSyncListeners()
    return
  }

  // Returning same user: detect older-local conflicts before flush/hydrate
  const conflicts = await detectSyncConflicts(user.id)
  if (conflicts) {
    const choice = await askConflict(conflicts)
    await applySyncConflictChoice(user.id, conflicts, choice)

    if (choice === 'cancel') {
      // Neither push nor pull conflicting rows; keep local UI as-is
      await startSyncListeners()
      return
    }

    if (choice === 'push_local') {
      await flushQueue()
      await hydrateFromRemote()
      await ensureRemoteProfile(user.id)
      await syncNow()
      await startSyncListeners()
      return
    }

    // use_cloud — conflicts already applied from remote; pull the rest
    await hydrateFromRemote()
    await ensureRemoteProfile(user.id)
    await syncNow()
    await startSyncListeners()
    return
  }

  await flushQueue()
  await hydrateFromRemote()
  await ensureRemoteProfile(user.id)
  await syncNow()
  await startSyncListeners()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [conflictReport, setConflictReport] =
    useState<SyncConflictReport | null>(null)
  const configured = isSupabaseConfigured()
  const bootstrappedUserId = useRef<string | null>(null)
  const conflictResolverRef = useRef<((choice: SyncConflictChoice) => void) | null>(
    null,
  )

  const askConflict = useCallback((report: SyncConflictReport) => {
    return new Promise<SyncConflictChoice>((resolve) => {
      conflictResolverRef.current = resolve
      setConflictReport(report)
    })
  }, [])

  const handleConflictChoice = useCallback((choice: SyncConflictChoice) => {
    const resolve = conflictResolverRef.current
    conflictResolverRef.current = null
    setConflictReport(null)
    resolve?.(choice)
  }, [])

  const runBootstrap = useCallback(
    async (nextUser: User) => {
      if (bootstrappedUserId.current === nextUser.id) {
        await syncNow()
        await startSyncListeners()
        return
      }
      bootstrappedUserId.current = nextUser.id
      await bootstrapAuthenticatedUser(nextUser, askConflict)
    },
    [askConflict],
  )

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

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SyncConflictDialog
        report={conflictReport}
        onChoice={handleConflictChoice}
      />
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
