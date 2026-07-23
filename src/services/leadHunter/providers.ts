import type { LeadHunterProspect } from '../../types'

export interface LeadSearchRequest {
  cityNames: string[]
  categoryNames: string[]
  neighborhood?: string
  radiusKm: number
  limit: number
  cursor?: string
}

export interface LeadSearchProviderResult {
  leads: Array<Partial<LeadHunterProspect> & Pick<LeadHunterProspect, 'name' | 'city' | 'categoryName'>>
  sources: string[]
  nextCursor?: string
  estimatedCost?: number
  warnings: string[]
}

export interface LeadSearchProvider {
  readonly id: string
  readonly name: string
  search(request: LeadSearchRequest, signal?: AbortSignal): Promise<LeadSearchProviderResult>
}

export interface LeadEnrichmentResult {
  id: string
  contactName?: string
  address?: string
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  instagram?: string
  aiSummary?: string
  aiApproach?: string
  aiOpportunityLevel?: 'Excelente' | 'Boa' | 'Média' | 'Ruim'
  aiSocialInsight?: string
  aiContactHook?: string
  aiFirstMessage?: string
  sourceUrls: string[]
}

export interface LeadRouteProvider {
  calculate(input: { origin: string; stops: Array<{ id: string; address: string; latitude?: number; longitude?: number }> }, signal?: AbortSignal): Promise<{ orderedIds: string[]; distanceKm: number; durationMinutes: number; mapsUrl: string }>
}

export interface LeadAnalysisResult {
  summary: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  recommendedServices: string[]
  approach: string
  whatsappMessage: string
  instagramMessage: string
  emailMessage: string
  uncertainFields: string[]
  tokenUsage: number
  estimatedCost: number
}

export interface LeadAnalysisProvider {
  analyze(lead: LeadHunterProspect, signal?: AbortSignal): Promise<LeadAnalysisResult>
}

export class BackendLeadSearchProvider implements LeadSearchProvider {
  readonly id = 'secure-backend'
  readonly name = 'Backend seguro'
  private readonly endpoint: string
  private readonly getAccessToken: () => Promise<string>
  constructor(endpoint: string, getAccessToken: () => Promise<string>) { this.endpoint = endpoint; this.getAccessToken = getAccessToken }
  async search(request: LeadSearchRequest, signal?: AbortSignal): Promise<LeadSearchProviderResult> {
    const token = await this.getAccessToken()
    const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/lead-search`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(request), signal })
    if (!response.ok) throw new Error(response.status === 429 ? 'Limite diário de buscas atingido.' : 'Não foi possível consultar o provedor de leads.')
    return response.json() as Promise<LeadSearchProviderResult>
  }
}
