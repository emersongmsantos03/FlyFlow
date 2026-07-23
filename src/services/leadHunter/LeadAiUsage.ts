import type { LeadHunterProspect, LeadHunterSettings } from '../../types'

type AiUsageRecord = { createdAt: string; tokenUsage?: number }

export const localDayKey = (value: string | Date = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const aiUsageToday = (searches: AiUsageRecord[], now = new Date()) => {
  const today = localDayKey(now)
  const completedCalls = searches.filter((search) =>
    (search.tokenUsage || 0) > 0 && localDayKey(search.createdAt) === today,
  )
  return {
    calls: completedCalls.length,
    tokens: completedCalls.reduce((total, search) => total + (search.tokenUsage || 0), 0),
  }
}

export const remainingAiCalls = (
  searches: AiUsageRecord[],
  settings: Pick<LeadHunterSettings, 'maxDailyCalls'>,
  now = new Date(),
) => Math.max(0, settings.maxDailyCalls - aiUsageToday(searches, now).calls)

export const shouldSkipManualEnrichment = (prospect: LeadHunterProspect, now = new Date()) =>
  Boolean(prospect.lastAnalyzedAt && localDayKey(prospect.lastAnalyzedAt) === localDayKey(now))
