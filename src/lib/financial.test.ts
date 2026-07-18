import { describe, expect, it } from 'vitest'
import type { AppState, Payment, Project } from '../types'
import { getPaymentCashEffect, getProjectProfit, getFinancialForecast, reconcilePendingFinalPayments } from './financial'

const receivedPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1',
  clientId: 'client-1',
  projectId: 'project-1',
  paymentType: 'Pagamento final',
  amount: 1000,
  dueDate: '2026-07-10',
  paidAt: '2026-07-10T12:00:00-03:00',
  paymentMethod: 'PIX',
  status: 'Recebida',
  notes: '',
  createdAt: '2026-07-01T12:00:00-03:00',
  updatedAt: '2026-07-10T12:00:00-03:00',
  ...overrides,
})

const project: Project = {
  id: 'project-1', projectCode: 'P-1', name: 'Projeto', clientId: 'client-1', serviceName: 'Fotos e vídeo', description: '', captureDate: '2026-07-01', captureStartTime: '09:00', captureEndTime: '10:00', deliveryDeadline: '2026-07-10', address: '', city: 'Curitiba', contactName: '', contactPhone: '', totalValue: 1000, discountValue: 0, travelFee: 0, depositValue: 0, remainingValue: 0, projectStatus: 'Pago', financialStatus: 'Pago', paymentMethod: 'PIX', notes: '', equipmentNeeded: [], links: [], responsibleUserId: '', createdAt: '2026-07-01T12:00:00-03:00', updatedAt: '2026-07-10T12:00:00-03:00',
}

const state = (payments: Payment[]): AppState => ({
  users: [], leads: [], leadInteractions: [], clients: [], services: [], projects: [project], projectChecklistItems: [], appointments: [], quotes: [], quoteItems: [], payments, expenses: [], recurringExpenses: [], bankAccounts: [], bankTransfers: [], files: [], projectRevisions: [], equipment: [], notifications: [], tasks: [], statusHistory: [], projectAdjustments: [], companySettings: {} as AppState['companySettings'], updatedAt: new Date().toISOString(),
})

describe('financial calculations', () => {
  it('treats a linked refund as a negative cash movement', () => {
    expect(getPaymentCashEffect(receivedPayment({ paymentType: 'Reembolso', amount: 250 }))).toBe(-250)
  })

  it('separates contracted and realized project profitability', () => {
    const result = getProjectProfit(state([receivedPayment({ amount: 400 })]), project)
    expect(result.contractedRevenue).toBe(1000)
    expect(result.contractedProfit).toBe(1000)
    expect(result.profit).toBe(400)
  })

  it('does not count received payments as future inflow', () => {
    expect(getFinancialForecast(state([receivedPayment()])).entries).toHaveLength(0)
  })

  it('recalculates the pending final payment after partial receipts', () => {
    const contractedProject = { ...project, totalValue: 350 }
    const payments = [
      receivedPayment({ id: 'deposit', paymentType: 'Sinal', amount: 100 }),
      receivedPayment({ id: 'installment', paymentType: 'Parcela', amount: 100 }),
      receivedPayment({ id: 'final', amount: 250, status: 'Pendente', paidAt: undefined }),
    ]

    const reconciled = reconcilePendingFinalPayments([contractedProject], payments)

    expect(reconciled.find((payment) => payment.id === 'final')?.amount).toBe(150)
  })

  it('restores the pending balance when a receipt is reopened', () => {
    const contractedProject = { ...project, totalValue: 350 }
    const payments = [
      receivedPayment({ id: 'deposit', paymentType: 'Sinal', amount: 100 }),
      receivedPayment({ id: 'installment', paymentType: 'Parcela', amount: 100, status: 'Pendente', paidAt: undefined }),
      receivedPayment({ id: 'final', amount: 150, status: 'Pendente', paidAt: undefined }),
    ]

    const reconciled = reconcilePendingFinalPayments([contractedProject], payments)

    expect(reconciled.find((payment) => payment.id === 'final')?.amount).toBe(250)
  })
})
