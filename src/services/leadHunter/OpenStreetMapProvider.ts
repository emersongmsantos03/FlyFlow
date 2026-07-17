import type { LeadSearchProvider, LeadSearchProviderResult, LeadSearchRequest } from './providers'
import { leadContactPriority, recommendLeadService } from './LeadOpportunityService'
import { normalizeLeadText } from './LeadDeduplicationService'

type OsmElement = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
type NominatimResult = {
  osm_type: 'node' | 'way' | 'relation'
  osm_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  category?: string
  type?: string
  address?: Record<string, string>
  extratags?: Record<string, string>
  namedetails?: Record<string, string>
}

const ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const CACHE_TTL = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'flyflow:osm-leads:v9:'
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

const lowFitName = (name: string) =>
  /refinaria|usina|termel[eé]trica|hidrel[eé]trica|f[aá]brica|ind[uú]stria|campus|sistema fiep|terminal|subesta[cç][aã]o|esta[cç][aã]o de tratamento|aterro|pedreira|mineradora/i.test(normalize(name))

const categoryFamily = (value: string) => {
  const normalized = normalize(value)
  if (/hotel|pousada|hosped|guest.house|hostel|apartament|airbnb|temporada|chale|cabana|refugio|glamping|camp.site|resort/.test(normalized)) return 'lodging'
  if (/evento|events.venue|centro de convencoes|salao de festas|clube/.test(normalized)) return 'venue'
  if (/vinicola|winery|wine/.test(normalized)) return 'winery'
  if (/restaurante|restaurant/.test(normalized)) return 'restaurant'
  if (/haras|equestrian|horse.riding/.test(normalized)) return 'equestrian'
  if (/pesqueiro|fishing/.test(normalized)) return 'fishing'
  if (/imobili|estate.agent|corretor/.test(normalized)) return 'real-estate'
  if (/construtora|incorporadora|construction.company|builder/.test(normalized)) return 'construction'
  if (/concessionaria|car.dealer|shop.car/.test(normalized)) return 'car-dealer'
  if (/shopping|mall/.test(normalized)) return 'mall'
  if (/academia|fitness/.test(normalized)) return 'fitness'
  if (/clinica|clinic/.test(normalized)) return 'clinic'
  if (/escola|school|colegio/.test(normalized)) return 'school'
  if (/energia solar|solar.panel/.test(normalized)) return 'solar'
  return ''
}

