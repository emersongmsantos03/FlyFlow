import { useMemo, useState } from 'react'
import { AlertCircle, Building2, Clock3, Crosshair, Filter, History, Map, Radar, RotateCw, Search, Settings2, Sparkles, Target } from 'lucide-react'
import type { LeadHunterCategory, LeadHunterCity, LeadHunterProspect, LeadHunterSettings } from '../../types'
import { Button, Panel, StatusBadge } from '../ui'
import { leadScoreLabel } from '../../services/leadHunter/LeadScoringService'

type View = 'results' | 'history' | 'settings'

export function LeadHunterPage({ cities, categories, prospects, searches, settings, providerReady, onSearch, onSaveSettings }: {
  cities: LeadHunterCity[]
  categories: LeadHunterCategory[]
  prospects: LeadHunterProspect[]
  searches: Array<{ id: string; createdAt: string; totalFound: number; newCount: number; cityIds: string[]; categoryIds: string[]; errorCount: number }>
  settings: LeadHunterSettings
  providerReady: boolean
  onSearch: (filters: { mode: 'Manual' | 'Rotação automática'; cityIds: string[]; categoryIds: string[]; radiusKm: number; minimumScore: number; onlyNew: boolean; includeEligibleKnown: boolean }) => void
  onSaveSettings: (settings: LeadHunterSettings) => void
}) {
  const [view, setView] = useState<View>('results')
  const [mode, setMode] = useState<'Manual' | 'Rotação automática'>('Rotação automática')
  const [cityId, setCityId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [radiusKm, setRadiusKm] = useState(settings.radiusKm)
  const [minimumScore, setMinimumScore] = useState(60)
  const [onlyNew, setOnlyNew] = useState(true)
  const [includeKnown, setIncludeKnown] = useState(false)
  const filtered = useMemo(() => prospects.filter((lead) => (!cityId || lead.cityId === cityId) && (!categoryId || lead.categoryId === categoryId) && lead.score >= minimumScore && (!onlyNew || lead.isNew)), [categoryId, cityId, minimumScore, onlyNew, prospects])
  const runSearch = () => onSearch({ mode, cityIds: cityId ? [cityId] : [], categoryIds: categoryId ? [categoryId] : [], radiusKm, minimumScore, onlyNew, includeEligibleKnown: includeKnown })

  return <div className="lead-hunter-page space-y-4">
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7900]">Prospecção inteligente</p><h1 className="mt-1 text-2xl font-semibold text-gray-950">Lead Hunter</h1><p className="mt-1 max-w-2xl text-sm text-gray-500">Encontre oportunidades sem repetir estabelecimentos, com score, cooldown e integração ao Comercial.</p></div>
        <div className="flex flex-wrap gap-2">{([['results', 'Resultados', Radar], ['history', 'Histórico', History], ['settings', 'Configurações', Settings2]] as const).map(([id, label, Icon]) => <Button key={id} variant={view === id ? 'primary' : 'secondary'} type="button" onClick={() => setView(id)}><Icon size={16} />{label}</Button>)}</div>
      </div>
      {!providerReady ? <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 shrink-0" size={18} /><div><strong>Provedor de busca ainda não configurado</strong><p className="mt-0.5 text-amber-800">Nenhum dado será inventado. Configure Google Places no backend para realizar buscas reais.</p></div></div> : null}
    </section>

    {view === 'results' ? <>
      <Panel title="Filtros da busca">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-gray-600">Modo<select className="field-input mt-1" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option>Rotação automática</option><option>Manual</option></select></label>
          <label className="text-xs font-medium text-gray-600">Cidade<select className="field-input mt-1" value={cityId} onChange={(event) => setCityId(event.target.value)} disabled={mode === 'Rotação automática'}><option value="">Todas as cidades ativas</option>{cities.filter((city) => city.active).map((city) => <option key={city.id} value={city.id}>{city.name} · {city.distanceFromBaseKm} km</option>)}</select></label>
          <label className="text-xs font-medium text-gray-600">Categoria<select className="field-input mt-1" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Distribuição automática</option>{categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name} · {category.priority}</option>)}</select></label>
          <label className="text-xs font-medium text-gray-600">Raio: {radiusKm} km<input className="mt-3 w-full accent-[#c9a227]" type="range" min="20" max="100" step="5" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} /></label>
          <label className="text-xs font-medium text-gray-600">Score mínimo<select className="field-input mt-1" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))}>{[0, 40, 60, 75, 90].map((score) => <option key={score} value={score}>{score}+</option>)}</select></label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm"><input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} /> Apenas inéditos</label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm"><input type="checkbox" checked={includeKnown} onChange={(event) => setIncludeKnown(event.target.checked)} /> Incluir antigos elegíveis</label>
          <div className="flex gap-2"><Button className="flex-1" type="button" onClick={runSearch}><Search size={16} />Buscar leads</Button><Button variant="secondary" type="button" onClick={() => { setCityId(''); setCategoryId(''); setOnlyNew(true); setIncludeKnown(false); setMinimumScore(60) }}><Filter size={16} /></Button></div>
        </div>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Encontrados', filtered.length, Target], ['Inéditos', filtered.filter((item) => item.isNew).length, Sparkles], ['Reapresentados', filtered.filter((item) => !item.isNew).length, RotateCw], ['Cidades ativas', cities.filter((item) => item.active).length, Map],
      ].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof Target; return <div key={String(label)} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><MetricIcon className="text-[#a98512]" size={18} /><p className="mt-3 text-xs font-medium text-gray-500">{label as string}</p><p className="mt-1 text-2xl font-semibold text-gray-950">{value as number}</p></div> })}</div>
      <Panel title="Resultados qualificados">
        {filtered.length ? <div className="grid gap-3 xl:grid-cols-2">{filtered.map((lead) => <article key={lead.id} className="rounded-xl border border-gray-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><StatusBadge>{lead.isNew ? 'Novo' : 'Já encontrado'}</StatusBadge><StatusBadge>{lead.categoryName}</StatusBadge></div><h2 className="mt-2 font-semibold text-gray-950">{lead.name}</h2><p className="text-sm text-gray-500">{lead.city}{lead.neighborhood ? ` · ${lead.neighborhood}` : ''}</p></div><div className="text-right"><strong className="text-xl text-gray-950">{lead.score}</strong><p className="text-xs text-gray-500">{leadScoreLabel(lead.score)}</p></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500"><span>{lead.sources.join(', ')}</span><span>·</span><span>Exibido {lead.displayCount}x</span></div></article>)}</div> : <div className="flex min-h-48 flex-col items-center justify-center text-center"><Crosshair className="text-gray-300" size={36} /><h3 className="mt-3 font-semibold text-gray-800">Nenhum resultado disponível</h3><p className="mt-1 max-w-lg text-sm text-gray-500">Execute uma busca com um provedor oficial configurado. O Lead Hunter não gera estabelecimentos fictícios.</p></div>}
      </Panel>
    </> : null}

    {view === 'history' ? <Panel title="Histórico de buscas">{searches.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Data</th><th>Região</th><th>Encontrados</th><th>Inéditos</th><th>Erros</th></tr></thead><tbody>{searches.map((search) => <tr key={search.id}><td>{new Date(search.createdAt).toLocaleString('pt-BR')}</td><td>{search.cityIds.map((id) => cities.find((city) => city.id === id)?.name).filter(Boolean).join(', ') || 'Rotação automática'}</td><td>{search.totalFound}</td><td>{search.newCount}</td><td>{search.errorCount}</td></tr>)}</tbody></table></div> : <div className="flex min-h-40 flex-col items-center justify-center text-center"><Clock3 className="text-gray-300" size={32} /><p className="mt-2 text-sm text-gray-500">Nenhuma busca realizada.</p></div>}</Panel> : null}

    {view === 'settings' ? <LeadHunterSettingsPanel cities={cities} categories={categories} settings={settings} onSave={onSaveSettings} /> : null}
  </div>
}

