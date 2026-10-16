import {
  IonFab,
  IonFabButton,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  useIonToast,
} from '@ionic/react'
import { addOutline } from 'ionicons/icons'
import { useMemo, useState } from 'react'
import { ListTotalBar } from '../components/common/ListTotalBar'
import { MonthFilterBar } from '../components/common/MonthFilterBar'
import { PageScaffold } from '../components/common/PageScaffold'
import { SearchBar } from '../components/common/SearchBar'
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

type MoneySegment = 'expenses' | 'plans' | 'loans'

function matchesSearch(haystack: string, query: string): boolean {
  if (!query.trim()) return true
  return haystack.toLowerCase().includes(query.trim().toLowerCase())
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
  const [present] = useIonToast()

  const [expenseFormOpen, setExpenseFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanExpense | null>(null)
  const [loanFormOpen, setLoanFormOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null)

  const filteredExpenses = useMemo(() => {
    let list = expenses
    if (monthKey) {
      list = list.filter((item) => toMonthKey(item.date) === monthKey)
    }
    if (search.trim()) {
      list = list.filter((item) =>
        matchesSearch(
          `${item.category} ${item.description ?? ''} ${item.amount}`,
          search,
        ),
      )
    }
    return list
  }, [expenses, monthKey, search])

  const filteredPlans = useMemo(() => {
    let list = filterPlansByMonth(
      plans.filter((plan) => plan.status === 'upcoming'),
      monthKey,
    )
    if (search.trim()) {
      list = list.filter((item) =>
        matchesSearch(
          `${item.category} ${item.description ?? ''} ${item.amount}`,
          search,
        ),
      )
    }
    return list
  }, [plans, monthKey, search])

  const filteredLoans = useMemo(() => {
    let list = filterLoansByMonth(loans, monthKey)
    if (search.trim()) {
      list = list.filter((item) =>
        matchesSearch(
          `${item.person} ${item.description ?? ''} ${item.direction} ${item.amount}`,
          search,
        ),
      )
    }
    return list
  }, [loans, monthKey, search])

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

  const openCreate = () => {
    if (segment === 'expenses') {
      setEditingExpense(null)
      setExpenseFormOpen(true)
    } else if (segment === 'plans') {
      setEditingPlan(null)
      setPlanFormOpen(true)
    } else {
      setEditingLoan(null)
      setLoanFormOpen(true)
    }
  }

  const handleExpenseSubmit = async (values: ExpenseFormValues) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, {
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        receiptFile: values.receiptFile,
        clearReceipt: values.clearReceipt,
      })
      await present({
        message: 'Expense updated',
        duration: 1500,
        color: 'success',
      })
    } else {
      await addExpense({
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        receiptFile: values.receiptFile,
      })
      await present({
        message: 'Expense saved',
        duration: 1500,
        color: 'success',
      })
    }
  }

  const handlePlanSubmit = async (values: PlanFormValues) => {
    if (editingPlan) {
      await updatePlan(editingPlan.id, values)
      await present({
        message: 'Plan updated',
        duration: 1500,
        color: 'success',
      })
    } else {
      await addPlan(values)
      await present({
        message: 'Plan saved',
        duration: 1500,
        color: 'success',
      })
    }
  }

  const handleLoanSubmit = async (values: LoanFormValues) => {
    if (editingLoan) {
      await updateLoan(editingLoan.id, {
        person: values.person,
        amount: values.amount,
        remaining: values.remaining ?? values.amount,
        direction: values.direction,
        loan_date: values.loan_date,
        due_date: values.due_date,
        description: values.description,
      })
      await present({
        message: 'Loan updated',
        duration: 1500,
        color: 'success',
      })
    } else {
      await addLoan(values)
      await present({
        message: 'Loan saved',
        duration: 1500,
        color: 'success',
      })
    }
  }

  return (
    <PageScaffold
      title="Money"
      fab={
        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton onClick={openCreate}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      }
    >
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
                setEditingExpense(expense)
                setExpenseFormOpen(true)
              }}
              onDelete={async (id) => {
                await deleteExpense(id)
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
        onDismiss={() => {
          setExpenseFormOpen(false)
          setEditingExpense(null)
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