const categoryFromNominatim = (result: NominatimResult) => {
  const tags = result.extratags || {}
  const descriptor = [
    result.category, result.type, result.name, tags.tourism, tags.amenity, tags.leisure,
    tags.sport, tags.office, tags.craft, tags.shop,
  ].filter(Boolean).join(' ')
  const family = categoryFamily(descriptor)
  if (family === 'lodging') {
    if (/chalet|camp.site|chale|cabana|glamping|refugio/i.test(descriptor)) return 'Chalé ou cabana'
    if (/resort/i.test(descriptor)) return 'Resort'
    if (/guest.house|pousada|hostel/i.test(descriptor)) return 'Pousada'
    return 'Hotel ou hospedagem'
  }
  const names: Record<string, string> = {
    venue: 'Local para eventos', winery: 'Vinícola', restaurant: 'Restaurante com área externa',
    equestrian: 'Haras', fishing: 'Pesqueiro', 'real-estate': 'Imobiliária',
    construction: 'Construtora ou incorporadora', 'car-dealer': 'Concessionária',
    mall: 'Shopping', fitness: 'Academia', clinic: 'Clínica', school: 'Escola', solar: 'Energia solar',
  }
  return names[family] || ''
}

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
  if (/hotel/.test(names)) filters.push('["tourism"="hotel"]')
  if (/pousada|hosped/.test(names)) filters.push('["tourism"="guest_house"]')
  if (/airbnb|temporada/.test(names)) filters.push('["tourism"="apartment"]')
  if (/chale|cabana|refugio|glamping/.test(names)) filters.push('["tourism"="chalet"]', '["tourism"="camp_site"]')
  if (/resort/.test(names)) filters.push('["tourism"="resort"]')
  if (/evento/.test(names)) filters.push('["amenity"="events_venue"]')
  if (/clube/.test(names)) filters.push('["leisure"="sports_centre"]')
  if (/vinicola/.test(names)) filters.push('["craft"="winery"]', '["shop"="wine"]')
  if (/restaurante/.test(names)) filters.push('["amenity"="restaurant"]')
  if (/haras/.test(names)) filters.push('["leisure"="horse_riding"]', '["sport"="equestrian"]')
  if (/pesqueiro/.test(names)) filters.push('["leisure"="fishing"]')
  if (/imobili|corretor/.test(names)) filters.push('["office"="estate_agent"]')
  if (/construtora|incorporadora|loteamento|condominio/.test(names)) filters.push('["office"="construction_company"]', '["craft"="builder"]')
  if (/concessionaria/.test(names)) filters.push('["shop"="car"]')
  if (/shopping/.test(names)) filters.push('["shop"="mall"]')
  if (/academia/.test(names)) filters.push('["leisure"="fitness_centre"]')
  if (/clinica/.test(names)) filters.push('["amenity"="clinic"]')
  if (/escola/.test(names)) filters.push('["amenity"="school"]')
  if (/industria|galpao|logistic/.test(names)) filters.push('["landuse"="industrial"]')
  if (/energia solar/.test(names)) filters.push('["craft"="solar_panel_installer"]')
  return [...new Set(filters.length ? filters : ['["tourism"="hotel"]', '["tourism"="guest_house"]'])]
}

const categoryFor = (tags: Record<string, string>, requested: string[]) => {
  const tourism = tags.tourism
  if (tourism === 'hotel') return requested.find((item) => normalize(item).includes('hotel')) || 'Hotel'
  if (['guest_house', 'hostel'].includes(tourism)) return requested.find((item) => /pousada|hosped/i.test(item)) || 'Pousada'
  if (tourism === 'apartment') return 'Airbnb ou casa de temporada'
  if (['chalet', 'camp_site'].includes(tourism)) return requested.find((item) => /chale|cabana|glamping/i.test(normalize(item))) || 'Cabana'
  if (tourism === 'resort') return 'Resort'
  if (tags.amenity === 'restaurant') return 'Restaurante com área externa'
  if (tags.amenity === 'events_venue' || tags.leisure === 'sports_centre') return 'Espaço para eventos'
  if (tags.craft === 'winery' || tags.shop === 'wine') return 'Vinícola'
  if (tags.leisure === 'horse_riding' || tags.sport === 'equestrian') return 'Haras'
  if (tags.leisure === 'fishing') return 'Pesqueiro'
  if (tags.office === 'estate_agent') return 'Imobiliária'
  if (tags.office === 'construction_company' || tags.craft === 'builder') return 'Construtora ou incorporadora'
  if (tags.shop === 'car') return 'Concessionária'
  if (tags.shop === 'mall') return 'Shopping'
  if (tags.leisure === 'fitness_centre') return 'Academia'
  if (tags.amenity === 'clinic') return 'Clínica'
  if (tags.amenity === 'school') return 'Escola'
  if (tags.craft === 'solar_panel_installer') return 'Energia solar'
  return ''
}

export const mapOsmElement = (element: OsmElement, city: string, requestedCategories: string[]): LeadSearchProviderResult['leads'][number] | null => {
  const tags = element.tags || {}
  const name = clean(tags.name || tags.brand || tags.operator || '')
  if (!name || lowFitName(name)) return null
  const categoryName = categoryFor(tags, requestedCategories)
  if (!categoryName) return null
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
    categoryName, recommendedService: recommendLeadService(categoryName), city, neighborhood: clean(tags['addr:suburb'] || tags['addr:neighbourhood'] || ''), address,
    latitude, longitude, phone, whatsapp, email: first(tags, 'contact:email', 'email'), instagram, website,
    googleMapsUrl: latitude != null && longitude != null ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : '',
    sources: ['OpenStreetMap'], sourceUrls: [`https://www.openstreetmap.org/${osmId}`], score, scoreReasons,
  }
}

