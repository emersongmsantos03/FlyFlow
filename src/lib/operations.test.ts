import { describe, expect, it } from 'vitest'
import type { AppState, Lead } from '../types'
import { buildOperationalTasks } from './operations'

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
