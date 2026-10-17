import {
  IonFab,
  IonFabButton,
  IonFabList,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  useIonToast,
} from '@ionic/react'
import {
  addOutline,
  cameraOutline,
  micOutline,
} from 'ionicons/icons'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ListTotalBar } from '../components/common/ListTotalBar'
import { MonthFilterBar } from '../components/common/MonthFilterBar'
import { PageScaffold } from '../components/common/PageScaffold'
import {
  SearchBar,
  type SearchMode,
} from '../components/common/SearchBar'
import {
  ExpenseFormModal,
  type ExpenseFormValues,
} from '../components/expenses/ExpenseFormModal'
import { ExpenseList } from '../components/expenses/ExpenseList'
import {
  LoanFormModal,
  type LoanFormValues,
} from '../components/loans/LoanFormModal'
import { LoanList } from '../components/loans/LoanList'
import { LoanPaymentModal } from '../components/loans/LoanPaymentModal'
import {
  PlanFormModal,
  type PlanFormValues,
} from '../components/plans/PlanFormModal'
import { PlanList } from '../components/plans/PlanList'
import type { ExpenseDraft } from '../core/types/expense-draft'
import type { Expense } from '../core/types/expense'
import type { Loan } from '../core/types/loan'
import type { PlanExpense } from '../core/types/plan'
import { toMonthKey } from '../core/utils/date'
import { filterLoansByMonth, sumLoansByDirection } from '../db/loans.repo'
import { filterPlansByMonth, sumPlans } from '../db/plans.repo'
import { useExpenses } from '../hooks/useExpenses'
import { useLoans } from '../hooks/useLoans'
import { usePlans } from '../hooks/usePlans'
import { useProfile } from '../hooks/useProfile'
import {
  canCaptureVoice,
  type CaptureCapabilities,
} from '../services/ai/capability'
import {
  cancelHoldRecording,
  cancelHoldSpeech,
} from '../services/ai/speech'
import {
  captureExpenseFromReceipt,
  loadCaptureCapabilities,
  startVoiceHold,
  stopVoiceHold,
  type VoiceHoldMode,
} from '../services/ai/expense-capture'
import {
  backfillSearchIndex,
  indexSearchDocument,
  isSemanticSearchAvailable,
  removeSearchDocument,
  semanticRankIds,
} from '../services/ai/search-index'

type MoneySegment = 'expenses' | 'plans' | 'loans'

const SEARCH_MODE_KEY = 'myexpense:search_mode'

function matchesSearch(haystack: string, query: string): boolean {
  if (!query.trim()) return true
  return haystack.toLowerCase().includes(query.trim().toLowerCase())
}

function readSearchMode(): SearchMode {
  try {
    const raw = localStorage.getItem(SEARCH_MODE_KEY)
    return raw === 'similar' ? 'similar' : 'contains'
  } catch {
    return 'contains'
  }
}