export const mapNominatimResult = (result: NominatimResult, city: string, requestedCategories: string[]): LeadSearchProviderResult['leads'][number] | null => {
  const tags = result.extratags || {}
  const addressTags = result.address || {}
  const name = clean(result.name || result.namedetails?.name || result.display_name.split(',')[0] || '')
  if (!name) return null
  const categoryName = categoryFromNominatim(result)
  const requestedFamilies = new Set(requestedCategories.map(categoryFamily).filter(Boolean))
  const actualFamily = categoryFamily(categoryName)
  if (!categoryName || !actualFamily || !requestedFamilies.has(actualFamily) || lowFitName(name)) return null
  const latitude = Number(result.lat)
  const longitude = Number(result.lon)
  const phone = first(tags, 'contact:phone', 'phone', 'contact:mobile', 'mobile')
  const whatsapp = first(tags, 'contact:whatsapp', 'whatsapp')
  const website = first(tags, 'contact:website', 'website', 'url')
  const instagram = first(tags, 'contact:instagram', 'instagram')
  const email = first(tags, 'contact:email', 'email')
  const osmId = `${result.osm_type}/${result.osm_id}`
  const address = clean([
    addressTags.road || addressTags.pedestrian,
    addressTags.house_number,
    addressTags.suburb || addressTags.neighbourhood,
  ].filter(Boolean).join(', '))
  const hasContact = Boolean(phone || whatsapp || email)
  return {
    id: `osm-${result.osm_type}-${result.osm_id}`,
    externalIds: { openstreetmap: osmId },
    name,
    normalizedName: normalize(name),
    categoryName,
    recommendedService: recommendLeadService(categoryName),
    city,
    neighborhood: clean(addressTags.suburb || addressTags.neighbourhood || ''),
    address,
    latitude,
    longitude,
    phone,
    whatsapp,
    email,
    instagram,
    website,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    sources: ['OpenStreetMap / Nominatim'],
    sourceUrls: [`https://www.openstreetmap.org/${osmId}`],
    score: hasContact ? 75 : website || instagram ? 70 : 60,
    scoreReasons: [
      { id: 'public-source', label: 'Empresa confirmada em fonte pública', points: 60, evidence: `OpenStreetMap ${osmId}` },
      ...(hasContact ? [{ id: 'direct-contact', label: 'Contato direto disponível', points: 15 }] : []),
      ...(!hasContact && (website || instagram) ? [{ id: 'digital-presence', label: 'Presença digital disponível', points: 10 }] : []),
    ],
  }
}

