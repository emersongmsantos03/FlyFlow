import type { LeadSearchProvider, LeadSearchProviderResult, LeadSearchRequest } from './providers'

type OsmElement = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const CACHE_TTL = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'flyflow:osm-leads:'
const clean = (value = '', max = 240) => [...value].map((character) => character.charCodeAt(0) < 32 || character === '<' || character === '>' ? ' ' : character).join('').replace(/\s+/g, ' ').trim().slice(0, max)
const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const first = (tags: Record<string, string>, ...keys: string[]) => clean(keys.map((key) => tags[key]).find(Boolean) || '')

const filtersFor = (categories: string[]) => {
  const names = categories.map(normalize).join(' ')
  const filters: string[] = []
  if (/hotel|pousada|resort|hosped|airbnb|temporada|chale|cabana|refugio|glamping/.test(names)) filters.push('["tourism"~"hotel|guest_house|hostel|motel|chalet|camp_site|resort|apartment"]')
  if (/evento|clube/.test(names)) filters.push('["amenity"~"events_venue|community_centre"]', '["leisure"~"sports_centre|resort"]')
  if (/vinicola/.test(names)) filters.push('["craft"="winery"]', '["shop"="wine"]')
  if (/restaurante/.test(names)) filters.push('["amenity"="restaurant"]')
  if (/haras/.test(names)) filters.push('["leisure"="horse_riding"]', '["sport"="equestrian"]')
  if (/pesqueiro/.test(names)) filters.push('["leisure"="fishing"]')
  if (/imobili|corretor|construtora|incorporadora|loteamento|condominio/.test(names)) filters.push('["office"~"estate_agent|property_management|construction_company"]', '["craft"="builder"]')
  return [...new Set(filters.length ? filters : ['["tourism"~"hotel|guest_house|chalet|camp_site|resort|apartment"]', '["amenity"="events_venue"]'])]
}

const categoryFor = (tags: Record<string, string>, requested: string[]) => {
  const tourism = tags.tourism
  if (tourism === 'hotel') return requested.find((item) => normalize(item).includes('hotel')) || 'Hotel'
  if (['guest_house', 'hostel'].includes(tourism)) return requested.find((item) => /pousada|hosped/i.test(item)) || 'Pousada'
  if (['chalet', 'camp_site'].includes(tourism)) return requested.find((item) => /chale|cabana|glamping/i.test(normalize(item))) || 'Cabana'
  if (tags.amenity === 'restaurant') return 'Restaurante com área externa'
  if (tags.amenity === 'events_venue' || tags.leisure === 'sports_centre') return 'Espaço para eventos'
  if (tags.craft === 'winery' || tags.shop === 'wine') return 'Vinícola'
  if (tags.leisure === 'horse_riding' || tags.sport === 'equestrian') return 'Haras'
  if (tags.leisure === 'fishing') return 'Pesqueiro'
  if (tags.office === 'estate_agent') return 'Imobiliária'
  return requested[0] || 'Hospedagem'
}

export const mapOsmElement = (element: OsmElement, city: string, requestedCategories: string[]): LeadSearchProviderResult['leads'][number] | null => {
  const tags = element.tags || {}
  const name = clean(tags.name || tags.brand || tags.operator || '')
  if (!name) return null
  const latitude = element.lat ?? element.center?.lat
  const longitude = element.lon ?? element.center?.lon
  const phone = first(tags, 'contact:phone', 'phone', 'contact:mobile', 'mobile')
  const whatsapp = first(tags, 'contact:whatsapp', 'whatsapp')
  const website = first(tags, 'contact:website', 'website', 'url')
  const instagram = first(tags, 'contact:instagram', 'instagram')
  const address = clean([tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb']].filter(Boolean).join(', '))
  const osmId = `${element.type}/${element.id}`
  const scoreReasons = [
    { id: 'public-source', label: 'Estabelecimento confirmado em fonte pública', points: 35, evidence: `OpenStreetMap ${osmId}` },
    ...(phone || whatsapp ? [{ id: 'direct-contact', label: 'Contato direto disponível', points: 15 }] : []),
    ...(website || instagram ? [{ id: 'digital-presence', label: 'Presença digital disponível para qualificação', points: 10 }] : []),
    ...(!phone && !whatsapp && !website && !instagram ? [{ id: 'incomplete-data', label: 'Dados de contato incompletos', points: -10 }] : []),
  ]
  const score = Math.max(0, Math.min(100, 35 + scoreReasons.reduce((total, reason) => total + reason.points, 0)))
  return {
    id: `osm-${element.type}-${element.id}`, externalIds: { openstreetmap: osmId }, name, normalizedName: normalize(name),
    categoryName: categoryFor(tags, requestedCategories), city, neighborhood: clean(tags['addr:suburb'] || tags['addr:neighbourhood'] || ''), address,
    latitude, longitude, phone, whatsapp, email: first(tags, 'contact:email', 'email'), instagram, website,
    googleMapsUrl: latitude != null && longitude != null ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : '',
    sources: ['OpenStreetMap'], sourceUrls: [`https://www.openstreetmap.org/${osmId}`], score, scoreReasons,
  }
}

export class OpenStreetMapLeadProvider implements LeadSearchProvider {
  readonly id = 'openstreetmap'
  readonly name = 'OpenStreetMap'
  async search(request: LeadSearchRequest, signal?: AbortSignal): Promise<LeadSearchProviderResult> {
    const city = clean(request.cityNames[0] || '', 80)
    if (!city) throw new Error('Selecione uma cidade para realizar a busca.')
    const categories = request.categoryNames.length ? request.categoryNames : ['Hospedagem', 'Espaço para eventos']
    const key = CACHE_PREFIX + normalize(`${city}|${categories.sort().join('|')}|${request.limit}`)
    const cached = localStorage.getItem(key)
    if (cached) {
      const parsed = JSON.parse(cached) as { at: number; result: LeadSearchProviderResult }
      if (Date.now() - parsed.at < CACHE_TTL) return { ...parsed.result, warnings: [...parsed.result.warnings, 'Resultado reutilizado do cache de 24 horas.'] }
    }
    const filters = filtersFor(categories)
    const query = `[out:json][timeout:25];area["boundary"="administrative"]["name"="${city.replace(/["\\]/g, '')}"]->.a;(${filters.map((filter) => `nwr${filter}(area.a);`).join('')});out center ${Math.min(Math.max(request.limit * 3, 30), 150)};`
    let lastError: unknown
    for (const endpoint of ENDPOINTS) {
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}`, signal })
        if (!response.ok) throw new Error(`Overpass respondeu ${response.status}`)
        const data = await response.json() as { elements?: OsmElement[] }
        const leads = (data.elements || []).map((item) => mapOsmElement(item, city, categories)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, request.limit)
        const result: LeadSearchProviderResult = { leads, sources: ['OpenStreetMap / Overpass API'], estimatedCost: 0, warnings: leads.length ? [] : ['Nenhum estabelecimento com nome foi encontrado nesta combinação. Tente outra categoria ou cidade.'] }
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), result }))
        return result
      } catch (error) { if ((error as Error).name === 'AbortError') throw error; lastError = error }
    }
    throw new Error(`A fonte pública está temporariamente indisponível. Tente novamente em alguns minutos. ${lastError instanceof Error ? lastError.message : ''}`.trim())
  }
}
