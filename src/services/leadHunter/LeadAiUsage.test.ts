import { describe, expect, it } from 'vitest'
import type { LeadHunterProspect, LeadHunterSearch } from '../../types'
import { aiUsageToday, localDayKey, remainingAiCalls, shouldSkipManualEnrichment } from './LeadAiUsage'

describe('Lead Hunter AI usage', () => {
  it('conta apenas chamadas com tokens no dia local', () => {
    const searches = [
      { createdAt: '2026-07-19T12:00:00', tokenUsage: 120 },
      { createdAt: '2026-07-19T13:00:00', tokenUsage: 0 },
      { createdAt: '2026-07-18T12:00:00', tokenUsage: 80 },
    ] as LeadHunterSearch[]
    expect(aiUsageToday(searches, new Date('2026-07-19T15:00:00'))).toEqual({ calls: 1, tokens: 120 })
    expect(remainingAiCalls(searches, { maxDailyCalls: 2 }, new Date('2026-07-19T15:00:00'))).toBe(1)
  })

  it('evita analisar manualmente o mesmo lead duas vezes no dia', () => {
    const prospect = { lastAnalyzedAt: '2026-07-19T10:00:00' } as LeadHunterProspect
    expect(shouldSkipManualEnrichment(prospect, new Date('2026-07-19T18:00:00'))).toBe(true)
    expect(localDayKey('data-invalida')).toBe('')
  })
})
