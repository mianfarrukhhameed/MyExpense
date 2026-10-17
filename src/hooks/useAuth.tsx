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
  /** True while resolving a sync conflict choice (app shell is already shown). */
  resolvingConflict: boolean
  configured: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AskConflict = (report: SyncConflictReport) => Promise<SyncConflictChoice>

/** Agent / e2e: auto-pick Use cloud so automated browsers are not blocked. */
function shouldAutoResolveConflicts(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('myexpense:e2e') === '1') return true
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('e2e') === '1') {
        localStorage.setItem('myexpense:e2e', '1')
        return true
      }
    }
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Bring this device in line with the cloud for the signed-in user.
 * `onAwaitingUserInput` releases the full-screen spinner before conflict UI.
 */
async function bootstrapAuthenticatedUser(
  user: User,
  askConflict: AskConflict,
  onAwaitingUserInput?: () => void,
): Promise<void> {
  const { profile, migratedGuest, switchedUser } = await bindLocalDataToUser(
    user.id,
  )

  if (switchedUser) {
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

  const conflicts = await detectSyncConflicts(user.id)
  if (conflicts) {
    // Show app shell + conflict modal; do not keep a full-screen spinner
    onAwaitingUserInput?.()
    const choice = await askConflict(conflicts)
    await applySyncConflictChoice(user.id, conflicts, choice)

    if (choice === 'cancel') {
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
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const [conflictReport, setConflictReport] =
    useState<SyncConflictReport | null>(null)
  const configured = isSupabaseConfigured()
  const bootstrappedUserId = useRef<string | null>(null)
  const bootstrapInFlight = useRef<Promise<void> | null>(null)
  const signInOwnsBootstrap = useRef(false)
  const conflictResolverRef = useRef<
    ((choice: SyncConflictChoice) => void) | null
  >(null)
  const releaseUiForConflictRef = useRef<(() => void) | null>(null)

  const askConflict = useCallback((report: SyncConflictReport) => {
    if (shouldAutoResolveConflicts()) {
      return Promise.resolve('use_cloud' as SyncConflictChoice)
    }

    return new Promise<SyncConflictChoice>((resolve) => {
      conflictResolverRef.current = resolve
      setConflictReport(report)
      setResolvingConflict(true)
      releaseUiForConflictRef.current?.()
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

      if (bootstrapInFlight.current) {
        await bootstrapInFlight.current
        return
      }

      const job = (async () => {
        try {
          await bootstrapAuthenticatedUser(
            nextUser,
            askConflict,
            () => releaseUiForConflictRef.current?.(),
          )
          bootstrappedUserId.current = nextUser.id
        } finally {
          setResolvingConflict(false)
          bootstrapInFlight.current = null
        }
      })()

      bootstrapInFlight.current = job
      await job
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
          releaseUiForConflictRef.current = () => {
            if (cancelled) return
            setSession(current)
            setUser(current.user)
            setLoading(false)
          }
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
        releaseUiForConflictRef.current = null
        if (!cancelled) setLoading(false)
      }
    }

    void init()

    const unsubscribe = onAuthStateChange((next) => {
      void (async () => {
        if (next?.user) {
          // Password sign-in / register owns bootstrap — avoid spinner + race
          if (signInOwnsBootstrap.current) {
            setSession(next)
            setUser(next.user)
            return
          }

          setLoading(true)
          try {
            releaseUiForConflictRef.current = () => {
              if (cancelled) return
              setSession(next)
              setUser(next.user)
              setLoading(false)
            }
            await runBootstrap(next.user)
            if (cancelled) return
            setSession(next)
            setUser(next.user)
          } finally {
            releaseUiForConflictRef.current = null
            if (!cancelled) setLoading(false)
          }
        } else {
          bootstrappedUserId.current = null
          setSession(null)
          setUser(null)
          setResolvingConflict(false)
          setConflictReport(null)
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
      signInOwnsBootstrap.current = true
      try {
        const data = await signIn(email, password)
        if (data.user) {
          releaseUiForConflictRef.current = () => {
            setSession(data.session)
            setUser(data.user)
            setLoading(false)
          }
          await runBootstrap(data.user)
          setSession(data.session)
          setUser(data.user)
        }
      } finally {
        releaseUiForConflictRef.current = null
        signInOwnsBootstrap.current = false
        setLoading(false)
      }
    },
    [runBootstrap],
  )

  const register = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      signInOwnsBootstrap.current = true
      try {
        const data = await signUp(email, password)
        if (data.session?.user) {
          releaseUiForConflictRef.current = () => {
            setSession(data.session)
            setUser(data.session!.user)
            setLoading(false)
          }
          await runBootstrap(data.session.user)
          setSession(data.session)
          setUser(data.session.user)
        }
      } finally {
        releaseUiForConflictRef.current = null
        signInOwnsBootstrap.current = false
        setLoading(false)
      }
    },
    [runBootstrap],
  )

  const logOut = useCallback(async () => {
    setLoading(true)
    try {
      await signOut()
      bootstrappedUserId.current = null
      bootstrapInFlight.current = null
      await clearLocalWorkspace()
      setSession(null)
      setUser(null)
      setConflictReport(null)
      setResolvingConflict(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      resolvingConflict,
      configured,
      signInWithPassword,
      register,
      logOut,
    }),
    [
      user,
      session,
      loading,
      resolvingConflict,
      configured,
      signInWithPassword,
      register,
      logOut,
    ],
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
