import { createRemoteJWKSet, jwtVerify } from 'jose'

interface Env {
  OPENAI_API_KEY: string
  GOOGLE_PLACES_API_KEY: string
  FIREBASE_PROJECT_ID: string
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
  GOOGLE_OAUTH: KVNamespace
}

type InputLead = {
  id: string
  googlePlaceId?: string
  name: string
  city: string
  categoryName: string
  recommendedService?: string
  address?: string
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  instagram?: string
  googleMapsUrl?: string
  airbnbUrl?: string
  bookingUrl?: string
  sourceUrls?: string[]
}

const allowedOrigins = new Set([
  'https://flyflow-a97ab.web.app',
  'https://flyflow-a97ab.firebaseapp.com',
  'https://emersongmsantos03.github.io',
  'http://localhost:5173',
])

const clean = (value: unknown, max = 300) => [...String(value || '')]
  .map((character) => character.charCodeAt(0) < 32 || character === '<' || character === '>' ? ' ' : character)
  .join('').replace(/\s+/g, ' ').trim().slice(0, max)

const discoveryQueryTerm = (category: string) => {
  const normalized = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/airbnb|casa de temporada/.test(normalized)) return 'cabana hospedagem natureza'
  if (/booking|hospedagem|pousada/.test(normalized)) return 'pousada rural natureza'
  if (/chale/.test(normalized)) return 'chalé natureza'
  if (/cabana/.test(normalized)) return 'cabana natureza'
  if (/glamping/.test(normalized)) return 'glamping natureza'
  if (/refugio/.test(normalized)) return 'refúgio natureza'
  if (/hotel fazenda/.test(normalized)) return 'hotel fazenda'
  if (/resort/.test(normalized)) return 'eco resort natureza'
  if (/chacara|sitio/.test(normalized)) return 'chácara para locação hospedagem'
  if (/vinicola/.test(normalized)) return 'vinícola'
  if (/campo de golfe/.test(normalized)) return 'clube de golfe'
  if (/restaurante rural/.test(normalized)) return 'restaurante rural'
  return category
}

const contactsFromOfficialWebsite = async (website: string) => {
  if (!/^https?:\/\//i.test(website)) return {}
  try {
    const response = await fetch(website, {
      headers: { 'User-Agent': 'FlyFlow Lead Hunter/2.0 (+https://flyflow-a97ab.web.app)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(2_500),
    })
    if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) return {}
    const html = (await response.text()).slice(0, 750_000)
    const whatsappMatch = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?(?:[^"'<> ]*&amp;|[^"'<> ]*&)*phone=|whatsapp:\/\/send\?(?:[^"'<> ]*&amp;|[^"'<> ]*&)*phone=)(\+?\d[\d ().-]{8,18}\d)/i)
    const emailMatch = html.match(/mailto:([^"'?<> ]+)|\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i)
    const phoneMatch = html.match(/tel:(\+?\d[\d ().-]{8,18}\d)/i)
    const whatsapp = (whatsappMatch?.[1] || '').replace(/\D/g, '').replace(/^0+/, '')
    const email = clean(emailMatch?.[1] || emailMatch?.[2] || '', 160).toLowerCase()
    const phone = clean(phoneMatch?.[1] || '', 60)
    return {
      whatsapp: whatsapp.length >= 10 && whatsapp.length <= 13 ? whatsapp : '',
      email: /\.(png|jpg|jpeg|webp|svg)$/i.test(email) ? '' : email,
      phone,
    }
  } catch {
    return {}
  }
}

const corsHeaders = (origin: string | null) => ({
  ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
})

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) })

const signatureResponse = (dataUrl: string, origin: string | null) => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/)
  if (!match) return json({ error: 'Assinatura inválida.' }, 404, origin)
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Response(bytes, {
    headers: {
      ...corsHeaders(origin),
      'Content-Type': match[1],
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

const verifyFirebaseToken = async (token: string, projectId: string) => {
  if (!projectId) return null
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    })
    return payload.sub && payload.sub.length <= 128 ? payload.sub : null
  } catch {
    return null
  }
}

const workspaceForUser = async (token: string, userId: string, projectId: string) => {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/memberships/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Não foi possível identificar o workspace do usuário.')
  const body = await response.json() as { fields?: { workspaceId?: { stringValue?: string }; active?: { booleanValue?: boolean } } }
  if (!body.fields?.active?.booleanValue || !body.fields.workspaceId?.stringValue) throw new Error('Usuário sem workspace ativo.')
  return body.fields.workspaceId.stringValue
}

const exchangeGoogleToken = async (env: Env, parameters: Record<string, string>) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      ...parameters,
    }),
  })
  const body = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string }
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'O Google recusou a autorização.')
  return body
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    leads: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          contactName: { type: 'string' },
          address: { type: 'string' },
          phone: { type: 'string' },
          whatsapp: { type: 'string' },
          email: { type: 'string' },
          website: { type: 'string' },
          instagram: { type: 'string' },
          airbnbUrl: { type: 'string' },
          bookingUrl: { type: 'string' },
          aiSummary: { type: 'string' },
          aiApproach: { type: 'string' },
          aiOpportunityLevel: { type: 'string', enum: ['Excelente', 'Boa', 'Média', 'Ruim'] },
          aiSocialInsight: { type: 'string' },
          aiContactHook: { type: 'string' },
          aiFirstMessage: { type: 'string' },
          visualAssessment: {
            type: 'object',
            additionalProperties: false,
            properties: {
              hasDroneImages: { type: ['boolean', 'null'] },
              professionalImages: { type: ['boolean', 'null'] },
              simpleImages: { type: ['boolean', 'null'] },
              largeOutdoorArea: { type: ['boolean', 'null'] },
              strikingNature: { type: ['boolean', 'null'] },
              poolLakeOrView: { type: ['boolean', 'null'] },
              activeInstagram: { type: ['boolean', 'null'] },
              professionalWebsite: { type: ['boolean', 'null'] },
              goodVisualIdentity: { type: ['boolean', 'null'] },
              beautifulArchitecture: { type: ['boolean', 'null'] },
              lake: { type: ['boolean', 'null'] },
              pool: { type: ['boolean', 'null'] },
              forest: { type: ['boolean', 'null'] },
              panoramicView: { type: ['boolean', 'null'] },
              river: { type: ['boolean', 'null'] },
              worthCommercialTime: { type: ['boolean', 'null'] },
              opportunityReasons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            },
            required: ['hasDroneImages', 'professionalImages', 'simpleImages', 'largeOutdoorArea', 'strikingNature', 'poolLakeOrView', 'activeInstagram', 'professionalWebsite', 'goodVisualIdentity', 'beautifulArchitecture', 'lake', 'pool', 'forest', 'panoramicView', 'river', 'worthCommercialTime', 'opportunityReasons'],
          },
          sourceUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'contactName', 'address', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'airbnbUrl', 'bookingUrl', 'aiSummary', 'aiApproach', 'aiOpportunityLevel', 'aiSocialInsight', 'aiContactHook', 'aiFirstMessage', 'visualAssessment', 'sourceUrls'],
      },
    },
  },
  required: ['leads'],
}

const discoverySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    leads: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          categoryName: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          address: { type: 'string' },
          phone: { type: 'string' },
          website: { type: 'string' },
          instagram: { type: 'string' },
          googleMapsUrl: { type: 'string' },
          googleRating: { type: 'number' },
          googleReviewCount: { type: 'integer' },
          sourceUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'categoryName', 'city', 'state', 'address', 'phone', 'website', 'instagram', 'googleMapsUrl', 'googleRating', 'googleReviewCount', 'sourceUrls'],
      },
    },
  },
  required: ['leads'],
}

const outputText = (response: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) =>
  (response.output || []).flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || ''

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'flyflow-lead-api' }, 200, origin)
    if (request.method === 'GET' && url.pathname === '/health/places') {
      const queries = ['cabana Curitiba PR', 'chácara hospedagem São José dos Pinhais PR', 'pousada Campo Largo PR', 'casa de temporada Curitiba PR']
      const checks = await Promise.all(queries.map(async (textQuery) => {
        const check = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.googleMapsUri,places.formattedAddress',
          },
          body: JSON.stringify({ textQuery, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 5 }),
        })
        const body = await check.json() as { places?: unknown[]; error?: { message?: string } }
        return { query: textQuery, ok: check.ok, status: check.status, results: body.places?.length || 0, error: clean(body.error?.message) }
      }))
      return json({ ok: checks.every((check) => check.ok), checks }, checks.every((check) => check.ok) ? 200 : 502, origin)
    }
    if (request.method === 'GET' && url.pathname === '/health/discovery') {
      try {
        const checkUrl = new URL('https://nominatim.openstreetmap.org/search')
        checkUrl.search = new URLSearchParams({
          format: 'jsonv2', addressdetails: '1', countrycodes: 'br', limit: '1',
          q: 'pousada Curitiba PR',
        }).toString()
        const checkResponse = await fetch(checkUrl, {
          headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'FlyFlow-HeroDrone/2.0 (health check)' },
        })
        const checkResults = checkResponse.ok ? await checkResponse.json() as unknown[] : []
        return json({ ok: checkResponse.ok, status: checkResponse.status, results: checkResults.length }, checkResponse.ok ? 200 : 502, origin)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : 'Falha desconhecida' }, 502, origin)
      }
    }
    const signatureImageMatch = url.pathname.match(/^\/google\/signature\/image\/([a-f0-9-]{36})$/)
    if (request.method === 'GET' && signatureImageMatch) {
      const signature = await env.GOOGLE_OAUTH.get(`signature:${signatureImageMatch[1]}`)
      return signature ? signatureResponse(signature, origin) : json({ error: 'Assinatura não encontrada.' }, 404, origin)
    }
    if (origin && !allowedOrigins.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin)

    const isPublicLeadDiscovery = request.method === 'POST' && url.pathname === '/lead-discovery'
    const authorization = request.headers.get('Authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    const userId = token ? await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID) : null
    if (!userId && !isPublicLeadDiscovery) {
      return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
    }

    if (url.pathname.startsWith('/google/')) {
      try {
        const workspaceId = await workspaceForUser(token, userId, env.FIREBASE_PROJECT_ID)
        const key = `workspace:${workspaceId}`
        const signatureKey = `workspace:${workspaceId}:signature`
        const stored = await env.GOOGLE_OAUTH.get(key, 'json') as { refreshToken?: string; email?: string; connectedAt?: string } | null

        if (request.method === 'GET' && url.pathname === '/google/status') {
          return json({ connected: Boolean(stored?.refreshToken), email: stored?.email || '', connectedAt: stored?.connectedAt || '' }, 200, origin)
        }
        if (request.method === 'POST' && url.pathname === '/google/connect') {
          const body = await request.json().catch(() => null) as { code?: string; redirectUri?: string } | null
          if (!body?.code || !body.redirectUri || !allowedOrigins.has(body.redirectUri)) return json({ error: 'Código ou origem inválida.' }, 400, origin)
          const tokens = await exchangeGoogleToken(env, {
            code: body.code,
            redirect_uri: body.redirectUri,
            grant_type: 'authorization_code',
          })
          const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })
          const profile = await profileResponse.json() as { email?: string }
          const refreshToken = tokens.refresh_token || stored?.refreshToken
          if (!refreshToken) return json({ error: 'O Google não forneceu acesso permanente. Revogue o FlyFlow nas permissões da conta e conecte novamente.' }, 400, origin)
          const connection = { refreshToken, email: profile.email || '', connectedAt: new Date().toISOString() }
          await env.GOOGLE_OAUTH.put(key, JSON.stringify(connection))
          return json({ connected: true, email: connection.email }, 200, origin)
        }
        if (request.method === 'POST' && url.pathname === '/google/token') {
          if (!stored?.refreshToken) return json({ error: 'Conta Google ainda não conectada ao workspace.' }, 404, origin)
          const refreshed = await exchangeGoogleToken(env, {
            refresh_token: stored.refreshToken,
            grant_type: 'refresh_token',
          })
          return json({ accessToken: refreshed.access_token, expiresIn: refreshed.expires_in || 3600, email: stored.email || '' }, 200, origin)
        }
        if (request.method === 'DELETE' && url.pathname === '/google/connection') {
          if (stored?.refreshToken) {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(stored.refreshToken)}`, { method: 'POST' }).catch(() => undefined)
          }
          await env.GOOGLE_OAUTH.delete(key)
          return json({ connected: false }, 200, origin)
        }
        if (request.method === 'POST' && url.pathname === '/google/signature') {
          const body = await request.json().catch(() => null) as { dataUrl?: string } | null
          const dataUrl = body?.dataUrl || ''
          if (!/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(dataUrl) || dataUrl.length > 8_000_000) {
            return json({ error: 'Envie uma imagem PNG, JPG, WEBP ou GIF de até 5 MB.' }, 400, origin)
          }
          const previousToken = await env.GOOGLE_OAUTH.get(signatureKey)
          const signatureToken = crypto.randomUUID()
          await Promise.all([
            env.GOOGLE_OAUTH.put(`signature:${signatureToken}`, dataUrl),
            env.GOOGLE_OAUTH.put(signatureKey, signatureToken),
          ])
          if (previousToken) await env.GOOGLE_OAUTH.delete(`signature:${previousToken}`)
          return json({ url: `${url.origin}/google/signature/image/${signatureToken}` }, 200, origin)
        }
        if (request.method === 'DELETE' && url.pathname === '/google/signature') {
          const signatureToken = await env.GOOGLE_OAUTH.get(signatureKey)
          await env.GOOGLE_OAUTH.delete(signatureKey)
          if (signatureToken) await env.GOOGLE_OAUTH.delete(`signature:${signatureToken}`)
          return json({ removed: true }, 200, origin)
        }
        return json({ error: 'Rota Google não encontrada.' }, 404, origin)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Falha na integração Google.' }, 500, origin)
      }
    }

    if (request.method === 'POST' && url.pathname === '/lead-discovery') {
      const body = await request.json().catch(() => null) as { cities?: unknown[]; categories?: unknown[]; excludedNames?: unknown[]; limit?: number } | null
      const cities = (Array.isArray(body?.cities) ? body.cities : []).map((item) => clean(item, 80)).filter(Boolean).slice(0, 12)
      const categories = (Array.isArray(body?.categories) ? body.categories : []).map((item) => clean(item, 80)).filter(Boolean).slice(0, 3)
      const excludedNames = new Set((Array.isArray(body?.excludedNames) ? body.excludedNames : [])
        .map((item) => clean(item, 160).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 300))
      const limit = Math.max(1, Math.min(Number(body?.limit) || 10, 20))
      if (!cities.length || !categories.length) return json({ error: 'Informe cidade e categoria.' }, 400, origin)
      const leads: Array<Record<string, unknown>> = []
      const discoveredKeys = new Set<string>()
      const categoryCounts = new Map<string, number>()
      const warnings: string[] = []
      if (userId && env.GOOGLE_PLACES_API_KEY) {
        for (const category of categories) {
          for (const city of cities) {
            if (leads.length >= Math.min(limit, 10)) break
            if ((categoryCounts.get(category) || 0) >= 4) break
            try {
              const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
                  'X-Goog-FieldMask': [
                    'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents',
                    'places.location', 'places.googleMapsUri', 'places.websiteUri', 'places.nationalPhoneNumber',
                    'places.rating', 'places.userRatingCount', 'places.primaryType', 'places.businessStatus',
                  ].join(','),
                },
                body: JSON.stringify({
                  textQuery: `${discoveryQueryTerm(category)} ${city} PR`,
                  languageCode: 'pt-BR',
                  regionCode: 'BR',
                  pageSize: Math.min(10, limit),
                }),
              })
              const placesBody = await placesResponse.json() as {
                error?: { message?: string }
                places?: Array<{
                  id?: string
                  displayName?: { text?: string }
                  formattedAddress?: string
                  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>
                  location?: { latitude?: number; longitude?: number }
                  googleMapsUri?: string
                  websiteUri?: string
                  nationalPhoneNumber?: string
                  rating?: number
                  userRatingCount?: number
                  primaryType?: string
                  businessStatus?: string
                }>
              }
              if (!placesResponse.ok) throw new Error(clean(placesBody.error?.message || `Google Places respondeu ${placesResponse.status}`))
              for (const place of placesBody.places || []) {
                const name = clean(place.displayName?.text, 160)
                const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
                const normalizedAddress = clean(place.formattedAddress, 300).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                const normalizedCategory = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                const locality = place.addressComponents?.find((component) => component.types?.includes('locality'))?.longText ||
                  place.addressComponents?.find((component) => component.types?.includes('administrative_area_level_2'))?.longText || ''
                const stateCode = place.addressComponents?.find((component) => component.types?.includes('administrative_area_level_1'))?.shortText || ''
                const sameCity = locality.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
                  city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                if (!place.id || !name || !place.googleMapsUri || stateCode !== 'PR' || !sameCity) continue
                if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') continue
                if (excludedNames.has(normalizedName) || discoveredKeys.has(place.id)) continue
                if (/condominio|residencial|bar\b|restaurante|loja|floricultura|igreja|escola|hospital|clinica/.test(normalizedName)) continue
                const outdoorSignal = /chale|cabana|chacara|sitio|fazenda|glamping|refugio|recanto|bosque|mata|serra|campo|lago|vale|natureza|rural|eco\b/.test(`${normalizedName} ${normalizedAddress}`)
                const genericUrbanLodging = /hotel|pousada|hostel|flat|apart hotel/.test(normalizedName) && !outdoorSignal
                const centralAddress = /\bcentro\b|centro civico|batel|agua verde|reboucas/.test(normalizedAddress)
                const outdoorCategory = /chale|cabana|chacara|sitio|glamping|refugio|hotel fazenda|airbnb|casa de temporada/.test(normalizedCategory)
                if (centralAddress || genericUrbanLodging || (outdoorCategory && !outdoorSignal)) continue
                discoveredKeys.add(place.id)
                const potentialScore = Math.min(100,
                  55 +
                  (outdoorSignal ? 25 : 0) +
                  (/chale|cabana|chacara|sitio|glamping|refugio|fazenda/.test(normalizedName) ? 15 : 0) +
                  (Number(place.rating) >= 4.5 ? 5 : 0))
                leads.push({
                  id: `google-${place.id}`,
                  externalIds: { googlePlaces: place.id, googleBusiness: place.id },
                  name,
                  normalizedName,
                  categoryName: category,
                  city: locality || city,
                  neighborhood: '',
                  address: clean(place.formattedAddress, 300),
                  latitude: place.location?.latitude,
                  longitude: place.location?.longitude,
                  phone: clean(place.nationalPhoneNumber, 60),
                  whatsapp: clean(place.nationalPhoneNumber, 60),
                  email: '',
                  instagram: '',
                  website: clean(place.websiteUri, 300),
                  googleMapsUrl: place.googleMapsUri,
                  googleRating: Math.max(0, Math.min(5, Number(place.rating) || 0)),
                  googleReviewCount: Math.max(0, Number(place.userRatingCount) || 0),
                  sources: ['Google Places API (perfil oficial)'],
                  sourceUrls: [place.googleMapsUri, place.websiteUri || ''].filter(Boolean),
                  score: potentialScore,
                  scoreReasons: [
                    { id: 'google-place-id-confirmed', label: 'Perfil oficial do Google Business confirmado', points: 45, evidence: place.id },
                    ...(outdoorSignal ? [{ id: 'outdoor-potential', label: 'Nome ou endereço indica natureza e área externa', points: 25 }] : []),
                  ],
                })
                categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
                if (leads.length >= Math.min(limit, 10)) break
                if ((categoryCounts.get(category) || 0) >= 4) break
              }
            } catch (error) {
              warnings.push(`Google Places (${category}, ${city}): ${error instanceof Error ? error.message : 'indisponível'}`)
            }
          }
          if (leads.length >= Math.min(limit, 10)) break
        }
        if (leads.length) {
          await Promise.all(leads.map(async (lead) => {
            const website = String(lead.website || '')
            if (!website) return
            const contacts = await contactsFromOfficialWebsite(website)
            if (contacts.phone && !lead.phone) lead.phone = contacts.phone
            if (contacts.whatsapp) lead.whatsapp = contacts.whatsapp
            if (!lead.whatsapp && lead.phone) lead.whatsapp = String(lead.phone)
            if (contacts.email) lead.email = contacts.email
            if (contacts.phone || contacts.whatsapp || contacts.email) {
              lead.scoreReasons = [
                ...((lead.scoreReasons as Array<Record<string, unknown>>) || []),
                { id: 'official-contact', label: 'Contato localizado no site oficial', points: 10, evidence: website },
              ]
              lead.score = Math.min(100, Number(lead.score || 0) + 10)
            }
          }))
          leads.sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
          return json({ leads, sources: ['Google Places API (perfil oficial)'], warnings }, 200, origin)
        }
      }
      if (userId && env.OPENAI_API_KEY) {
        try {
          const aiResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-5.6-luna',
              reasoning: { effort: 'none' },
              store: false,
              tools: [{ type: 'web_search', search_context_size: 'medium' }],
              include: ['web_search_call.action.sources'],
              instructions: [
                'Encontre no máximo 10 empresas reais para prospecção de fotos e vídeos com drone.',
                'Priorize estritamente chalés, cabanas, casas de temporada, chácaras de hospedagem, hotel fazenda, pousadas, glampings e campings.',
                'Não retorne vinícolas enquanto houver qualquer hospedagem adequada.',
                'Pesquise somente nas cidades fornecidas, todas no Paraná. Nunca retorne outra cidade ou estado.',
                'Cada lead precisa ter um perfil real e específico no Google Maps/Google Business.',
                'googleMapsUrl deve ser a URL direta e verificável do perfil do estabelecimento no Google Maps, não uma busca genérica, rota, endereço próximo ou link inventado.',
                'Confirme nome, cidade e endereço no perfil do Google ou no site oficial.',
                'Não retorne condomínios residenciais, propriedades privadas sem hospedagem anunciada, bares, restaurantes, lojas, floriculturas ou locais sem presença digital.',
                'Não retorne nenhum nome da lista excludedNames.',
                'Use strings vazias e zero quando um dado opcional não estiver publicamente confirmado. Nunca invente.',
                'sourceUrls deve incluir o Google Maps e, quando existir, site, Instagram, Airbnb ou Booking exatos.',
              ].join(' '),
              input: JSON.stringify({ cities, categories, excludedNames: [...excludedNames].slice(0, 300), limit }),
              text: { format: { type: 'json_schema', name: 'lead_discovery', strict: true, schema: discoverySchema }, verbosity: 'low' },
              max_output_tokens: 2200,
            }),
          })
          const aiBody = await aiResponse.json() as {
            error?: { message?: string }
            output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
          }
          if (!aiResponse.ok) throw new Error(clean(aiBody.error?.message || `OpenAI respondeu ${aiResponse.status}`))
          const parsed = JSON.parse(outputText(aiBody) || '{"leads":[]}') as { leads?: Array<Record<string, unknown>> }
          for (const item of parsed.leads || []) {
            const name = clean(item.name, 160)
            const city = clean(item.city, 100)
            const state = clean(item.state, 40).toUpperCase()
            const googleMapsUrl = clean(item.googleMapsUrl, 500)
            const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
            const requestedCity = cities.some((candidate) =>
              candidate.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
              city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
            if (!name || !requestedCity || !['PR', 'PARANÁ', 'PARANA'].includes(state) || excludedNames.has(normalizedName)) continue
            if (!/^https?:\/\/(www\.)?(google\.[^/]+\/maps|maps\.google\.)/i.test(googleMapsUrl)) continue
            leads.push({
              id: `google-web-${crypto.randomUUID()}`,
              externalIds: { googleBusiness: googleMapsUrl },
              name,
              normalizedName,
              categoryName: clean(item.categoryName, 100),
              city,
              neighborhood: '',
              address: clean(item.address, 300),
              phone: clean(item.phone, 60),
              whatsapp: '',
              email: '',
              instagram: clean(item.instagram, 200),
              website: clean(item.website, 300),
              googleMapsUrl,
              googleRating: Math.max(0, Math.min(5, Number(item.googleRating) || 0)),
              googleReviewCount: Math.max(0, Number(item.googleReviewCount) || 0),
              sources: ['Google Maps / pesquisa web verificada'],
              sourceUrls: Array.isArray(item.sourceUrls)
                ? item.sourceUrls.map((source) => clean(source, 500)).filter((source) => /^https?:\/\//i.test(source)).slice(0, 8)
                : [googleMapsUrl],
              score: 70,
              scoreReasons: [{ id: 'google-profile-confirmed', label: 'Perfil específico do Google Maps confirmado', points: 70 }],
            })
            if (leads.length >= Math.min(limit, 10)) break
          }
          if (leads.length) return json({ leads, sources: ['Google Maps / pesquisa web verificada'], warnings: [] }, 200, origin)
        } catch (error) {
          warnings.push(`Pesquisa Google verificada: ${error instanceof Error ? error.message : 'indisponível'}`)
        }
      }
      if (userId) {
        return json({
          leads: [],
          sources: [],
          warnings: warnings.length ? warnings : ['Nenhum perfil específico do Google Maps foi confirmado nesta rodada.'],
        }, 200, origin)
      }
      for (const city of cities) {
        for (const category of categories.slice(0, 2)) {
          if (leads.length >= limit) break
          try {
            const searchUrl = new URL('https://nominatim.openstreetmap.org/search')
            searchUrl.search = new URLSearchParams({
              format: 'jsonv2',
              addressdetails: '1',
              countrycodes: 'br',
              limit: String(Math.min(6, limit - leads.length)),
              q: `${discoveryQueryTerm(category)} ${city} PR`,
            }).toString()
            const response = await fetch(searchUrl, {
              headers: {
                'Accept-Language': 'pt-BR',
                'User-Agent': 'FlyFlow-HeroDrone/2.0 (lead discovery)',
              },
            })
            if (!response.ok) throw new Error(`Nominatim respondeu ${response.status}`)
            const results = await response.json() as Array<{
              place_id?: number; osm_id?: number; osm_type?: string; name?: string; display_name?: string
              lat?: string; lon?: string; category?: string; type?: string
              address?: { city?: string; town?: string; village?: string; municipality?: string; state?: string; suburb?: string; neighbourhood?: string }
            }>
            for (const item of results) {
              const name = clean(item.name, 160)
              if (!name || !item.lat || !item.lon) continue
              const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
              if (excludedNames.has(normalizedName)) continue
              const resolvedCity = clean(item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || city, 100)
              const normalizedCity = resolvedCity.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
              const requestedCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
              const state = clean(item.address?.state, 80).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
              if (state !== 'parana' || normalizedCity !== requestedCity) continue
              if (/condominio|residencial|suplementos|bar\b|petiscaria|floricultura|emporio|loja|privada|igreja|escola|hospital|clinica/.test(normalizedName)) continue
              const uniqueKey = `${normalizedName}|${normalizedCity}`
              if (discoveredKeys.has(uniqueKey)) continue
              discoveredKeys.add(uniqueKey)
              const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${resolvedCity}, PR`)}`
              const osmUrl = item.osm_type && item.osm_id
                ? `https://www.openstreetmap.org/${item.osm_type === 'node' ? 'node' : item.osm_type === 'way' ? 'way' : 'relation'}/${item.osm_id}`
                : searchUrl.toString()
              leads.push({
                id: `nominatim-${item.place_id || `${item.osm_type}-${item.osm_id}`}`,
                externalIds: { openstreetmap: `${item.osm_type || ''}-${item.osm_id || item.place_id || ''}` },
                name,
                normalizedName,
                categoryName: category,
                city: resolvedCity,
                neighborhood: clean(item.address?.suburb || item.address?.neighbourhood, 100),
                address: clean(item.display_name, 300),
                latitude: Number(item.lat),
                longitude: Number(item.lon),
                phone: '', whatsapp: '', email: '', instagram: '', website: '',
                googleMapsUrl: mapUrl,
                sources: ['OpenStreetMap / Nominatim (backend)'],
                sourceUrls: [osmUrl, mapUrl],
                score: 60,
                scoreReasons: [{ id: 'backend-map-confirmed', label: 'Empresa localizada em fonte cartográfica pública', points: 60 }],
              })
              if (leads.length >= limit) break
            }
          } catch (error) {
            warnings.push(`${category} em ${city}: ${error instanceof Error ? error.message : 'fonte indisponível'}`)
          }
        }
        if (leads.length >= limit) break
      }
      return json({ leads, sources: leads.length ? ['OpenStreetMap / Nominatim (backend)'] : [], warnings }, 200, origin)
    }

    if (request.method !== 'POST' || url.pathname !== '/lead-enrichment') return json({ error: 'Rota não encontrada.' }, 404, origin)

    const body = await request.json().catch(() => null) as { leads?: InputLead[] } | null
    const leads = (Array.isArray(body?.leads) ? body.leads : []).slice(0, 3).map((lead) => ({
      id: clean(lead.id, 100),
      googlePlaceId: clean(lead.googlePlaceId, 200),
      name: clean(lead.name, 160),
      city: clean(lead.city, 100),
      categoryName: clean(lead.categoryName, 100),
      recommendedService: clean(lead.recommendedService, 120),
      address: clean(lead.address),
      phone: clean(lead.phone, 60),
      whatsapp: clean(lead.whatsapp, 60),
      email: clean(lead.email, 160),
      website: clean(lead.website, 240),
      instagram: clean(lead.instagram, 160),
      googleMapsUrl: clean(lead.googleMapsUrl, 400),
      airbnbUrl: clean(lead.airbnbUrl, 400),
      bookingUrl: clean(lead.bookingUrl, 400),
      sourceUrls: (lead.sourceUrls || []).slice(0, 5).map((item) => clean(item, 400)),
    })).filter((lead) => lead.id && lead.name)
    if (!leads.length) return json({ error: 'Envie ao menos um lead.' }, 400, origin)
    if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY ainda não configurada no Worker.' }, 503, origin)

    const verifiedContacts = new Map<string, { phone?: string; whatsapp?: string; email?: string; website?: string; googleMapsUrl?: string; sourceUrls: string[] }>()
    await Promise.all(leads.map(async (lead) => {
      if (!lead.googlePlaceId || !env.GOOGLE_PLACES_API_KEY) return
      try {
        const placeResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(lead.googlePlaceId)}`, {
          headers: {
            'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'id,googleMapsUri,websiteUri,nationalPhoneNumber',
          },
          signal: AbortSignal.timeout(3_000),
        })
        if (!placeResponse.ok) return
        const place = await placeResponse.json() as { googleMapsUri?: string; websiteUri?: string; nationalPhoneNumber?: string }
        const websiteContacts = place.websiteUri ? await contactsFromOfficialWebsite(place.websiteUri) : {}
        verifiedContacts.set(lead.id, {
          phone: clean(place.nationalPhoneNumber || websiteContacts.phone, 60),
          whatsapp: clean(websiteContacts.whatsapp, 60),
          email: clean(websiteContacts.email, 160),
          website: clean(place.websiteUri, 240),
          googleMapsUrl: clean(place.googleMapsUri, 400),
          sourceUrls: [place.googleMapsUri, place.websiteUri].filter((item): item is string => Boolean(item)),
        })
        lead.phone = lead.phone || clean(place.nationalPhoneNumber || websiteContacts.phone, 60)
        lead.whatsapp = lead.whatsapp || clean(websiteContacts.whatsapp, 60)
        lead.email = lead.email || clean(websiteContacts.email, 160)
        lead.website = lead.website || clean(place.websiteUri, 240)
        lead.googleMapsUrl = clean(place.googleMapsUri, 400) || lead.googleMapsUrl
        lead.sourceUrls = [...new Set([...lead.sourceUrls, place.googleMapsUri, place.websiteUri].filter((item): item is string => Boolean(item)))]
      } catch {
        // A análise com pesquisa web continua mesmo se o detalhe do Places estiver temporariamente indisponível.
      }
    }))

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'none' },
        store: false,
        tools: [{ type: 'web_search', search_context_size: 'low' }],
        include: ['web_search_call.action.sources'],
        instructions: [
          'Enriqueça leads B2B brasileiros usando somente informações públicas verificáveis.',
          'Pesquise cada empresa por nome, cidade, endereço, site e perfil fornecido do Google Maps/Google Business.',
          'Procure primeiro no Google Business, site oficial e página de contato; depois no Instagram oficial, bio, Linktree e Facebook comercial.',
          'No site oficial, verifique cabeçalho, rodapé, páginas Contato/Fale Conosco/Reservas e botões flutuantes. Extraia o destino de links wa.me, api.whatsapp.com e whatsapp:// mesmo quando o número não aparece no texto.',
          'No perfil do Google Business/Maps, procure o telefone, o botão de site e links de mensagem ou WhatsApp; depois abra o site oficial encontrado para confirmar o canal.',
          'Sempre preencha website com o domínio oficial confirmado quando ele for encontrado no Google Business, Instagram ou outra fonte oficial.',
          'Busque links wa.me, api.whatsapp.com, botões ou textos que anunciem explicitamente WhatsApp. Um telefone comum só pode preencher whatsapp quando uma fonte pública disser que ele atende por WhatsApp.',
          'Priorize WhatsApp público, telefone, e-mail, Instagram oficial e o nome de proprietário, gerente ou responsável comercial.',
          'Confirme também o endereço comercial completo, com rua, número, bairro, cidade e estado quando publicado. Não use endereço de diretório, sede de rede ou empresa homônima.',
          'Para cada telefone, WhatsApp ou e-mail retornado, inclua em sourceUrls a página exata onde o dado aparece. Não use agregadores sem confirmação cruzada com Google Business, site ou rede oficial.',
          'Diferencie telefone de WhatsApp: só preencha whatsapp quando houver botão, link wa.me/api.whatsapp.com ou indicação pública explícita de atendimento por WhatsApp.',
          'Avalie como oportunidade real para um profissional de drone que está começando: negócio local e independente, qualidade e frequência das redes sociais, apelo visual do imóvel ou operação, facilidade de contato e chance de contratar.',
          'Grandes redes e marcas nacionais devem ter menor prioridade, salvo evidência clara de decisão local.',
          'Em aiSummary, escreva em português uma observação comercial objetiva de até 240 caracteres: classifique como Excelente, Boa, Média ou Ruim; diga por que vale abordar, qual serviço de drone é mais aderente e cite uma evidência pública.',
          'Em aiApproach, escreva em português uma sugestão prática e personalizada de primeiro contato de até 240 caracteres.',
          'aiOpportunityLevel deve ser Excelente, Boa, Média ou Ruim conforme a chance real de contratar e aproveitar imagens de drone.',
          'Em aiSocialInsight, resuma em até 180 caracteres como a empresa usa Instagram/site e qual lacuna visual pública foi identificada. Se não encontrar evidência, diga isso.',
          'Em aiContactHook, entregue em até 160 caracteres um gancho específico sobre o local ou negócio que prove que a abordagem não é genérica.',
          'Em aiFirstMessage, escreva uma mensagem inicial curta, humana e personalizada para WhatsApp ou Instagram, sem prometer resultados e sem parecer spam.',
          'Nunca invente dados. Deixe vazio quando não houver evidência confiável.',
          'Não use bases vazadas nem retorne dados pessoais sensíveis.',
          'sourceUrls deve comprovar os dados retornados.',
          'Abra o site oficial e procure galeria, fotos, vídeos, Instagram, Facebook, WhatsApp e anúncios exatos no Airbnb e Booking.com.',
          'Analise somente evidências públicas visíveis sobre frequência do Instagram, qualidade das imagens, vídeos, fotos aéreas, área externa, natureza, piscina, lago, rio, bosque, vista e arquitetura.',
          'Use null para todo sinal visual que não puder ser verificado. Ausência de evidência nunca significa false.',
          'airbnbUrl e bookingUrl só podem conter o anúncio exato desta propriedade. Caso não seja confirmado, deixe vazio.',
          'Marque hasDroneImages=true apenas com evidência clara de tomada aérea. Se o banco aéreo já for excelente e recente, worthCommercialTime deve ser false.',
          'opportunityReasons deve conter no máximo cinco motivos curtos e comprovados.',
        ].join(' '),
        input: JSON.stringify(leads),
        text: { format: { type: 'json_schema', name: 'lead_enrichment', strict: true, schema }, verbosity: 'low' },
        max_output_tokens: 1200,
      }),
    })
    const openaiBody = await openaiResponse.json() as {
      error?: { message?: string }
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
      usage?: { total_tokens?: number }
    }
    if (!openaiResponse.ok) {
      return json({ error: openaiResponse.status === 429 ? 'Créditos ou limite da OpenAI atingidos.' : clean(openaiBody.error?.message || 'Falha na OpenAI.') }, openaiResponse.status === 429 ? 429 : 502, origin)
    }

    const parsed = JSON.parse(outputText(openaiBody) || '{"leads":[]}') as { leads?: Array<Record<string, unknown>> }
    const requestedIds = new Set(leads.map((lead) => lead.id))
    const enriched = (parsed.leads || []).filter((lead) => requestedIds.has(clean(lead.id, 100))).map((lead) => {
      const id = clean(lead.id, 100)
      const verified = verifiedContacts.get(id)
      return {
      id,
      contactName: clean(lead.contactName, 160),
      address: clean(lead.address, 300),
      phone: clean(lead.phone || verified?.phone, 60),
      whatsapp: clean(lead.whatsapp || verified?.whatsapp || lead.phone || verified?.phone, 60),
      email: clean(lead.email || verified?.email, 160),
      website: clean(lead.website || verified?.website, 240),
      instagram: clean(lead.instagram, 160),
      airbnbUrl: clean(lead.airbnbUrl, 400),
      bookingUrl: clean(lead.bookingUrl, 400),
      aiSummary: clean(lead.aiSummary, 300),
      aiApproach: clean(lead.aiApproach, 300),
      aiOpportunityLevel: ['Excelente', 'Boa', 'Média', 'Ruim'].includes(clean(lead.aiOpportunityLevel, 20)) ? clean(lead.aiOpportunityLevel, 20) : 'Média',
      aiSocialInsight: clean(lead.aiSocialInsight, 240),
      aiContactHook: clean(lead.aiContactHook, 220),
      aiFirstMessage: clean(lead.aiFirstMessage, 500),
      visualAssessment: {
        ...(typeof lead.visualAssessment === 'object' && lead.visualAssessment ? lead.visualAssessment : {}),
        opportunityReasons: Array.isArray((lead.visualAssessment as { opportunityReasons?: unknown[] } | undefined)?.opportunityReasons)
          ? (lead.visualAssessment as { opportunityReasons: unknown[] }).opportunityReasons.slice(0, 5).map((item) => clean(item, 180))
          : [],
      },
      sourceUrls: [...new Set([
        ...(Array.isArray(lead.sourceUrls) ? lead.sourceUrls.map((item) => clean(item, 400)).filter((item) => /^https?:\/\//i.test(item)) : []),
        ...(verified?.sourceUrls || []),
      ])].slice(0, 8),
    }})
    return json({ leads: enriched, tokenUsage: openaiBody.usage?.total_tokens || 0 }, 200, origin)
  },
}
