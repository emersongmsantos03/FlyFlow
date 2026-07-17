import type { LeadHunterProspect } from '../../types'
import type { LeadAnalysisProvider, LeadAnalysisResult } from './providers'

export class OpenAILeadAnalyzer implements LeadAnalysisProvider {
  private readonly endpoint: string
  private readonly getAccessToken: () => Promise<string>
  constructor(endpoint: string, getAccessToken: () => Promise<string>) { this.endpoint = endpoint; this.getAccessToken = getAccessToken }
  async analyze(lead: LeadHunterProspect, signal?: AbortSignal): Promise<LeadAnalysisResult> {
    const token = await this.getAccessToken()
    const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/lead-analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ leadId: lead.id }), signal })
    if (!response.ok) throw new Error(response.status === 429 ? 'Limite de análises atingido.' : 'Não foi possível analisar este lead.')
    return response.json() as Promise<LeadAnalysisResult>
  }
}
