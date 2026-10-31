import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, EmptyState, InputField, Modal, PageToolbar, Panel, StatusBadge } from '../ui'
import { formatDateTime } from '../../lib/format'
import { channelById, connectionHealth, emptyMetricsSnapshot, metricChannels, type MetricsSnapshot } from '../../lib/marketing'
import { createIntegrationToken, integrationIngestUrl, listIntegrationTokens, loadMetrics, metricsBackendAvailable, revokeIntegrationToken, type IntegrationToken } from '../../services/marketingMetrics'

const scopeOptions: Array<[string, string, string]> = [
  ['metrics', 'Métricas', 'Enviar números dos canais e consultar a última coleta.'],
  ['links', 'Links', 'Gerar links curtos dos e-mails e consultar descadastros.'],
  ['events', 'Eventos', 'Registrar envios, respostas, bounces e descadastros.'],
]

export function IntegrationsPage({ onConfirmRevoke }: { onConfirmRevoke: (label: string, action: () => void) => void }) {
  const backend = metricsBackendAvailable()
  const [snapshot, setSnapshot] = useState<MetricsSnapshot>(emptyMetricsSnapshot)
  const [tokens, setTokens] = useState<IntegrationToken[]>([])
  const [error, setError] = useState('')
  const [label, setLabel] = useState('Rotina Claude')
  const [scopes, setScopes] = useState<string[]>(['metrics'])
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    void loadMetrics().then(setSnapshot).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as integrações.'))
    if (backend) void listIntegrationTokens().then(setTokens).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os tokens.'))
  }, [backend])

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(''), 1800)
  }

  const createToken = async () => {
    setCreating(true)
    setError('')
    try {
      const token = await createIntegrationToken(label.trim() || 'Rotina Claude', scopes)
      setCreated(token.token)
      setTokens((current) => [token, ...current])
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Não foi possível gerar o token.')
    } finally {
      setCreating(false)
    }
  }

  const ingestUrl = integrationIngestUrl()
  const extraSources = [...new Set(snapshot.connections.map((item) => item.source))].filter((id) => !metricChannels.some((channel) => channel.id === id))

  return (
    <div className="integrations-page module-page">
      <PageToolbar title="Integrações" description="Conecte canais e rotinas que alimentam as métricas do FlyFlow." />
      {error ? <p className="form-alert">{error}</p> : null}

      <section className="integration-grid">
        {[...metricChannels, ...extraSources.map(channelById)].map((channel) => {
          const connections = snapshot.connections.filter((item) => item.source === channel.id)
          const health = connectionHealth(connections.find((item) => item.status === 'error') ?? connections[0])
          const lastSync = connections.map((item) => item.lastSyncAt).filter(Boolean).sort().at(-1)
          return (
            <article key={channel.id} className="integration-card">
              <header><strong>{channel.label}</strong><span className={`health-pill is-${health.tone}`}>{health.label}</span></header>
              <p>{channel.description}</p>
              <small>{lastSync ? `Última coleta: ${formatDateTime(lastSync as string)}` : 'Nenhum dado recebido'}{connections.length > 1 ? ` · ${connections.length} contas` : ''}</small>
              {connections.find((item) => item.lastError)?.lastError ? <small className="text-danger">{connections.find((item) => item.lastError)?.lastError}</small> : null}
            </article>
          )
        })}
      </section>

      <div className="integrations-columns">
        <Panel title="Tokens de acesso" action={<KeyRound size={16} className="text-gray-400" />}>
          {backend ? <div className="stack">
            <p className="muted-note">Cada rotina usa um token com o mínimo necessário. Nenhuma permissão dá acesso a clientes, ao financeiro ou às senhas das redes.</p>
            <div className="token-create">
              <InputField label="Nome"><input className="field-input" value={label} onChange={(event) => setLabel(event.target.value)} /></InputField>
              <Button disabled={creating || !scopes.length} type="button" onClick={() => void createToken()}><Plus size={15} /> {creating ? 'Gerando…' : 'Gerar token'}</Button>
            </div>
            <fieldset className="scope-picker">
              <legend>Permissões</legend>
              {scopeOptions.map(([value, name, description]) => (
                <label key={value}><input type="checkbox" checked={scopes.includes(value)} onChange={(event) => setScopes((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} /><span><strong>{name}</strong><small>{description}</small></span></label>
              ))}
            </fieldset>
            {tokens.length ? <ul className="token-list">{tokens.map((token) => (
              <li key={token.id}>
                <span><strong>{token.label}</strong><small>{token.prefix}… · {(token.scopes || 'metrics').split(',').map((scope) => scopeOptions.find(([value]) => value === scope)?.[1] ?? scope).join(', ')} · {token.lastUsedAt ? `usado em ${formatDateTime(token.lastUsedAt)}` : 'nunca usado'}</small></span>
                <button aria-label={`Revogar ${token.label}`} className="icon-button" type="button" onClick={() => onConfirmRevoke(token.label, () => {
                  void revokeIntegrationToken(token.id)
                    .then(() => setTokens((current) => current.filter((item) => item.id !== token.id)))
                    .catch((revokeError) => setError(revokeError instanceof Error ? revokeError.message : 'Não foi possível revogar o token.'))
                })}><Trash2 size={15} /></button>
              </li>
            ))}</ul> : <p className="muted-note">Nenhum token ativo.</p>}
          </div> : <EmptyState title="Disponível com o backend conectado" description="No modo local não há servidor para receber dados externos. Use o lançamento manual em Métricas." />}
        </Panel>

        <Panel title="Como a rotina envia os dados">
          <div className="stack">
            <p className="muted-note">Uma requisição por canal. Reenviar o mesmo dia substitui o valor, então a rotina pode rodar de novo sem duplicar nada.</p>
            <div className="code-block">
              <button aria-label="Copiar exemplo" type="button" onClick={() => void copy(sampleRequest(ingestUrl), 'sample')}>{copied === 'sample' ? <Check size={14} /> : <Copy size={14} />}</button>
              <pre>{sampleRequest(ingestUrl)}</pre>
            </div>
            <p className="muted-note">O guia completo, com a instrução pronta para a rotina, está em <code>docs/ROTINA_METRICAS.md</code>.</p>
          </div>
        </Panel>
      </div>

      <Panel title="Últimas coletas">
        {snapshot.runs.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Quando</th><th>Canal</th><th>Conta</th><th>Situação</th><th>Recebido</th><th>Mensagem</th></tr></thead>
              <tbody>{snapshot.runs.map((run) => (
                <tr key={run.id}>
                  <td data-label="Quando">{formatDateTime(run.createdAt)}</td>
                  <td data-label="Canal">{channelById(run.source).label}</td>
                  <td data-label="Conta">{run.account || '-'}</td>
                  <td data-label="Situação"><StatusBadge>{run.status === 'ok' ? 'Concluído' : 'Falhou'}</StatusBadge></td>
                  <td data-label="Recebido">{run.pointsCount} métricas · {run.postsCount} posts</td>
                  <td data-label="Mensagem">{run.message || '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="muted-note">Nenhuma coleta registrada.</p>}
      </Panel>

      {created ? (
        <Modal title="Copie o token agora" size="sm" onClose={() => setCreated('')}>
          <div className="stack">
            <p className="muted-note">Por segurança ele não será mostrado de novo. Guarde na configuração da rotina.</p>
            <div className="code-block"><button aria-label="Copiar token" type="button" onClick={() => void copy(created, 'token')}>{copied === 'token' ? <Check size={14} /> : <Copy size={14} />}</button><pre>{created}</pre></div>
            <div className="form-actions"><Button type="button" onClick={() => setCreated('')}>Já guardei</Button></div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

const sampleRequest = (url: string) => `curl -X POST ${url || 'https://SEU-WORKER/integrations/ingest'} \\
  -H "Authorization: Bearer $FLYFLOW_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "instagram",
    "account": "@suaconta",
    "metrics": [
      { "metric": "followers", "date": "2026-10-30", "value": 1240 },
      { "metric": "reach", "date": "2026-10-30", "value": 3820 }
    ],
    "posts": [{
      "externalId": "1789",
      "title": "Bastidores da gravação",
      "url": "https://instagram.com/p/abc",
      "publishedAt": "2026-10-28T13:00:00Z",
      "format": "Reels",
      "metrics": { "reach": 2100, "likes": 180 }
    }],
    "run": { "agent": "rotina-claude" }
  }'`
