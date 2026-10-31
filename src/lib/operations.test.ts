import { createEmptyState } from '../data/demoData'
import { describe, expect, it } from 'vitest'
import type { AppState, Lead } from '../types'
import { buildOperationalTasks, synchronizeOperationalState } from './operations'

const now = new Date('2026-08-05T12:00:00.000Z')

const lead = {
  id: 'lead-1',
  fullName: 'Área 51 Airsoft',
  archived: false,
  pipelineStage: 'Contato realizado',
  nextContactAt: '2026-08-05T13:30:00.000Z',
} as Lead

const stateWith = (overrides: Partial<AppState> = {}) => ({
  leads: [lead],
  quotes: [],
  projects: [],
  appointments: [],
  tasks: [],
  dismissedTaskSourceKeys: [],
  ...overrides,
} as AppState)

describe('buildOperationalTasks', () => {
  it('não recria uma tarefa automática excluída manualmente', () => {
    const sourceKey = `lead-followup:${lead.id}`
    const tasks = buildOperationalTasks(stateWith({ dismissedTaskSourceKeys: [sourceKey] }), now)

    expect(tasks.some((task) => task.sourceKey === sourceKey)).toBe(false)
  })

  it('continua gerando uma tarefa automática que não foi excluída', () => {
    const tasks = buildOperationalTasks(stateWith(), now)

    expect(tasks).toContainEqual(expect.objectContaining({
      sourceKey: `lead-followup:${lead.id}`,
      title: 'Realizar retorno de Área 51 Airsoft',
    }))
  })
})

describe('notificações automáticas', () => {
  const project = { id: 'p1', name: 'Obra', projectStatus: 'Em edição', responsibleUserId: '', deliveryDeadline: '2026-08-07' }
  const withProject = () => ({ ...createEmptyState(), projects: [project] }) as unknown as AppState

  it('aviso lido não volta como não lido no dia seguinte', () => {
    const first = synchronizeOperationalState(withProject(), new Date(2026, 7, 5, 12))
    const read = { ...first, notifications: first.notifications.map((item) => ({ ...item, read: true })) }
    const nextDay = synchronizeOperationalState(read, new Date(2026, 7, 6, 12))
    expect(nextDay.notifications).toHaveLength(1)
    expect(nextDay.notifications[0].read).toBe(true)
  })

  it('o atraso gera um aviso novo mesmo com o de entrega próxima já lido', () => {
    const first = synchronizeOperationalState(withProject(), new Date(2026, 7, 6, 12))
    const read = { ...first, notifications: first.notifications.map((item) => ({ ...item, read: true })) }
    const late = synchronizeOperationalState(read, new Date(2026, 7, 9, 12))
    expect(late.notifications[0]).toEqual(expect.objectContaining({ title: 'Projeto atrasado', read: false }))
  })
})

describe('virada do dia no fuso local', () => {
  it('não vence um pagamento que vence hoje à noite', () => {
    const lateEvening = new Date(2026, 9, 30, 23, 30)
    const state = synchronizeOperationalState({
      ...createEmptyState(),
      payments: [{ id: 'p', clientId: 'c', paymentType: 'Sinal', amount: 100, dueDate: '2026-10-30', paymentMethod: 'PIX', status: 'Pendente', notes: '', createdAt: '', updatedAt: '' }],
    }, lateEvening)
    expect(state.payments[0].status).toBe('Pendente')
  })
})
