import type { LeadSearchProvider, LeadSearchProviderResult, LeadSearchRequest } from './providers'

type OsmElement = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const CACHE_TTL = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'flyflow:osm-leads:v2:'
const CITY_COORDINATES: Record<string, [number, number]> = {
  curitiba: [-25.4296, -49.2713], 'sao jose dos pinhais': [-25.5347, -49.2064], pinhais: [-25.4448, -49.1926], colombo: [-25.2925, -49.2262],
  'campo largo': [-25.4596, -49.5274], araucaria: [-25.5922, -49.4108], 'campo magro': [-25.3681, -49.4501], 'almirante tamandare': [-25.3247, -49.3103],
  'quatro barras': [-25.3656, -49.0763], 'campina grande do sul': [-25.3044, -49.0551], 'fazenda rio grande': [-25.6624, -49.3073], mandirituba: [-25.777, -49.3282],
  'balsa nova': [-25.5805, -49.6325], itaperucu: [-25.2193, -49.3454], 'rio branco do sul': [-25.19, -49.314], 'bocaiuva do sul': [-25.2066, -49.1141],
  'tijucas do sul': [-25.9311, -49.1802], contenda: [-25.6788, -49.535], lapa: [-25.7697, -49.7168],
}
const clean = (value = '', max = 240) => [...value].map((character) => character.charCodeAt(0) < 32 || character === '<' || character === '>' ? ' ' : character).join('').replace(/\s+/g, ' ').trim().slice(0, max)
const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const first = (tags: Record<string, string>, ...keys: string[]) => clean(keys.map((key) => tags[key]).find(Boolean) || '')

const locateCity = async (city: string, signal?: AbortSignal): Promise<[number, number]> => {
  const known = CITY_COORDINATES[normalize(city)]
  if (known) return known
  const key = `flyflow:city-coordinate:${normalize(city)}`
  const cached = localStorage.getItem(key)
  if (cached) return JSON.parse(cached) as [number, number]
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${city}, Paraná, Brasil`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal })
  if (!response.ok) throw new Error('Não foi possível localizar a cidade selecionada.')
  const result = await response.json() as Array<{ lat: string; lon: string }>
  if (!result[0]) throw new Error(`A cidade “${city}” não foi localizada. Revise o nome nas configurações.`)
  const coordinates: [number, number] = [Number(result[0].lat), Number(result[0].lon)]
  localStorage.setItem(key, JSON.stringify(coordinates))
  return coordinates
}

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
    const [latitude, longitude] = await locateCity(city, signal)
    const radiusMeters = Math.round(Math.min(Math.max(request.radiusKm, 2), 70) * 1000)
    const query = `[out:json][timeout:12];(${filters.map((filter) => `nwr${filter}(around:${radiusMeters},${latitude},${longitude});`).join('')});out center ${Math.min(Math.max(request.limit * 3, 30), 100)};`
    let lastError: unknown
    for (const endpoint of ENDPOINTS) {
      try {
        const attemptSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(14_000)]) : AbortSignal.timeout(14_000)
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}`, signal: attemptSignal })
        if (!response.ok) throw new Error(`Overpass respondeu ${response.status}`)
        const data = await response.json() as { elements?: OsmElement[] }
        const leads = (data.elements || []).map((item) => mapOsmElement(item, city, categories)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, request.limit)
        const result: LeadSearchProviderResult = { leads, sources: ['OpenStreetMap / Overpass API'], estimatedCost: 0, warnings: leads.length ? [] : ['Nenhum estabelecimento com nome foi encontrado nesta combinação. Tente outra categoria ou cidade.'] }
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), result }))
        return result
      } catch (error) { if (signal?.aborted) throw error; lastError = error }
    }
    throw new Error(`A fonte pública está temporariamente indisponível. Tente novamente em alguns minutos. ${lastError instanceof Error ? lastError.message : ''}`.trim())
  }
}