function LeadHunterSettingsPanel({ cities, categories, settings, onSave }: { cities: LeadHunterCity[]; categories: LeadHunterCategory[]; settings: LeadHunterSettings; onSave: (settings: LeadHunterSettings) => void }) {
  const [draft, setDraft] = useState(settings)
  return <div className="grid gap-4 xl:grid-cols-2"><Panel title="Limites e cooldown"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-gray-600">Resultados por busca<input className="field-input mt-1" type="number" min="1" max="100" value={draft.maxResultsPerSearch} onChange={(event) => setDraft({ ...draft, maxResultsPerSearch: Number(event.target.value) })} /></label><label className="text-xs font-medium text-gray-600">Mínimo de inéditos (%)<input className="field-input mt-1" type="number" min="0" max="100" value={draft.minimumNewLeadPercentage} onChange={(event) => setDraft({ ...draft, minimumNewLeadPercentage: Number(event.target.value) })} /></label>{Object.entries(draft.cooldownDays).map(([key, value]) => <label key={key} className="text-xs font-medium text-gray-600">Cooldown {key}<input className="field-input mt-1" type="number" min="0" value={value} onChange={(event) => setDraft({ ...draft, cooldownDays: { ...draft.cooldownDays, [key]: Number(event.target.value) } })} /></label>)}<Button className="sm:col-span-2" type="button" onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}><Settings2 size={16} />Salvar configurações</Button></div></Panel><Panel title="Cobertura configurada"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-gray-50 p-4"><Map size={18} /><p className="mt-2 text-2xl font-semibold">{cities.filter((city) => city.active).length}</p><p className="text-xs text-gray-500">cidades ativas</p></div><div className="rounded-xl bg-gray-50 p-4"><Building2 size={18} /><p className="mt-2 text-2xl font-semibold">{categories.filter((category) => category.active).length}</p><p className="text-xs text-gray-500">categorias ativas</p></div></div><p className="mt-4 text-sm text-gray-500">A edição individual de cidades e categorias será liberada na próxima etapa. A estrutura já está persistida e não depende do código principal.</p></Panel></div>
}