const searchNominatimCategory = async (city: string, category: string, limit: number, signal?: AbortSignal): Promise<NominatimResult[]> => {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${category} ${city}, Paraná, Brasil`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('extratags', '1')
  url.searchParams.set('namedetails', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 10), 30)))
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal })
  if (!response.ok) throw new Error(`Nominatim respondeu ${response.status}`)
  return response.json() as Promise<NominatimResult[]>
}

const searchNominatim = async (city: string, categories: string[], limit: number, signal?: AbortSignal): Promise<LeadSearchProviderResult['leads']> => {
  const searchCategories = [...new Set(categories.map((category) => clean(category, 80)).filter(Boolean))].slice(0, 3)
  const collected: Array<{ result: NominatimResult; category: string }> = []
  const perCategoryLimit = Math.max(4, Math.ceil(limit / Math.max(searchCategories.length, 1)) + 2)
  for (const category of searchCategories.length ? searchCategories : ['hotel']) {
    const data = await searchNominatimCategory(city, category, perCategoryLimit, signal)
    collected.push(...data.map((result) => ({ result, category })))
  }
  const mapped = collected.map(({ result, category }) => mapNominatimResult(result, city, [category]))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => leadContactPriority(b) - leadContactPriority(a))
  const unique = new Map<string, (typeof mapped)[number]>()
  for (const lead of mapped) {
    const key = `${normalizeLeadText(lead.name)}|${normalizeLeadText(lead.city)}`
    const existing = unique.get(key)
    if (!existing || leadContactPriority(lead) > leadContactPriority(existing)) unique.set(key, lead)
  }
  const groups = new Map<string, Array<(typeof mapped)[number]>>()
  for (const lead of unique.values()) {
    const group = groups.get(lead.categoryName) || []
    group.push(lead)
    groups.set(lead.categoryName, group)
  }
  const diversified: Array<(typeof mapped)[number]> = []
  while (diversified.length < limit && [...groups.values()].some((group) => group.length)) {
    for (const group of groups.values()) {
      const lead = group.shift()
      if (lead) diversified.push(lead)
      if (diversified.length >= limit) break
    }
  }
  return diversified
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
    let nominatimLeads: LeadSearchProviderResult['leads'] = []
    try {
      nominatimLeads = await searchNominatim(city, categories, request.limit, signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000))
      if (nominatimLeads.length >= request.limit) {
        const result: LeadSearchProviderResult = {
          leads: nominatimLeads,
          sources: ['OpenStreetMap / Nominatim'],
          estimatedCost: 0,
          warnings: [],
        }
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), result }))
        return result
      }
    } catch {
      if (signal?.aborted) throw new Error('A busca foi cancelada antes de terminar.')
    }
    const filters = filtersFor(categories)
    const [latitude, longitude] = await locateCity(city, signal)
    const radiusMeters = Math.round(Math.min(Math.max(request.radiusKm, 2), 20) * 1000)
    const query = `[out:json][timeout:18];(${filters.map((filter) => `nwr${filter}(around:${radiusMeters},${latitude},${longitude});`).join('')});out center ${Math.min(Math.max(request.limit * 3, 30), 80)};`
    let lastError: unknown
    for (const endpoint of ENDPOINTS) {
      try {
        const attemptSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000)
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}`, signal: attemptSignal })
        if (!response.ok) throw new Error(`Overpass respondeu ${response.status}`)
        const data = await response.json() as { elements?: OsmElement[] }
        const overpassLeads = (data.elements || []).map((item) => mapOsmElement(item, city, categories)).filter((item): item is NonNullable<typeof item> => Boolean(item))
        const unique = new Map<string, (typeof overpassLeads)[number]>()
        for (const lead of [...nominatimLeads, ...overpassLeads]) {
          const leadKey = `${normalizeLeadText(lead.name)}|${normalizeLeadText(lead.city)}`
          const existing = unique.get(leadKey)
          if (!existing || leadContactPriority(lead) > leadContactPriority(existing)) unique.set(leadKey, lead)
        }
        const leads = [...unique.values()].sort((a, b) => leadContactPriority(b) - leadContactPriority(a)).slice(0, request.limit)
        const result: LeadSearchProviderResult = { leads, sources: ['OpenStreetMap / Nominatim', 'OpenStreetMap / Overpass API'], estimatedCost: 0, warnings: leads.length ? [] : ['Nenhum estabelecimento com nome foi encontrado nesta combinação. Tente outra categoria ou cidade.'] }
        if (leads.length) localStorage.setItem(key, JSON.stringify({ at: Date.now(), result }))
        return result
      } catch (error) { if (signal?.aborted) throw error; lastError = error }
    }
    throw new Error(`A fonte pública está temporariamente indisponível. Tente novamente em alguns minutos. ${lastError instanceof Error ? lastError.message : ''}`.trim())
  }
}