export default function MoneyPage() {
  const {
    expenses,
    loading: expensesLoading,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses()
  const {
    plans,
    loading: plansLoading,
    addPlan,
    updatePlan,
    deletePlan,
    markPlanPaid,
  } = usePlans()
  const {
    loans,
    loading: loansLoading,
    addLoan,
    updateLoan,
    deleteLoan,
    recordLoanPayment,
  } = useLoans()
  const { profile } = useProfile()
  const currency = profile?.currency ?? 'USD'
  const [segment, setSegment] = useState<MoneySegment>('expenses')
  const [monthKey, setMonthKey] = useState<string | null>(() => toMonthKey())
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>(() => readSearchMode())
  const [similarAvailable, setSimilarAvailable] = useState(false)
  const [semanticExpenseIds, setSemanticExpenseIds] = useState<string[] | null>(
    null,
  )
  const [semanticPlanIds, setSemanticPlanIds] = useState<string[] | null>(null)
  const [semanticLoanIds, setSemanticLoanIds] = useState<string[] | null>(null)
  const [present] = useIonToast()
  const scanInputRef = useRef<HTMLInputElement>(null)

  const [expenseFormOpen, setExpenseFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [holdingVoice, setHoldingVoice] = useState(false)
  const voiceModeRef = useRef<VoiceHoldMode | null>(null)
  const voicePointerRef = useRef<number | null>(null)
  const [caps, setCaps] = useState<CaptureCapabilities | null>(null)
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanExpense | null>(null)
  const [loanFormOpen, setLoanFormOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null)

  useEffect(() => {
    void loadCaptureCapabilities().then(setCaps)
    void isSemanticSearchAvailable().then((ok) => {
      setSimilarAvailable(ok)
      if (!ok) {
        setSearchMode((prev) => {
          if (prev !== 'similar') return prev
          localStorage.setItem(SEARCH_MODE_KEY, 'contains')
          return 'contains'
        })
      }
    })
  }, [])

  useEffect(() => {
    if (!similarAvailable) return
    void backfillSearchIndex(
      'expense',
      expenses.map((item) => ({
        id: item.id,
        text: `${item.category} ${item.description ?? ''} ${item.amount}`,
      })),
    )
    void backfillSearchIndex(
      'plan',
      plans.map((item) => ({
        id: item.id,
        text: `${item.category} ${item.description ?? ''} ${item.amount}`,
      })),
    )
    void backfillSearchIndex(
      'loan',
      loans.map((item) => ({
        id: item.id,
        text: `${item.person} ${item.description ?? ''} ${item.direction} ${item.amount}`,
      })),
    )
  }, [similarAvailable, expenses, plans, loans])

  const monthExpenses = useMemo(() => {
    if (!monthKey) return expenses
    return expenses.filter((item) => toMonthKey(item.date) === monthKey)
  }, [expenses, monthKey])

  const monthPlans = useMemo(
    () =>
      filterPlansByMonth(
        plans.filter((plan) => plan.status === 'upcoming'),
        monthKey,
      ),
    [plans, monthKey],
  )

  const monthLoans = useMemo(
    () => filterLoansByMonth(loans, monthKey),
    [loans, monthKey],
  )

  useEffect(() => {
    if (searchMode !== 'similar' || !search.trim() || !similarAvailable) {
      setSemanticExpenseIds(null)
      setSemanticPlanIds(null)
      setSemanticLoanIds(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const [expenseIds, planIds, loanIds] = await Promise.all([
          semanticRankIds(
            'expense',
            search,
            monthExpenses.map((item) => item.id),
          ),
          semanticRankIds(
            'plan',
            search,
            monthPlans.map((item) => item.id),
          ),
          semanticRankIds(
            'loan',
            search,
            monthLoans.map((item) => item.id),
          ),
        ])
        if (cancelled) return
        setSemanticExpenseIds(expenseIds)
        setSemanticPlanIds(planIds)
        setSemanticLoanIds(loanIds)
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    search,
    searchMode,
    similarAvailable,
    monthExpenses,
    monthPlans,
    monthLoans,
  ])

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return monthExpenses
    if (searchMode === 'similar' && semanticExpenseIds) {
      const map = new Map(monthExpenses.map((item) => [item.id, item]))
      return semanticExpenseIds
        .map((id) => map.get(id))
        .filter((item): item is Expense => Boolean(item))
    }
    return monthExpenses.filter((item) =>
      matchesSearch(
        `${item.category} ${item.description ?? ''} ${item.amount}`,
        search,
      ),
    )
  }, [monthExpenses, search, searchMode, semanticExpenseIds])

  const filteredPlans = useMemo(() => {
    if (!search.trim()) return monthPlans
    if (searchMode === 'similar' && semanticPlanIds) {
      const map = new Map(monthPlans.map((item) => [item.id, item]))
      return semanticPlanIds
        .map((id) => map.get(id))
        .filter((item): item is PlanExpense => Boolean(item))
    }
    return monthPlans.filter((item) =>
      matchesSearch(
        `${item.category} ${item.description ?? ''} ${item.amount}`,
        search,
      ),
    )
  }, [monthPlans, search, searchMode, semanticPlanIds])

  const filteredLoans = useMemo(() => {
    if (!search.trim()) return monthLoans
    if (searchMode === 'similar' && semanticLoanIds) {
      const map = new Map(monthLoans.map((item) => [item.id, item]))
      return semanticLoanIds
        .map((id) => map.get(id))
        .filter((item): item is Loan => Boolean(item))
    }
    return monthLoans.filter((item) =>
      matchesSearch(
        `${item.person} ${item.description ?? ''} ${item.direction} ${item.amount}`,
        search,
      ),
    )
  }, [monthLoans, search, searchMode, semanticLoanIds])

  const expenseTotal = useMemo(
    () => filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0),
    [filteredExpenses],
  )
  const planTotal = useMemo(() => sumPlans(filteredPlans), [filteredPlans])
  const borrowedTotal = useMemo(
    () => sumLoansByDirection(filteredLoans, 'borrowed'),
    [filteredLoans],
  )
  const lentTotal = useMemo(
    () => sumLoansByDirection(filteredLoans, 'lent'),
    [filteredLoans],
  )

  const voiceEnabled = caps ? canCaptureVoice(caps) : true

  const openCreate = () => {
    if (segment === 'expenses') {
      setEditingExpense(null)
      setExpenseDraft(null)
      setExpenseFormOpen(true)
    } else if (segment === 'plans') {
      setEditingPlan(null)
      setPlanFormOpen(true)
    } else {
      setEditingLoan(null)
      setLoanFormOpen(true)
    }
  }

  const handleVoicePointerDown = async (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (capturing || holdingVoice) return
    if (caps && !canCaptureVoice(caps)) {
      await present({
        message: 'Voice entry is not supported on this device',
        duration: 2500,
        color: 'warning',
      })
      return
    }

    event.preventDefault()
    voicePointerRef.current = event.pointerId
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }

    setHoldingVoice(true)
    try {
      const mode = await startVoiceHold()
      voiceModeRef.current = mode
      await present({
        message: 'Listening… release to save',
        duration: 1500,
        color: 'medium',
      })
    } catch (err) {
      setHoldingVoice(false)
      voiceModeRef.current = null
      await present({
        message: err instanceof Error ? err.message : 'Could not start voice',
        duration: 3000,
        color: 'danger',
      })
    }
  }

  const handleVoicePointerUp = async () => {
    if (!holdingVoice || !voiceModeRef.current) {
      setHoldingVoice(false)
      return
    }

    const mode = voiceModeRef.current
    voiceModeRef.current = null
    setHoldingVoice(false)
    setCapturing(true)
    try {
      const draft = await stopVoiceHold(mode, (message) => {
        void present({ message, duration: 1500, color: 'medium' })
      })
      setEditingExpense(null)
      setExpenseDraft(draft)
      setExpenseFormOpen(true)
    } catch (err) {
      await cancelHoldRecording()
      await cancelHoldSpeech()
      await present({
        message: err instanceof Error ? err.message : 'Voice capture failed',
        duration: 3000,
        color: 'danger',
      })
    } finally {
      setCapturing(false)
    }
  }

  const handleVoicePointerCancel = async () => {
    voiceModeRef.current = null
    setHoldingVoice(false)
    await cancelHoldRecording()
    await cancelHoldSpeech()
  }

  const handleReceiptFile = async (file: File | null) => {
    if (!file || capturing) return
    setCapturing(true)
    try {
      const draft = await captureExpenseFromReceipt(file, (message) => {
        void present({ message, duration: 1500, color: 'medium' })
      })
      setEditingExpense(null)
      setExpenseDraft(draft)
      setExpenseFormOpen(true)
    } catch (err) {
      await present({
        message: err instanceof Error ? err.message : 'Receipt scan failed',
        duration: 3000,
        color: 'danger',
      })
    } finally {
      setCapturing(false)
      if (scanInputRef.current) scanInputRef.current.value = ''
    }
  }

  const handleExpenseSubmit = async (values: ExpenseFormValues) => {
    const text = `${values.category} ${values.description ?? ''} ${values.amount}`
    if (editingExpense) {
      const updated = await updateExpense(editingExpense.id, {
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        receiptFile: values.receiptFile,
        clearReceipt: values.clearReceipt,
      })
      void indexSearchDocument('expense', updated.id, text)
      await present({
        message: 'Expense updated',
        duration: 1500,
        color: 'success',
      })
    } else {
      const created = await addExpense({
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        receiptFile: values.receiptFile,
      })
      void indexSearchDocument('expense', created.id, text)
      await present({
        message: 'Expense saved',
        duration: 1500,
        color: 'success',
      })
    }
  }

  const handlePlanSubmit = async (values: PlanFormValues) => {
    const text = `${values.category} ${values.description ?? ''} ${values.amount}`
    if (editingPlan) {
      const updated = await updatePlan(editingPlan.id, values)
      void indexSearchDocument('plan', updated.id, text)
      await present({
        message: 'Plan updated',
        duration: 1500,
        color: 'success',
      })
    } else {
      const created = await addPlan(values)
      void indexSearchDocument('plan', created.id, text)
      await present({
        message: 'Plan saved',
        duration: 1500,
        color: 'success',
      })
    }
  }

  const handleLoanSubmit = async (values: LoanFormValues) => {
    const text = `${values.person} ${values.description ?? ''} ${values.direction} ${values.amount}`
    if (editingLoan) {
      const updated = await updateLoan(editingLoan.id, {
        person: values.person,
        amount: values.amount,
        remaining: values.remaining ?? values.amount,
        direction: values.direction,
        loan_date: values.loan_date,
        due_date: values.due_date,
        description: values.description,
      })
      void indexSearchDocument('loan', updated.id, text)
      await present({
        message: 'Loan updated',
        duration: 1500,
        color: 'success',
      })
    } else {
      const created = await addLoan(values)
      void indexSearchDocument('loan', created.id, text)
      await present({
        message: 'Loan saved',
        duration: 1500,
        color: 'success',
      })
    }
  }

  const handleSearchModeChange = (mode: SearchMode) => {
    if (mode === 'similar' && !similarAvailable) return
    setSearchMode(mode)
    localStorage.setItem(SEARCH_MODE_KEY, mode)
  }

  return (
    <PageScaffold
      title="Money"
      fab={
        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          {segment === 'expenses' ? (
            <>
              <IonFabButton disabled={capturing}>
                <IonIcon icon={addOutline} />
              </IonFabButton>
              <IonFabList side="top">
                <IonFabButton
                  data-testid="fab-manual-expense"
                  onClick={openCreate}
                  disabled={capturing}
                >
                  <IonIcon icon={addOutline} />
                </IonFabButton>
                <IonFabButton
                  data-testid="fab-voice-expense"
                  color={holdingVoice ? 'danger' : voiceEnabled ? 'primary' : 'medium'}
                  disabled={capturing && !holdingVoice}
                  onPointerDown={(event) => void handleVoicePointerDown(event)}
                  onPointerUp={() => void handleVoicePointerUp()}
                  onPointerCancel={() => void handleVoicePointerCancel()}
                  style={{ touchAction: 'none' }}
                  title="Hold to talk"
                >
                  <IonIcon icon={micOutline} />
                </IonFabButton>
                <IonFabButton
                  data-testid="fab-scan-expense"
                  onClick={() => scanInputRef.current?.click()}
                  disabled={capturing}
                >
                  <IonIcon icon={cameraOutline} />
                </IonFabButton>
              </IonFabList>
            </>
          ) : (
            <IonFabButton onClick={openCreate} disabled={capturing}>
              <IonIcon icon={addOutline} />
            </IonFabButton>
          )}
        </IonFab>
      }
    >
      <input
        ref={scanInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="receipt-file-input"
        data-testid="receipt-scan-input"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          void handleReceiptFile(file)
        }}
      />

      <div className="page-section">
        <IonSegment
          value={segment}
          onIonChange={(event) =>
            setSegment((event.detail.value as MoneySegment) ?? 'expenses')
          }
        >
          <IonSegmentButton value="expenses">
            <IonLabel>Expenses</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="plans">
            <IonLabel>Plans</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="loans">
            <IonLabel>Loans</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        <MonthFilterBar monthKey={monthKey} onChange={setMonthKey} />
        <SearchBar
          value={search}
          placeholder={
            segment === 'loans'
              ? 'Search person, note…'
              : 'Search category, note…'
          }
          onChange={setSearch}
          mode={searchMode}
          onModeChange={handleSearchModeChange}
          similarAvailable={similarAvailable}
        />

        {segment === 'expenses' && (
          <>
            <ListTotalBar
              currency={currency}
              itemCount={filteredExpenses.length}
              itemLabel="expenses"
              lines={[{ label: 'Total', amount: expenseTotal }]}
            />
            <ExpenseList
              expenses={filteredExpenses}
              currency={currency}
              loading={expensesLoading}
              onEdit={(expense) => {
                setExpenseDraft(null)
                setEditingExpense(expense)
                setExpenseFormOpen(true)
              }}
              onDelete={async (id) => {
                await deleteExpense(id)
                void removeSearchDocument('expense', id)
                await present({
                  message: 'Expense deleted',
                  duration: 1500,
                  color: 'medium',
                })
              }}
            />
          </>
        )}

        {segment === 'plans' && (
          <>
            <ListTotalBar
              currency={currency}
              itemCount={filteredPlans.length}
              itemLabel="plans"
              lines={[{ label: 'Total', amount: planTotal }]}
            />
            <PlanList
              plans={filteredPlans}
              currency={currency}
              loading={plansLoading}
              onEdit={(plan) => {
                setEditingPlan(plan)
                setPlanFormOpen(true)
              }}
              onDelete={async (id) => {
                await deletePlan(id)
                void removeSearchDocument('plan', id)
                await present({
                  message: 'Plan deleted',
                  duration: 1500,
                  color: 'medium',
                })
              }}
              onMarkPaid={async (plan) => {
                await markPlanPaid(plan.id)
                await present({
                  message: 'Copied to expenses',
                  duration: 1800,
                  color: 'success',
                })
              }}
            />
          </>
        )}

        {segment === 'loans' && (
          <>
            <ListTotalBar
              currency={currency}
              itemCount={filteredLoans.length}
              itemLabel="loans"
              lines={[
                { label: 'Borrowed', amount: borrowedTotal },
                { label: 'Lent', amount: lentTotal },
              ]}
            />
            <LoanList
              loans={filteredLoans}
              currency={currency}
              loading={loansLoading}
              onEdit={(loan) => {
                setEditingLoan(loan)
                setLoanFormOpen(true)
              }}
              onDelete={async (id) => {
                await deleteLoan(id)
                void removeSearchDocument('loan', id)
                await present({
                  message: 'Loan deleted',
                  duration: 1500,
                  color: 'medium',
                })
              }}
              onPay={setPayingLoan}
            />
          </>
        )}
      </div>

      <ExpenseFormModal
        isOpen={expenseFormOpen}
        expense={editingExpense}
        draft={expenseDraft}
        onDismiss={() => {
          setExpenseFormOpen(false)
          setEditingExpense(null)
          setExpenseDraft(null)
        }}
        onSubmit={handleExpenseSubmit}
      />
      <PlanFormModal
        isOpen={planFormOpen}
        plan={editingPlan}
        onDismiss={() => {
          setPlanFormOpen(false)
          setEditingPlan(null)
        }}
        onSubmit={handlePlanSubmit}
      />
      <LoanFormModal
        isOpen={loanFormOpen}
        loan={editingLoan}
        onDismiss={() => {
          setLoanFormOpen(false)
          setEditingLoan(null)
        }}
        onSubmit={handleLoanSubmit}
      />
      <LoanPaymentModal
        isOpen={Boolean(payingLoan)}
        loan={payingLoan}
        currency={currency}
        onDismiss={() => setPayingLoan(null)}
        onSubmit={async (amount, paidDate) => {
          if (!payingLoan) return
          await recordLoanPayment(payingLoan.id, amount, paidDate)
          await present({
            message: 'Payment copied to expenses',
            duration: 1800,
            color: 'success',
          })
        }}
      />
    </PageScaffold>
  )
}
