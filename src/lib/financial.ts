import type { AppState, BankAccount, Expense, Payment, Project } from '../types'

export type PeriodPreset =
  | 'today'
  | 'week'
  | 'month'
  | 'last30'
  | 'quarter'
  | 'year'
  | 'all'

export type AccountingRegime = 'cash' | 'accrual'

export const periodOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'last30', label: 'Últimos 30 dias' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
  { value: 'all', label: 'Tudo' },
]

const parseDate = (value?: string) => {
  if (!value) return undefined
  if (value.length === 10) return new Date(`${value}T12:00:00`)
  return new Date(value)
}

const startOfDay = (date: Date) => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

const endOfDay = (date: Date) => {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

const addDays = (date: Date, amount: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

export const getPeriodRange = (preset: PeriodPreset) => {
  const now = new Date()

  if (preset === 'all') {
    return {
      start: new Date(2000, 0, 1),
      end: endOfDay(new Date(2100, 11, 31)),
    }
  }

  if (preset === 'today') {
    return {
      start: startOfDay(now),
      end: endOfDay(now),
    }
  }

  if (preset === 'week') {
    const start = startOfDay(now)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    return {
      start,
      end: endOfDay(addDays(start, 6)),
    }
  }

  if (preset === 'last30') {
    return {
      start: startOfDay(addDays(now, -30)),
      end: endOfDay(now),
    }
  }

  if (preset === 'quarter') {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3
    return {
      start: new Date(now.getFullYear(), quarterStart, 1),
      end: endOfDay(new Date(now.getFullYear(), quarterStart + 3, 0)),
    }
  }

  if (preset === 'year') {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: endOfDay(new Date(now.getFullYear(), 11, 31)),
    }
  }

  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

const isInRange = (value: string | undefined, start: Date, end: Date) => {
  const date = parseDate(value)
  if (!date) return false
  return date >= start && date <= end
}

const billableProjectStatuses = new Set([
  'Confirmado',
  'Agendado',
  'Captação realizada',
  'Seleção de arquivos',
  'Em edição',
  'Aguardando revisão',
  'Ajustes solicitados',
  'Pronto para entrega',
  'Entregue',
  'Aguardando pagamento final',
  'Pago',
  'Concluído',
  'Finalizado',
])

const projectAccrualDate = (project: Project) => project.deliveryDeadline || project.captureDate || project.createdAt

export const isReceivedPayment = (payment: Payment) => payment.status === 'Recebida' && !payment.archivedAt && !payment.deletedAt

export const getPaymentCashEffect = (payment: Payment) => isReceivedPayment(payment) ? (payment.paymentType === 'Reembolso' ? -payment.amount : payment.amount) : 0

export const isCancelledPayment = (payment: Payment) =>
  payment.status === 'Cancelada' || payment.status === 'Reembolsada' || Boolean(payment.archivedAt || payment.deletedAt)

export const isPaidExpense = (expense: Expense) =>
  expense.status === 'Paga' && !expense.archivedAt && !expense.deletedAt

export const isCancelledExpense = (expense: Expense) =>
  expense.status === 'Cancelada' || expense.status === 'Reembolsada' || Boolean(expense.archivedAt || expense.deletedAt)

export const isExpenseOverdue = (expense: Expense) =>
  !isPaidExpense(expense) && !isCancelledExpense(expense) && Boolean(expense.dueDate) && getDaysUntil(expense.dueDate) < 0

export const getMonthlyRecurringExpenseAmount = (expense: Expense) => {
  if (!expense.recurring || isCancelledExpense(expense)) return 0
  if (expense.recurrenceEndDate && getDaysUntil(expense.recurrenceEndDate) < 0) return 0
  const multiplier = {
    Semanal: 52 / 12,
    Quinzenal: 26 / 12,
    Mensal: 1,
    Bimestral: 1 / 2,
    Trimestral: 1 / 3,
    Semestral: 1 / 6,
    Anual: 1 / 12,
  }[expense.recurrenceFrequency || 'Mensal']
  return expense.amount * multiplier
}

export const getBankAccountBalance = (state: AppState, account: BankAccount) => {
  const received = state.payments
    .filter((payment) => payment.bankAccountId === account.id && isReceivedPayment(payment))
    .reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
  const paidExpenses = state.expenses
    .filter((expense) => expense.bankAccountId === account.id && isPaidExpense(expense))
    .reduce((total, expense) => total + expense.amount, 0)
  const incomingTransfers = state.bankTransfers
    .filter((transfer) => transfer.toAccountId === account.id)
    .reduce((total, transfer) => total + transfer.amount, 0)
  const outgoingTransfers = state.bankTransfers
    .filter((transfer) => transfer.fromAccountId === account.id)
    .reduce((total, transfer) => total + transfer.amount, 0)

  return account.openingBalance + received - paidExpenses + incomingTransfers - outgoingTransfers
}

export const getTotalBankBalance = (state: AppState) =>
  state.bankAccounts.reduce((total, account) => total + getBankAccountBalance(state, account), 0)

export const getProjectPayments = (state: AppState, projectId: string) =>
  state.payments.filter((payment) => payment.projectId === projectId && !isCancelledPayment(payment))

export const getProjectPaidAmount = (state: AppState, projectId: string) =>
  getProjectPayments(state, projectId)
    .filter(isReceivedPayment)
    .reduce((total, payment) => total + getPaymentCashEffect(payment), 0)

export const getProjectPendingAmount = (state: AppState, project: Project) =>
  Math.max(project.totalValue - getProjectPaidAmount(state, project.id), 0)

export const getProjectDirectCosts = (state: AppState, projectId: string) =>
  state.expenses
    .filter(
      (expense) =>
        expense.projectId === projectId &&
        expense.expenseType === 'Custo direto do projeto' &&
        expense.status !== 'Cancelada' &&
        expense.status !== 'Reembolsada' &&
        !expense.archivedAt &&
        !expense.deletedAt,
    )
    .reduce((total, expense) => total + expense.amount, 0)

export const getProjectProfit = (state: AppState, project: Project) => {
  const paid = getProjectPaidAmount(state, project.id)
  const directCosts = getProjectDirectCosts(state, project.id)
  const profit = paid - directCosts
  const margin = paid > 0 ? (profit / paid) * 100 : 0
  const contractedProfit = project.totalValue - directCosts
  const contractedMargin = project.totalValue > 0 ? (contractedProfit / project.totalValue) * 100 : 0

  return {
    paid,
    directCosts,
    profit,
    margin,
    contractedRevenue: project.totalValue,
    contractedProfit,
    contractedMargin,
    pending: Math.max(project.totalValue - paid, 0),
  }
}

export const isOfficialExpense = (expense: Expense) =>
  expense.expenseType !== 'Despesa pessoal não contabilizável' &&
  expense.expenseType !== 'Investimento em equipamento' &&
  expense.status !== 'Cancelada' &&
  expense.status !== 'Reembolsada' &&
  !expense.archivedAt &&
  !expense.deletedAt

export const calculateDashboardMetrics = (
  state: AppState,
  period: PeriodPreset = 'month',
  regime: AccountingRegime = 'cash',
) => {
  const { start, end } = getPeriodRange(period)
  const billableProjects = state.projects.filter((project) =>
    !project.archivedAt && !project.deletedAt && billableProjectStatuses.has(project.projectStatus),
  )

  const periodProjects = billableProjects.filter((project) =>
    isInRange(projectAccrualDate(project), start, end),
  )

  const receivedPayments = state.payments.filter(
    (payment) => isReceivedPayment(payment) && isInRange(payment.paidAt, start, end),
  )

  const revenueByAccrual = periodProjects.reduce((total, project) => total + project.totalValue, 0)
  const revenueByCash = receivedPayments.reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
  const revenue = regime === 'cash' ? revenueByCash : revenueByAccrual

  const allPendingPayments = state.payments.filter((payment) => !isReceivedPayment(payment) && !isCancelledPayment(payment))
  const pendingReceivableTotal = allPendingPayments.reduce((total, payment) => total + payment.amount, 0)
  const pendingReceivable = allPendingPayments
    .filter((payment) => isInRange(payment.dueDate, start, end))
    .reduce((total, payment) => total + payment.amount, 0)

  const officialPeriodExpenses = state.expenses.filter(
    (expense) =>
      isOfficialExpense(expense) && (
        regime === 'cash'
          ? isPaidExpense(expense) && isInRange(expense.paidAt, start, end)
          : isInRange(expense.expenseDate, start, end)
      ),
  )

  const directCosts = officialPeriodExpenses
    .filter((expense) => expense.expenseType === 'Custo direto do projeto')
    .reduce((total, expense) => total + expense.amount, 0)

  const operatingExpenses = officialPeriodExpenses
    .filter(
      (expense) =>
        expense.expenseType === 'Despesa operacional' ||
        expense.expenseType === 'Despesa administrativa',
    )
    .reduce((total, expense) => total + expense.amount, 0)

  const taxes = officialPeriodExpenses
    .filter((expense) => expense.expenseType === 'Imposto')
    .reduce((total, expense) => total + expense.amount, 0)

  const totalExpenses = directCosts + operatingExpenses + taxes
  const grossProfit = revenue - directCosts
  const netProfit = revenue - directCosts - operatingExpenses - taxes
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0

  const validLeads = state.leads.filter((lead) => !lead.archived && !lead.deletedAt)
  const convertedLeads = validLeads.filter(
    (lead) => lead.pipelineStage === 'Convertido em cliente' || lead.pipelineStage === 'Serviço agendado',
  )
  const leadConversion = validLeads.length > 0 ? (convertedLeads.length / validLeads.length) * 100 : 0

  const predictedPipelineValue = validLeads.reduce(
    (total, lead) => total + lead.estimatedValue * (lead.probability / 100),
    0,
  )

  const completedProjects = periodProjects.filter((project) =>
    ['Entregue', 'Pago', 'Concluído', 'Finalizado'].includes(project.projectStatus),
  )

  const allPendingExpenses = state.expenses.filter((expense) => !isPaidExpense(expense) && !isCancelledExpense(expense))
  const pendingExpensesTotal = allPendingExpenses.reduce((total, expense) => total + expense.amount, 0)
  const pendingExpenses = allPendingExpenses
    .filter((expense) => isInRange(expense.dueDate || expense.expenseDate, start, end))
    .reduce((total, expense) => total + expense.amount, 0)
  const recurringMonthlyExpenses = state.expenses.reduce((total, expense) => total + getMonthlyRecurringExpenseAmount(expense), 0)

  return {
    revenue,
    revenueByCash,
    revenueByAccrual,
    received: revenueByCash,
    pendingReceivable,
    pendingReceivableTotal,
    expenses: totalExpenses,
    directCosts,
    operatingExpenses,
    taxes,
    pendingExpenses,
    pendingExpensesTotal,
    recurringMonthlyExpenses,
    overdueExpenses: state.expenses.filter((expense) => isExpenseOverdue(expense) && isInRange(expense.dueDate, start, end)).length,
    overdueExpensesTotal: state.expenses.filter(isExpenseOverdue).length,
    grossProfit,
    netProfit,
    margin,
    newLeads: state.leads.filter((lead) => !lead.deletedAt && isInRange(lead.entryDate, start, end)).length,
    scheduledServices: state.projects.filter((project) => !project.deletedAt && !project.archivedAt && project.projectStatus === 'Agendado').length,
    editingProjects: state.projects.filter((project) => !project.deletedAt && !project.archivedAt && project.projectStatus === 'Em edição').length,
    upcomingDeliveries: state.projects.filter((project) => {
      if (project.deletedAt || project.archivedAt) return false
      const days = getDaysUntil(project.deliveryDeadline)
      return days >= 0 && days <= 7 && project.projectStatus !== 'Entregue'
    }).length,
    overduePayments: state.payments.filter((payment) => isPaymentOverdue(payment) && isInRange(payment.dueDate, start, end)).length,
    overduePaymentsTotal: state.payments.filter(isPaymentOverdue).length,
    averageTicket:
      periodProjects.length > 0
        ? periodProjects.reduce((total, project) => total + project.totalValue, 0) /
          periodProjects.length
        : 0,
    averageProjectCost:
      completedProjects.length > 0 ? directCosts / completedProjects.length : 0,
    leadConversion,
    predictedPipelineValue,
    projectCount: periodProjects.length,
  }
}

export const getDaysUntil = (value?: string) => {
  const target = parseDate(value)
  if (!target) return 0
  const today = startOfDay(new Date())
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export const isPaymentOverdue = (payment: Payment) => {
  if (isReceivedPayment(payment) || isCancelledPayment(payment)) return false
  return getDaysUntil(payment.dueDate) < 0
}

const addRecurrence = (date: Date, frequency: Expense['recurrenceFrequency']) => {
  const next = new Date(date)
  if (frequency === 'Semanal') next.setDate(next.getDate() + 7)
  else if (frequency === 'Quinzenal') next.setDate(next.getDate() + 15)
  else if (frequency === 'Bimestral') next.setMonth(next.getMonth() + 2)
  else if (frequency === 'Trimestral') next.setMonth(next.getMonth() + 3)
  else if (frequency === 'Semestral') next.setMonth(next.getMonth() + 6)
  else if (frequency === 'Anual') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next
}

export const getFinancialForecast = (state: AppState, horizonDays = 90) => {
  const today = startOfDay(new Date())
  const horizon = endOfDay(addDays(today, horizonDays))
  const entries: Array<{ id: string; date: Date; type: 'Entrada' | 'Saída'; amount: number; description: string }> = []

  state.payments
    .filter((payment) => !isReceivedPayment(payment) && !isCancelledPayment(payment))
    .forEach((payment) => {
      const date = parseDate(payment.dueDate)
      if (date && date <= horizon) entries.push({ id: payment.id, date, type: 'Entrada', amount: payment.amount, description: payment.paymentType })
    })

  state.expenses
    .filter((expense) => !isCancelledExpense(expense))
    .forEach((expense) => {
      const dueDate = parseDate(expense.dueDate || expense.expenseDate)
      if (!isPaidExpense(expense) && dueDate && dueDate <= horizon) entries.push({ id: expense.id, date: dueDate, type: 'Saída', amount: expense.amount, description: expense.description })
      if (!expense.recurring) return
      let occurrence = addRecurrence(dueDate || today, expense.recurrenceFrequency)
      const recurrenceEnd = parseDate(expense.recurrenceEndDate)
      let index = 1
      while (occurrence <= horizon && (!recurrenceEnd || occurrence <= recurrenceEnd) && index <= 100) {
        if (occurrence >= today) entries.push({ id: `${expense.id}-recurrence-${index}`, date: occurrence, type: 'Saída', amount: expense.amount, description: `${expense.description} (recorrente)` })
        occurrence = addRecurrence(occurrence, expense.recurrenceFrequency)
        index += 1
      }
    })

  const bucketDefinitions = [
    { label: 'Vencidos', from: -36500, to: -1 },
    { label: 'Próximos 7 dias', from: 0, to: 7 },
    { label: '8 a 30 dias', from: 8, to: 30 },
    { label: '31 a 60 dias', from: 31, to: 60 },
    { label: '61 a 90 dias', from: 61, to: 90 },
  ]
  const buckets = bucketDefinitions.map((bucket) => {
    const items = entries.filter((entry) => {
      const days = Math.floor((startOfDay(entry.date).getTime() - today.getTime()) / 86_400_000)
      return days >= bucket.from && days <= bucket.to
    })
    const inflow = items.filter((item) => item.type === 'Entrada').reduce((total, item) => total + item.amount, 0)
    const outflow = items.filter((item) => item.type === 'Saída').reduce((total, item) => total + item.amount, 0)
    return { ...bucket, inflow, outflow, net: inflow - outflow, items }
  })
  return { entries, buckets, projectedBalance: getTotalBankBalance(state) + entries.reduce((total, item) => total + (item.type === 'Entrada' ? item.amount : -item.amount), 0) }
}

export const recalculateProjectFinancials = (project: Project, payments: Payment[]): Project => {
  const projectPayments = payments.filter(
    (payment) => payment.projectId === project.id && !isCancelledPayment(payment),
  )
  const paid = projectPayments.filter(isReceivedPayment).reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
  const remaining = Math.max(project.totalValue - paid, 0)
  const overdue = projectPayments.some((payment) => isPaymentOverdue(payment))
  const hasDeposit = projectPayments.some(
    (payment) => payment.paymentType === 'Sinal' && isReceivedPayment(payment),
  )

  let financialStatus: Project['financialStatus'] = project.financialStatus
  if (paid >= project.totalValue && project.totalValue > 0) financialStatus = 'Pago'
  else if (paid > 0) financialStatus = 'Parcialmente pago'
  else if (overdue) financialStatus = 'Vencido'
  else if (project.depositValue > 0) financialStatus = 'Aguardando sinal'
  else financialStatus = 'Não faturado'

  let projectStatus = project.projectStatus
  if (hasDeposit && ['Orçamento', 'Aguardando aprovação', 'Aguardando sinal'].includes(projectStatus)) {
    projectStatus = project.captureDate ? 'Agendado' : 'Confirmado'
  }

  return {
    ...project,
    remainingValue: remaining,
    financialStatus,
    projectStatus,
    updatedAt: new Date().toISOString(),
  }
}

export const buildMonthlySeries = (state: AppState, regime: AccountingRegime = 'cash') => {
  const today = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1)
    const month = monthDate.getMonth()
    const year = monthDate.getFullYear()
    const start = new Date(year, month, 1)
    const end = endOfDay(new Date(year, month + 1, 0))

    const revenue = regime === 'cash'
      ? state.payments
        .filter((payment) => isReceivedPayment(payment) && isInRange(payment.paidAt, start, end))
        .reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
      : state.projects
        .filter((project) => !project.archivedAt && !project.deletedAt && billableProjectStatuses.has(project.projectStatus) && isInRange(projectAccrualDate(project), start, end))
        .reduce((total, project) => total + project.totalValue, 0)

    const expenses = state.expenses
      .filter(
        (expense) =>
          isOfficialExpense(expense) && (
            regime === 'cash'
              ? isPaidExpense(expense) && isInRange(expense.paidAt, start, end)
              : isInRange(expense.expenseDate, start, end)
          ),
      )
      .reduce((total, expense) => total + expense.amount, 0)

    const directCosts = state.expenses
      .filter(
        (expense) =>
          !expense.deletedAt && !expense.archivedAt && expense.expenseType === 'Custo direto do projeto' &&
          (regime === 'cash'
            ? isPaidExpense(expense) && isInRange(expense.paidAt, start, end)
            : isInRange(expense.expenseDate, start, end)),
      )
      .reduce((total, expense) => total + expense.amount, 0)

    return {
      month: monthDate.toLocaleDateString('pt-BR', { month: 'short' }),
      faturamento: revenue,
      lucro: revenue - expenses,
      despesas: expenses,
      custos: directCosts,
      servicos: state.projects.filter((project) => !project.deletedAt && !project.archivedAt && isInRange(project.captureDate, start, end)).length,
    }
  })
}

export const buildLeadSourceSeries = (state: AppState) => {
  const sources = new Map<string, number>()
  state.leads.filter((lead) => !lead.deletedAt && !lead.archived).forEach((lead) => sources.set(lead.source, (sources.get(lead.source) || 0) + 1))
  return Array.from(sources.entries()).map(([source, total]) => ({ source, total }))
}

export const buildServiceSeries = (state: AppState) => {
  const services = new Map<string, number>()
  state.projects.filter((project) => !project.deletedAt && !project.archivedAt).forEach((project) =>
    services.set(project.serviceName, (services.get(project.serviceName) || 0) + 1),
  )
  return Array.from(services.entries()).map(([service, total]) => ({ service, total }))
}
