import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  AtSign,
  Bot,
  CalendarDays,
  Check,
  Clock3,
  Crosshair,
  ExternalLink,
  Filter,
  Flag,
  History,
  Import,
  Map,
  MapPinned,
  MessageCircle,
  Navigation,
  Radar,
  RotateCw,
  Search,
  Settings2,
  Target,
  Trophy,
  X,
} from "lucide-react";
import type {
  LeadHunterCategory,
  LeadHunterCity,
  LeadHunterProspect,
  LeadHunterRoute,
  LeadHunterSettings,
} from "../../types";
import { Button, Panel, StatusBadge } from "../ui";
import { leadScoreLabel } from "../../services/leadHunter/LeadScoringService";
import {
  buildInstagramUrl,
  buildGoogleBusinessUrl,
  buildLeadWhatsAppUrl,
  leadContactPriority,
  leadOpportunitySummary,
  opportunityLevel,
} from "../../services/leadHunter/LeadOpportunityService";
import { deduplicateLeadHunterProspects } from "../../services/leadHunter/LeadDeduplicationService";
import {
  buildGoogleMapsRouteUrl,
  recommendDailyMission,
} from "../../services/leadHunter/LeadRouteService";

type View = "results" | "routes" | "mission" | "history" | "settings";

const opportunityTone = (score: number) =>
  score >= 85 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
  score >= 70 ? "bg-blue-50 text-blue-700 border-blue-200" :
  score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" :
  "bg-gray-100 text-gray-600 border-gray-200";

