import { cloudflareAuthorization, cloudflareWorkerBaseUrl, isFirebaseConfigured } from './firebase'
import { emptyMetricsSnapshot, type EmailReport, type MetricsSnapshot } from '../lib/marketing'
import type { TrackingEvent } from '../lib/trackingEvents'

export interface IntegrationToken {
  id: string
  label: string
  prefix: string
  scopes: string
  createdAt: string
  lastUsedAt?: string | null
}

export interface ManualMetricsInput {
  source: string
  account: string
  metrics: Array<{ metric: string; date: string; value: number }>
}

const LOCAL_KEY = 'flyflow:metrics:local:v1'

const hasBackend = () => isFirebaseConfigured && Boolean(import.meta.env.VITE_API_URL || import.meta.env.VITE_LEAD_HUNTER_API_URL)

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${cloudflareWorkerBaseUrl()}${path}`, {
    ...init,
    headers: { Authorization: await cloudflareAuthorization(), 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'Não foi possível acessar as métricas.')
  return body
}

const readLocal = (): MetricsSnapshot => {
  try {
    return { ...emptyMetricsSnapshot, ...JSON.parse(window.localStorage.getItem(LOCAL_KEY) || '{}') }
  } catch {
    return emptyMetricsSnapshot
  }
}

export const metricsBackendAvailable = hasBackend

export const loadMetrics = async (from?: string, to?: string): Promise<MetricsSnapshot> => {
  if (!hasBackend()) return readLocal()
  return request<MetricsSnapshot>(`/metrics${from && to ? `?from=${from}&to=${to}` : ''}`)
}

export const loadEmailReport = async (from: string, to: string): Promise<EmailReport> => {
  if (!hasBackend()) return { rows: [], people: [] }
  return request<EmailReport>(`/metrics/email?from=${from}&to=${to}`)
}

export const loadPendingTrackingEvents = async () => {
  if (!hasBackend()) return []
  return (await request<{ events: TrackingEvent[] }>('/crm/events/pending')).events
}

export const ackTrackingEvents = (ids: string[]) => request('/crm/events/ack', { method: 'POST', body: JSON.stringify({ ids }) })

export const saveManualMetrics = async (input: ManualMetricsInput) => {
  if (hasBackend()) {
    await request('/metrics/manual', { method: 'POST', body: JSON.stringify(input) })
    return
  }
  // Sem backend (modo local) os lançamentos manuais ficam neste navegador.
  const current = readLocal()
  const key = (item: { source: string; account: string; metric: string; date: string }) => [item.source, item.account, item.metric, item.date].join('|')
  const incoming = input.metrics.map((item) => ({ ...item, source: input.source, account: input.account }))
  const incomingKeys = new Set(incoming.map(key))
  const now = new Date().toISOString()
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify({
    ...current,
    points: [...current.points.filter((item) => !incomingKeys.has(key(item))), ...incoming],
    connections: [
      ...current.connections.filter((item) => item.source !== input.source || item.account !== input.account),
      { source: input.source, account: input.account, status: 'ok', lastSyncAt: now },
    ],
  }))
}

export const listIntegrationTokens = async () => (await request<{ tokens: IntegrationToken[] }>('/integrations/tokens')).tokens

export const createIntegrationToken = (label: string, scopes: string[]) =>
  request<IntegrationToken & { token: string }>('/integrations/tokens', { method: 'POST', body: JSON.stringify({ label, scopes }) })

export const revokeIntegrationToken = (id: string) => request(`/integrations/tokens/${id}`, { method: 'DELETE' })

export const integrationIngestUrl = () => (hasBackend() ? `${cloudflareWorkerBaseUrl()}/integrations/ingest` : '')
