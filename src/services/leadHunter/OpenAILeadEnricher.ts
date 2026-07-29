import { firebaseAuth } from '../firebase'
import type { LeadHunterProspect } from '../../types'
import type { LeadEnrichmentResult } from './providers'
import type { LeadSearchProviderResult } from './providers'

const endpoint = (import.meta.env.VITE_LEAD_HUNTER_API_URL || '').replace(/\/$/, '')

export const isOpenAILeadEnrichmentConfigured = Boolean(endpoint)

export async function discoverLeadsFromBackend(
  input: { cities: string[]; categories: string[]; limit: number; excludedNames?: string[] },
  signal?: AbortSignal,
): Promise<LeadSearchProviderResult> {
  if (!endpoint) return { leads: [], sources: [], warnings: ['Backend de descoberta não configurado.'] }
  const token = await firebaseAuth?.currentUser?.getIdToken().catch(() => '') || ''
  const response = await fetch(`${endpoint}/lead-discovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
    signal,
  })
  const body = await response.json().catch(() => ({})) as LeadSearchProviderResult & { error?: string }
  if (!response.ok) throw new Error(body.error || 'A busca protegida de leads não respondeu.')
  return body
}

export async function enrichLeadsWithOpenAI(
  leads: LeadHunterProspect[],
  signal?: AbortSignal,
): Promise<{ leads: LeadEnrichmentResult[]; tokenUsage: number }> {
  if (!endpoint || !leads.length) return { leads: [], tokenUsage: 0 }
  const user = firebaseAuth?.currentUser
  if (!user) throw new Error('Entre com uma conta Firebase para usar o enriquecimento com IA.')
  const token = await user.getIdToken()
  const response = await fetch(`${endpoint}/lead-enrichment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      leads: leads.slice(0, 3).map(({ id, externalIds, name, city, categoryName, recommendedService, address, phone, whatsapp, email, website, instagram, googleMapsUrl, airbnbUrl, bookingUrl, sourceUrls }) => ({
        id, googlePlaceId: externalIds.googlePlaces || externalIds.googleBusiness || '', name, city, categoryName, recommendedService, address, phone, whatsapp, email, website, instagram, googleMapsUrl, airbnbUrl, bookingUrl, sourceUrls,
      })),
    }),
    signal,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || (response.status === 429 ? 'Limite de enriquecimento atingido.' : 'Não foi possível enriquecer os leads.'))
  }
  return response.json() as Promise<{ leads: LeadEnrichmentResult[]; tokenUsage: number }>
}