export function LeadHunterPage({
  cities,
  categories,
  prospects,
  searches,
  routes,
  settings,
  providerReady,
  onSearch,
  onSaveSettings,
  onSaveCities,
  onSaveCategories,
  onImport,
  onReject,
  onCreateRoute,
  onToggleVisited,
}: {
  cities: LeadHunterCity[];
  categories: LeadHunterCategory[];
  prospects: LeadHunterProspect[];
  searches: Array<{
    id: string;
    createdAt: string;
    totalFound: number;
    newCount: number;
    cityIds: string[];
    categoryIds: string[];
    errorCount: number;
    tokenUsage?: number;
  }>;
  routes: LeadHunterRoute[];
  settings: LeadHunterSettings;
  providerReady: boolean;
  onSearch: (filters: {
    mode: "Manual" | "Rotação automática";
    cityIds: string[];
    categoryIds: string[];
    radiusKm: number;
    minimumScore: number;
    onlyNew: boolean;
    includeEligibleKnown: boolean;
  }) => Promise<void> | void;
  onSaveSettings: (settings: LeadHunterSettings) => void;
  onSaveCities: (cities: LeadHunterCity[]) => void;
  onSaveCategories: (categories: LeadHunterCategory[]) => void;
  onImport: (prospectIds: string[]) => void;
  onReject: (prospectId: string) => void;
  onCreateRoute: (input: {
    name: string;
    startAddress: string;
    targetCity: string;
    prospectIds: string[];
    googleMapsUrl: string;
    plannedFor?: string;
  }) => void;
  onToggleVisited: (routeId: string, prospectId: string) => void;
}) {
  const [view, setView] = useState<View>("results");
  const [mode, setMode] = useState<"Manual" | "Rotação automática">(
    "Rotação automática",
  );
  const [cityId, setCityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [radiusKm, setRadiusKm] = useState(settings.radiusKm);
  const [minimumScore, setMinimumScore] = useState(0);
  const [onlyNew, setOnlyNew] = useState(false);
  const [includeKnown, setIncludeKnown] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openedLeadId, setOpenedLeadId] = useState("");
  const [searching, setSearching] = useState(false);
  const [resultQuery, setResultQuery] = useState("");
  const [contactFilter, setContactFilter] = useState<"all" | "whatsapp" | "contactable" | "ai">("all");
  const [sortMode, setSortMode] = useState<"priority" | "score" | "newest">("priority");
  const today = new Date().toISOString().slice(0, 10);
  const todaySearches = searches.filter((search) => search.createdAt.slice(0, 10) === today);
  const aiCallsToday = todaySearches.filter((search) => (search.tokenUsage || 0) > 0).length;
  const effectiveDailyAiLimit = settings.maxDailyCalls;
  const tokensToday = todaySearches.reduce((total, search) => total + (search.tokenUsage || 0), 0);
  const latestSearchId = searches[0]?.id;
  const filtered = useMemo(
    () =>
      deduplicateLeadHunterProspects(prospects)
        .filter(
          (lead) => {
            const searchable = `${lead.name} ${lead.contactName || ""} ${lead.categoryName} ${lead.city} ${lead.neighborhood} ${lead.recommendedService || ""}`.toLocaleLowerCase("pt-BR");
            const matchesContact =
              contactFilter === "all" ||
              (contactFilter === "whatsapp" && Boolean(lead.whatsapp)) ||
              (contactFilter === "contactable" && Boolean(lead.whatsapp || lead.phone || lead.email)) ||
              (contactFilter === "ai" && lead.sources.some((source) => /openai/i.test(source)));
            return (
            !lead.discardedPermanently &&
            lead.status !== "Descartado" &&
            lead.status !== "Importado" &&
            !lead.leadId &&
            (!latestSearchId || lead.lastSearchId === latestSearchId) &&
            (!cityId || lead.cityId === cityId) &&
            (!categoryId || lead.categoryId === categoryId) &&
            lead.score >= minimumScore &&
            (!onlyNew || lead.isNew) &&
            (!resultQuery.trim() || searchable.includes(resultQuery.trim().toLocaleLowerCase("pt-BR"))) &&
            matchesContact
            );
          },
        )
        .sort((a, b) =>
          sortMode === "score" ? b.score - a.score :
          sortMode === "newest" ? b.lastDiscoveredAt.localeCompare(a.lastDiscoveredAt) :
          leadContactPriority(b) - leadContactPriority(a),
        ),
    [categoryId, cityId, contactFilter, latestSearchId, minimumScore, onlyNew, prospects, resultQuery, sortMode],
  );
  const runSearch = async () => {
    if (searching) return;
    setSearching(true);
    try {
      await onSearch({
        mode,
        cityIds: cityId ? [cityId] : [],
        categoryIds: categoryId ? [categoryId] : [],
        radiusKm,
        minimumScore,
        onlyNew,
        includeEligibleKnown: includeKnown,
      });
      // Uma busca concluída deve revelar o lote, inclusive resultados já conhecidos.
      setOnlyNew(false);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="lead-hunter-page space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7900]">
              Prospecção inteligente
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-950">
              Lead Hunter
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Encontre oportunidades sem repetir estabelecimentos, com score,
              cooldown e integração ao Comercial.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["results", "Resultados", Radar],
                ["routes", "Rotas", MapPinned],
                ["mission", "Missão do Dia", Flag],
                ["history", "Histórico", History],
                ["settings", "Configurações", Settings2],
              ] as const
            ).map(([id, label, Icon]) => (
              <Button
                key={id}
                variant={view === id ? "primary" : "secondary"}
                type="button"
                onClick={() => setView(id)}
              >
                <Icon size={16} />
                {label}
              </Button>
            ))}
          </div>
        </div>
        {providerReady ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 lg:flex-row lg:items-center">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div className="min-w-0 flex-1">
              <strong>Busca de empresas e contatos públicos ativada</strong>
              <p className="mt-0.5 text-emerald-800">
                O OpenStreetMap encontra empresas reais; com o backend
                configurado, a OpenAI tenta completar responsável, telefone,
                WhatsApp e e-mail sem inventar campos ausentes.{" "}
                <a
                  className="font-semibold underline"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  © colaboradores do OpenStreetMap
                </a>
                .
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-emerald-200 bg-white/50 px-3 py-2">
                <strong className="block text-base">{aiCallsToday}/{effectiveDailyAiLimit}</strong>
                <span className="text-[10px] uppercase tracking-wide text-emerald-700">IA hoje</span>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white/50 px-3 py-2">
                <strong className="block text-base">{tokensToday.toLocaleString("pt-BR")}</strong>
                <span className="text-[10px] uppercase tracking-wide text-emerald-700">tokens</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {view === "results" ? (
        <>
          <Panel title="Filtros da busca">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-medium text-gray-600">
                Modo
                <select
                  className="field-input mt-1"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as typeof mode)
                  }
                >
                  <option>Rotação automática</option>
                  <option>Manual</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">
                Cidade
                <select
                  className="field-input mt-1"
                  value={cityId}
                  onChange={(event) => setCityId(event.target.value)}
                  disabled={mode === "Rotação automática"}
                >
                  <option value="">Todas as cidades ativas</option>
                  {cities
                    .filter((city) => city.active)
                    .map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name} · {city.distanceFromBaseKm} km
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">
                Categoria
                <select
                  className="field-input mt-1"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Distribuição automática</option>
                  {categories
                    .filter((category) => category.active)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} · {category.priority}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">
                Raio: {radiusKm} km
                <input
                  className="mt-3 w-full accent-[#c9a227]"
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Score mínimo
                <select
                  className="field-input mt-1"
                  value={minimumScore}
                  onChange={(event) =>
                    setMinimumScore(Number(event.target.value))
                  }
                >
                  {[0, 40, 60, 75, 90].map((score) => (
                    <option key={score} value={score}>
                      {score}+
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm">
                <input
                  type="checkbox"
                  checked={onlyNew}
                  onChange={(event) => setOnlyNew(event.target.checked)}
                />{" "}
                Apenas inéditos
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm">
                <input
                  type="checkbox"
                  checked={includeKnown}
                  onChange={(event) => setIncludeKnown(event.target.checked)}
                />{" "}
                Incluir antigos elegíveis
              </label>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  type="button"
                  disabled={searching}
                  onClick={runSearch}
                >
                  {searching ? (
                    <RotateCw className="animate-spin" size={16} />
                  ) : (
                    <Search size={16} />
                  )}
                  {searching ? "Buscando dados reais..." : "Buscar leads"}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={searching}
                  onClick={() => {
                    setCityId("");
                    setCategoryId("");
                    setOnlyNew(false);
                    setIncludeKnown(false);
                    setMinimumScore(0);
                  }}
                >
                  <Filter size={16} />
                </Button>
              </div>
            </div>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Oportunidades", filtered.length, Target],
              [
                "Com WhatsApp",
                filtered.filter((item) => item.whatsapp).length,
                MessageCircle,
              ],
              [
                "Alta prioridade",
                filtered.filter((item) => item.score >= 75).length,
                Trophy,
              ],
              [
                "Enriquecidos por IA",
                filtered.filter((item) => item.sources.some((source) => /openai/i.test(source))).length,
                Bot,
              ],
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as typeof Target;
              return (
                <div
                  key={String(label)}
                  className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                >
                  <MetricIcon className="text-[#a98512]" size={18} />
                  <p className="mt-3 text-xs font-medium text-gray-500">
                    {label as string}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-950">
                    {value as number}
                  </p>
                </div>
              );
            })}
          </div>
          <Panel
            title="Pipeline de oportunidades"
            action={
              selectedIds.length ? (
                <Button type="button" onClick={() => onImport(selectedIds)}>
                  <Import size={16} />
                  Importar {selectedIds.length}
                </Button>
              ) : undefined
            }
          >
            <div className="lead-hunter-toolbar mb-4 grid gap-3 rounded-xl border p-3 lg:grid-cols-[minmax(18rem,1fr)_14rem_14rem]">
              <label className="min-w-0 text-xs font-medium text-gray-500">
                Localizar nos resultados
                <span className="relative mt-1 block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    className="field-input w-full pl-10"
                    value={resultQuery}
                    onChange={(event) => setResultQuery(event.target.value)}
                    placeholder="Empresa, cidade, categoria ou serviço"
                  />
                </span>
              </label>
              <label className="min-w-0 text-xs font-medium text-gray-500">
                Canal disponível
                <select className="field-input mt-1 w-full" value={contactFilter} onChange={(event) => setContactFilter(event.target.value as typeof contactFilter)}>
                  <option value="all">Todos os contatos</option>
                  <option value="whatsapp">Com WhatsApp</option>
                  <option value="contactable">Com algum contato</option>
                  <option value="ai">Enriquecidos por IA</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium text-gray-500">
                Ordenar por
                <span className="relative mt-1 block">
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400" size={15} />
                  <select className="field-input w-full pl-9" value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                    <option value="priority">Melhor oportunidade</option>
                    <option value="score">Maior score</option>
                    <option value="newest">Mais recente</option>
                  </select>
                </span>
              </label>
            </div>
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-gray-500">
              {[[90, "Excelente"], [75, "Boa"], [55, "Média"], [30, "Ruim"]].map(([score, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <i className={`h-2 w-2 rounded-full ${String(opportunityTone(Number(score))).split(" ")[0]}`} />
                  {label}
                </span>
              ))}
              <span className="ml-auto text-gray-400">Distância, contato, presença digital e potencial visual</span>
            </div>
            {filtered.length ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  className="text-xs font-semibold text-gray-600 hover:text-gray-950"
                  type="button"
                  onClick={() => {
                    const visibleIds = filtered.map((lead) => lead.id);
                    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
                    setSelectedIds(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleIds])]);
                  }}
                >
                  {filtered.every((lead) => selectedIds.includes(lead.id)) ? "Desmarcar visíveis" : "Selecionar visíveis"}
                </button>
                <span className="text-xs text-gray-500">{filtered.length} oportunidade(s) ordenada(s) por potencial</span>
              </div>
            ) : null}
            {filtered.length ? (
              <div className="grid gap-2 xl:grid-cols-2">
                {filtered.map((lead) => (
                  <article
                    key={lead.id}
                    className={`group rounded-xl border p-3 transition hover:border-amber-300 ${selectedIds.includes(lead.id) ? "border-amber-400 bg-amber-50/30 ring-1 ring-amber-200" : "border-gray-200 bg-white"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selectedIds.includes(lead.id) ? "border-amber-500 bg-amber-400 text-black" : "border-gray-300"}`}
                        type="button"
                        aria-label={`Selecionar ${lead.name}`}
                        onClick={() =>
                          setSelectedIds((current) =>
                            current.includes(lead.id)
                              ? current.filter((id) => id !== lead.id)
                              : [...current, lead.id],
                          )
                        }
                      >
                        {selectedIds.includes(lead.id) ? (
                          <Check size={13} />
                        ) : null}
                      </button>
                      <button
                        className="min-w-0 flex-1 text-left"
                        type="button"
                        onClick={() => setOpenedLeadId(lead.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${opportunityTone(lead.score)}`}>
                                {opportunityLevel(lead.score)}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{lead.categoryName}</span>
                            </div>
                            <h2 className="mt-1.5 font-semibold text-gray-950">
                              {lead.name}
                            </h2>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {lead.city}
                              {lead.neighborhood
                                ? ` · ${lead.neighborhood}`
                                : ""}
                              {typeof lead.distanceKm === "number" ? ` · ${lead.distanceKm} km` : ""}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">
                              {lead.address || "Endereço não informado na fonte pública"}
                            </p>
                          </div>
                          <div className="text-right">
                            <strong className="text-base text-gray-950">
                              {lead.score}
                            </strong>
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">potencial</p>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-1 text-xs text-gray-500">
                          {lead.aiSummary || leadOpportunitySummary(lead)}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8a6d08]">
                          {lead.recommendedService || "Vídeo institucional"}
                        </p>
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5 pl-7">
                      {lead.whatsapp ? (
                        <a className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" href={buildLeadWhatsAppUrl(lead)} target="_blank" rel="noreferrer" title="Abrir WhatsApp" onClick={() => { if (!lead.leadId) onImport([lead.id]); }}>
                          <MessageCircle size={15} />
                        </a>
                      ) : null}
                      {lead.instagram ? (
                        <a className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100" href={buildInstagramUrl(lead.instagram)} target="_blank" rel="noreferrer" title="Abrir Instagram">
                          <AtSign size={15} />
                        </a>
                      ) : null}
                      <a className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100" href={buildGoogleBusinessUrl(lead)} target="_blank" rel="noreferrer" title="Abrir perfil no Google">
                        <Map size={15} />
                      </a>
                      {!lead.whatsapp && !lead.instagram ? <span className="text-[11px] text-gray-400">Contato nos detalhes</span> : null}
                      <button className="ml-auto inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-[#8a6d08] hover:bg-amber-50" type="button" onClick={() => setOpenedLeadId(lead.id)}>Detalhes →</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 text-center">
                <span className="rounded-2xl bg-amber-50 p-3 text-[#a98512]">
                  <Crosshair size={30} />
                </span>
                <h3 className="mt-3 font-semibold text-gray-800">
                  {prospects.length ? `${prospects.length} lead(s) oculto(s) pelos filtros` : "Sua próxima oportunidade começa aqui"}
                </h3>
                <p className="mt-1 max-w-lg text-sm text-gray-500">
                  {prospects.length
                    ? "Os dados estão salvos. Limpe os filtros para exibir todos os resultados encontrados."
                    : "Busque empresas reais na região selecionada. Os melhores candidatos serão priorizados automaticamente."}
                </p>
                <Button
                  className="mt-4"
                  type="button"
                  disabled={searching}
                  onClick={() => {
                    if (prospects.length) {
                      setOnlyNew(false);
                      setMinimumScore(0);
                      setCityId("");
                      setCategoryId("");
                      setContactFilter("all");
                      setResultQuery("");
                      return;
                    }
                    void runSearch();
                  }}
                >
                  {searching ? <RotateCw className="animate-spin" size={16} /> : prospects.length ? <Filter size={16} /> : <Search size={16} />}
                  {searching ? "Buscando..." : prospects.length ? "Mostrar todos os leads" : "Buscar oportunidades"}
                </Button>
              </div>
            )}
          </Panel>
          {openedLeadId ? (
            <LeadDetail
              lead={prospects.find((lead) => lead.id === openedLeadId)}
              onClose={() => setOpenedLeadId("")}
              onImport={(id) => onImport([id])}
              onReject={onReject}
            />
          ) : null}
        </>
      ) : null}

      {view === "history" ? (
        <Panel title="Histórico de buscas">
          {searches.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Região</th>
                    <th>Encontrados</th>
                    <th>Inéditos</th>
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {searches.map((search) => (
                    <tr key={search.id}>
                      <td>
                        {new Date(search.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td>
                        {search.cityIds
                          .map(
                            (id) => cities.find((city) => city.id === id)?.name,
                          )
                          .filter(Boolean)
                          .join(", ") || "Rotação automática"}
                      </td>
                      <td>{search.totalFound}</td>
                      <td>{search.newCount}</td>
                      <td>{search.errorCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <Clock3 className="text-gray-300" size={32} />
              <p className="mt-2 text-sm text-gray-500">
                Nenhuma busca realizada.
              </p>
            </div>
          )}
        </Panel>
      ) : null}

      {view === "routes" ? (
        <RoutesPanel
          prospects={prospects}
          routes={routes}
          selectedIds={selectedIds}
          onCreateRoute={onCreateRoute}
          onToggleVisited={onToggleVisited}
        />
      ) : null}
      {view === "mission" ? (
        <DailyMissionPanel
          cities={cities}
          prospects={prospects}
          routes={routes}
          onCreateRoute={onCreateRoute}
        />
      ) : null}

      {view === "settings" ? (
        <LeadHunterSettingsPanel
          cities={cities}
          categories={categories}
          settings={settings}
          onSave={onSaveSettings}
          onSaveCities={onSaveCities}
          onSaveCategories={onSaveCategories}
        />
      ) : null}
    </div>
  );
}

function LeadDetail({
  lead,
  onClose,
  onImport,
  onReject,
}: {
  lead?: LeadHunterProspect;
  onClose: () => void;
  onImport: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (!lead) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/35"
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label="Fechar detalhes"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-700">
              Lead Hunter
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-950">
              {lead.name}
            </h2>
            <p className="text-sm text-gray-500">
              {lead.categoryName} · {lead.city}
            </p>
          </div>
          <button
            className="rounded-lg p-2 hover:bg-gray-100"
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Lead Score</p>
            <strong className="text-2xl">{lead.score}</strong>
            <p className="text-xs text-gray-500">
              {leadScoreLabel(lead.score)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Descoberta</p>
            <strong className="text-sm">
              {new Date(lead.firstDiscoveredAt).toLocaleDateString("pt-BR")}
            </strong>
            <p className="text-xs text-gray-500">
              Encontrado {lead.discoveryCount}x
            </p>
          </div>
        </div>
        <section className="mt-5">
          <h3 className="font-semibold">Contato e localização</h3>
          <dl className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3 text-sm">
            {[
              ["Serviço recomendado", lead.recommendedService],
              ["Telefone", lead.phone],
              ["WhatsApp", lead.whatsapp],
              ["E-mail", lead.email],
              ["Instagram", lead.instagram],
              ["Site", lead.website],
              ["Endereço", lead.address],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-gray-500">{label}</dt>
                <dd className="break-all text-right font-medium">
                  {value || "Não encontrado"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="mt-5">
          <details className="rounded-xl border border-amber-200 bg-amber-50 p-3" open={Boolean(lead.aiSummary || lead.aiApproach)}>
            <summary className="cursor-pointer font-semibold text-amber-900">
              Comentários e abordagem sugerida
            </summary>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">
              <div>
                <strong className="block text-xs uppercase tracking-wide text-amber-800">Leitura da oportunidade</strong>
                <p className="mt-1">{lead.aiSummary || leadOpportunitySummary(lead)}</p>
              </div>
              <div>
                <strong className="block text-xs uppercase tracking-wide text-amber-800">Como iniciar o contato</strong>
                <p className="mt-1">{lead.aiApproach || `Apresente ${lead.recommendedService || "um serviço visual com drone"} e cite um ponto específico do negócio para demonstrar que a abordagem foi personalizada.`}</p>
              </div>
              {lead.aiSocialInsight ? <div>
                <strong className="block text-xs uppercase tracking-wide text-amber-800">Leitura das redes</strong>
                <p className="mt-1">{lead.aiSocialInsight}</p>
              </div> : null}
              {lead.aiContactHook ? <div>
                <strong className="block text-xs uppercase tracking-wide text-amber-800">Gancho personalizado</strong>
                <p className="mt-1">{lead.aiContactHook}</p>
              </div> : null}
              {lead.aiFirstMessage ? <div className="rounded-lg border border-amber-200 bg-white p-3">
                <strong className="block text-xs uppercase tracking-wide text-amber-800">Mensagem pronta</strong>
                <p className="mt-1">{lead.aiFirstMessage}</p>
                <button className="mt-2 text-xs font-semibold text-amber-800 hover:underline" type="button" onClick={() => void navigator.clipboard.writeText(lead.aiFirstMessage || "")}>Copiar mensagem</button>
              </div> : null}
              {lead.notes ? <p className="border-t border-amber-200 pt-2 text-xs text-gray-500">{lead.notes}</p> : null}
            </div>
          </details>
        </section>
        <section className="mt-5">
          <h3 className="font-semibold">Composição do score</h3>
          <div className="mt-2 space-y-2">
            {lead.scoreReasons.length ? (
              lead.scoreReasons.map((reason) => (
                <div
                  key={reason.id}
                  className="flex justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm"
                >
                  <span>{reason.label}</span>
                  <strong
                    className={
                      reason.points >= 0 ? "text-emerald-700" : "text-red-700"
                    }
                  >
                    {reason.points > 0 ? "+" : ""}
                    {reason.points}
                  </strong>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                Análise ainda não realizada.
              </p>
            )}
          </div>
        </section>
        <section className="mt-5">
          <h3 className="font-semibold">Fontes</h3>
          <p className="mt-2 text-sm text-gray-600">
            {lead.sources.join(", ") || "Não informado"}
          </p>
        </section>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => onImport(lead.id)}>
            <Import size={16} />
            Salvar e adicionar ao Comercial
          </Button>
          {lead.whatsapp ? (
            <a
              className="app-button app-button-secondary inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold"
              href={buildLeadWhatsAppUrl(lead)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          ) : null}
          {lead.instagram ? (
            <a
              className="app-button app-button-secondary inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold"
              href={buildInstagramUrl(lead.instagram)}
              target="_blank"
              rel="noreferrer"
            >
              <AtSign size={16} />
              Instagram
            </a>
          ) : null}
          {lead.googleMapsUrl ? (
            <a
              className="app-button app-button-secondary inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold"
              href={lead.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              Mapa
            </a>
          ) : null}
          <a
            className="app-button app-button-secondary inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold"
            href={buildGoogleBusinessUrl(lead)}
            target="_blank"
            rel="noreferrer"
          >
            <Map size={16} />
            Perfil no Google
          </a>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            type="button"
            onClick={() => { if (window.confirm(`Rejeitar ${lead.name} e impedir que apareça novamente?`)) { onReject(lead.id); onClose(); } }}
          >
            <X size={16} />
            Rejeitar lead
          </button>
        </div>
      </aside>
    </div>
  );
}

function RoutesPanel({
  prospects,
  routes,
  selectedIds,
  onCreateRoute,
  onToggleVisited,
}: {
  prospects: LeadHunterProspect[];
  routes: LeadHunterRoute[];
  selectedIds: string[];
  onCreateRoute: (input: {
    name: string;
    startAddress: string;
    targetCity: string;
    prospectIds: string[];
    googleMapsUrl: string;
    plannedFor?: string;
  }) => void;
  onToggleVisited: (routeId: string, prospectId: string) => void;
}) {
  const [name, setName] = useState("");
  const [startAddress, setStartAddress] = useState("Curitiba, PR");
  const [plannedFor, setPlannedFor] = useState("");
  const selected = prospects.filter((lead) => selectedIds.includes(lead.id));
  const submit = () => {
    if (!selected.length) return;
    const targetCity = selected[0]?.city || "";
    onCreateRoute({
      name: name.trim() || `Rota ${targetCity}`,
      startAddress,
      targetCity,
      prospectIds: selected.map((lead) => lead.id),
      googleMapsUrl: buildGoogleMapsRouteUrl(startAddress, selected),
      plannedFor,
    });
    setName("");
  };
  return (
    <div className="space-y-4">
      <Panel title="Criar rota com os leads selecionados">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-gray-600">
            Nome da rota
            <input
              className="field-input mt-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Rota Itaperuçu"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Ponto de partida
            <input
              className="field-input mt-1"
              value={startAddress}
              onChange={(event) => setStartAddress(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Data planejada
            <input
              className="field-input mt-1"
              type="date"
              value={plannedFor}
              onChange={(event) => setPlannedFor(event.target.value)}
            />
          </label>
          <div className="flex items-end">
            <Button
              className="w-full"
              type="button"
              disabled={!selected.length}
              onClick={submit}
            >
              <Navigation size={16} />
              Criar rota ({selected.length})
            </Button>
          </div>
        </div>
        {!selected.length ? (
          <p className="mt-3 text-sm text-gray-500">
            Selecione leads na aba Resultados antes de criar uma rota.
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            A ordem inicial prioriza o score. Distância e tempo exatos dependem
            do Google Routes.
          </p>
        )}
      </Panel>
      <Panel title="Rotas salvas">
        {routes.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {routes.map((route) => {
              const routeLeads = route.prospectIds
                .map((id) => prospects.find((lead) => lead.id === id))
                .filter((lead): lead is LeadHunterProspect => Boolean(lead));
              return (
                <article
                  key={route.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-950">
                        {route.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {route.targetCity} · {route.visitedProspectIds.length}/
                        {route.prospectIds.length} visitados
                      </p>
                    </div>
                    <StatusBadge>{route.status}</StatusBadge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {routeLeads.map((lead, index) => (
                      <label
                        key={lead.id}
                        className="flex items-center gap-3 rounded-lg bg-gray-50 p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={route.visitedProspectIds.includes(lead.id)}
                          onChange={() => onToggleVisited(route.id, lead.id)}
                        />
                        <span className="font-medium">
                          {index + 1}. {lead.name}
                        </span>
                        <span className="ml-auto text-gray-500">
                          {lead.score}
                        </span>
                      </label>
                    ))}
                  </div>
                  {route.googleMapsUrl ? (
                    <a
                      className="app-button app-button-secondary mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold"
                      href={route.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Map size={16} />
                      Abrir no Google Maps
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-gray-500">
            Nenhuma rota salva.
          </p>
        )}
      </Panel>
    </div>
  );
}

function DailyMissionPanel({
  cities,
  prospects,
  routes,
  onCreateRoute,
}: {
  cities: LeadHunterCity[];
  prospects: LeadHunterProspect[];
  routes: LeadHunterRoute[];
  onCreateRoute: (input: {
    name: string;
    startAddress: string;
    targetCity: string;
    prospectIds: string[];
    googleMapsUrl: string;
    plannedFor?: string;
  }) => void;
}) {
  const [preferredCity, setPreferredCity] = useState("");
  const [startAddress, setStartAddress] = useState("Curitiba, PR");
  const [maxVisits, setMaxVisits] = useState(8);
  const recommendation = recommendDailyMission(
    cities,
    prospects,
    routes,
    preferredCity,
  );
  const missionLeads = recommendation?.leads.slice(0, maxVisits) || [];
  return (
    <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
      <Panel title="Planejar a missão">
        <div className="space-y-3">
          <label className="text-xs font-medium text-gray-600">
            Cidade para onde você vai
            <input
              className="field-input mt-1"
              value={preferredCity}
              onChange={(event) => setPreferredCity(event.target.value)}
              placeholder="Ex.: Itaperuçu"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Ponto inicial
            <input
              className="field-input mt-1"
              value={startAddress}
              onChange={(event) => setStartAddress(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Máximo de visitas
            <input
              className="field-input mt-1"
              type="number"
              min="1"
              max="20"
              value={maxVisits}
              onChange={(event) => setMaxVisits(Number(event.target.value))}
            />
          </label>
          <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
            A recomendação considera leads inéditos, score, distância, buscas
            anteriores e rotas recentes. Não exibe tempo ou custo sem dados
            oficiais.
          </p>
        </div>
      </Panel>
      <Panel title="Sugestão do dia">
        {recommendation ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-amber-700">
                  Cidade recomendada
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {recommendation.city.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {recommendation.city.distanceFromBaseKm} km da base · score
                  médio {recommendation.averageScore.toFixed(0)}
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge>{recommendation.newCount} inéditos</StatusBadge>
                <StatusBadge>{missionLeads.length} paradas</StatusBadge>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {missionLeads.map((lead, index) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">
                      {lead.name}
                    </strong>
                    <span className="text-xs text-gray-500">
                      {lead.categoryName} · score {lead.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="mt-4"
              type="button"
              onClick={() =>
                onCreateRoute({
                  name: `Missão ${recommendation.city.name}`,
                  startAddress,
                  targetCity: recommendation.city.name,
                  prospectIds: missionLeads.map((lead) => lead.id),
                  googleMapsUrl: buildGoogleMapsRouteUrl(
                    startAddress,
                    missionLeads,
                  ),
                  plannedFor: new Date().toISOString().slice(0, 10),
                })
              }
            >
              <CalendarDays size={16} />
              Criar rota da missão
            </Button>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center text-center">
            <Flag className="text-gray-300" size={36} />
            <h3 className="mt-3 font-semibold">
              Ainda não há leads qualificados
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              A Missão do Dia será gerada quando existirem resultados reais no
              Lead Hunter.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

function LeadHunterSettingsPanel({
  cities,
  categories,
  settings,
  onSave,
  onSaveCities,
  onSaveCategories,
}: {
  cities: LeadHunterCity[];
  categories: LeadHunterCategory[];
  settings: LeadHunterSettings;
  onSave: (settings: LeadHunterSettings) => void;
  onSaveCities: (cities: LeadHunterCity[]) => void;
  onSaveCategories: (categories: LeadHunterCategory[]) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [newCity, setNewCity] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const timestamp = () => new Date().toISOString();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Limites e cooldown">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-600">
            Resultados por busca
            <input
              className="field-input mt-1"
              type="number"
              min="1"
              max="100"
              value={draft.maxResultsPerSearch}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  maxResultsPerSearch: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Mínimo de inéditos (%)
            <input
              className="field-input mt-1"
              type="number"
              min="0"
              max="100"
              value={draft.minimumNewLeadPercentage}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  minimumNewLeadPercentage: Number(event.target.value),
                })
              }
            />
          </label>
          {Object.entries(draft.cooldownDays).map(([key, value]) => (
            <label key={key} className="text-xs font-medium text-gray-600">
              Cooldown {key}
              <input
                className="field-input mt-1"
                type="number"
                min="0"
                value={value}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    cooldownDays: {
                      ...draft.cooldownDays,
                      [key]: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
          <Button
            className="sm:col-span-2"
            type="button"
            onClick={() => onSave({ ...draft, updatedAt: timestamp() })}
          >
            <Settings2 size={16} />
            Salvar configurações
          </Button>
        </div>
      </Panel>
      <Panel title="Cidades">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newCity.trim();
            if (!name) return;
            onSaveCities([
              ...cities,
              {
                id: `lh-city-${Date.now()}`,
                name,
                state: "PR",
                distanceFromBaseKm: 0,
                active: true,
                searchCount: 0,
                discoveredCount: 0,
                newLeadCount: 0,
                createdAt: timestamp(),
                updatedAt: timestamp(),
              },
            ]);
            setNewCity("");
          }}
        >
          <input
            className="field-input"
            value={newCity}
            onChange={(event) => setNewCity(event.target.value)}
            placeholder="Adicionar cidade"
          />
          <Button type="submit">Adicionar</Button>
        </form>
        <div className="mt-3 grid grid-cols-[1fr_5rem_auto] gap-2 px-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
          <span>Cidade</span>
          <span className="text-center">Km da base</span>
          <span>Status</span>
        </div>
        <div className="mt-1 max-h-80 space-y-2 overflow-y-auto">
          {cities.map((city) => (
            <div
              key={city.id}
              className="grid grid-cols-[1fr_5rem_auto] items-center gap-2 rounded-lg border border-gray-200 p-2"
            >
              <input
                className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium focus:border-gray-300"
                value={city.name}
                onChange={(event) =>
                  onSaveCities(
                    cities.map((item) =>
                      item.id === city.id
                        ? {
                            ...item,
                            name: event.target.value,
                            updatedAt: timestamp(),
                          }
                        : item,
                    ),
                  )
                }
              />
              <input
                className="field-input min-h-8 px-2 py-1 text-sm"
                type="number"
                min="0"
                value={city.distanceFromBaseKm}
                onChange={(event) =>
                  onSaveCities(
                    cities.map((item) =>
                      item.id === city.id
                        ? {
                            ...item,
                            distanceFromBaseKm: Number(event.target.value),
                            updatedAt: timestamp(),
                          }
                        : item,
                    ),
                  )
                }
              />
              <button
                className={`rounded-full px-2 py-1 text-xs font-semibold ${city.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                type="button"
                onClick={() =>
                  onSaveCities(
                    cities.map((item) =>
                      item.id === city.id
                        ? {
                            ...item,
                            active: !item.active,
                            updatedAt: timestamp(),
                          }
                        : item,
                    ),
                  )
                }
              >
                {city.active ? "Ativa" : "Inativa"}
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Categorias">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newCategory.trim();
            if (!name) return;
            onSaveCategories([
              ...categories,
              {
                id: `lh-category-${Date.now()}`,
                name,
                group: "Outras",
                priority: "Média",
                weight: 5,
                active: true,
                searchTerms: [name],
                searchCount: 0,
                discoveredCount: 0,
                newLeadCount: 0,
                createdAt: timestamp(),
                updatedAt: timestamp(),
              },
            ]);
            setNewCategory("");
          }}
        >
          <input
            className="field-input"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Adicionar categoria"
          />
          <Button type="submit">Adicionar</Button>
        </form>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {categories.map((category) => (
            <div
              key={category.id}
              className="grid grid-cols-[1fr_7rem_auto] items-center gap-2 rounded-lg border border-gray-200 p-2"
            >
              <input
                className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium focus:border-gray-300"
                value={category.name}
                onChange={(event) =>
                  onSaveCategories(
                    categories.map((item) =>
                      item.id === category.id
                        ? {
                            ...item,
                            name: event.target.value,
                            searchTerms: [event.target.value],
                            updatedAt: timestamp(),
                          }
                        : item,
                    ),
                  )
                }
              />
              <select
                className="field-input min-h-8 px-2 py-1 text-xs"
                value={category.priority}
                onChange={(event) =>
                  onSaveCategories(
                    categories.map((item) =>
                      item.id === category.id
                        ? {
                            ...item,
                            priority: event.target
                              .value as LeadHunterCategory["priority"],
                            updatedAt: timestamp(),
                          }
                        : item,
                    ),
                  )
                }
              >
                <option>Máxima</option>
                <option>Alta</option>
                <option>Média</option>
                <option>Baixa</option>
              </select>
              <button
                className={`rounded-full px-2 py-1 text-xs font-semibold ${category.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                type="button"
                onClick={() =>
                  onSaveCategories(
                    categories.map((item) =>
                      item.id === category.id
                        ? {
                            ...item,
                            active: !item.active,
                            updatedAt: timestamp(),
                          }
                        : item,
                    ),
                  )
                }
              >
                {category.active ? "Ativa" : "Inativa"}
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
