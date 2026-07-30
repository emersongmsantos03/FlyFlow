import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose'

interface Env {
  OPENAI_API_KEY: string
  GOOGLE_PLACES_API_KEY: string
  FIREBASE_PROJECT_ID: string
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
  GOOGLE_OAUTH: KVNamespace
  FLYFLOW_DB: D1Database
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

const verifyFirebaseIdentity = async (token: string, projectId: string) => {
  if (!projectId) return null
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    })
    if (!payload.sub || payload.sub.length > 128) return null
    return { userId: payload.sub, email: String(payload.email || '').toLowerCase() }
  } catch {
    return null
  }
}

const firebaseAdminAccessToken = async (env: Env) => {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}') as {
    client_email?: string
    private_key?: string
  }
  if (!account.client_email || !account.private_key) throw new Error('Credencial administrativa do Firebase não configurada.')
  const key = await importPKCS8(account.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3_600)
    .sign(key)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const body = await response.json() as { access_token?: string; error_description?: string }
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'Firebase recusou a credencial administrativa.')
  return body.access_token
}

const updateFirebaseTemporaryPassword = async (env: Env, email: string, password: string) => {
  const accessToken = await firebaseAdminAccessToken(env)
  const baseUrl = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}`
  const lookup = await fetch(`${baseUrl}/accounts:lookup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: [email] }),
  })
  const lookupBody = await lookup.json() as { users?: Array<{ localId?: string }>; error?: { message?: string } }
  const localId = lookupBody.users?.[0]?.localId
  if (!lookup.ok || !localId) throw new Error(lookupBody.error?.message === 'USER_NOT_FOUND' ? 'Conta de login não encontrada.' : 'Não foi possível localizar a conta.')
  const update = await fetch(`${baseUrl}/accounts:update`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId, password }),
  })
  const updateBody = await update.json() as { error?: { message?: string } }
  if (!update.ok) throw new Error(updateBody.error?.message || 'O Firebase recusou a nova senha.')
}

const claimFirebaseInvitation = async (env: Env, identity: { userId: string; email: string }) => {
  const accessToken = await firebaseAdminAccessToken(env)
  const documentsBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`
  const invitationResponse = await fetch(`${documentsBase}/workspaceInvitations/${encodeURIComponent(identity.email)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (invitationResponse.status === 404) return false
  const invitationDocument = await invitationResponse.json() as {
    error?: { message?: string; status?: string }
    fields?: {
      workspaceId?: { stringValue?: string }
      email?: { stringValue?: string }
      profile?: { mapValue?: { fields?: {
        name?: { stringValue?: string }
        role?: { stringValue?: string }
        permissions?: { arrayValue?: { values?: Array<{ stringValue?: string }> } }
      } } }
    }
  }
  if (!invitationResponse.ok) {
    throw new Error(invitationDocument.error?.message || `Não foi possível carregar o convite (${invitationResponse.status}).`)
  }
  const fields = invitationDocument.fields
  const workspaceId = fields?.workspaceId?.stringValue || ''
  const invitationEmail = fields?.email?.stringValue?.toLowerCase() || ''
  const profileFields = fields?.profile?.mapValue?.fields
  const role = profileFields?.role?.stringValue || ''
  const permissions = (profileFields?.permissions?.arrayValue?.values || [])
    .map((item) => item.stringValue || '')
    .filter(Boolean)
  if (!workspaceId || invitationEmail !== identity.email || !role || !permissions.length) {
    throw new Error('O convite está incompleto. Reenvie o acesso pela conta administradora.')
  }

  const now = new Date().toISOString()
  const profile = {
    mapValue: {
      fields: {
        id: { stringValue: identity.userId },
        name: { stringValue: profileFields?.name?.stringValue || identity.email.split('@')[0] },
        email: { stringValue: identity.email },
        role: { stringValue: role },
        permissions: { arrayValue: { values: permissions.map((permission) => ({ stringValue: permission })) } },
        mustChangePassword: { booleanValue: true },
        active: { booleanValue: true },
        createdAt: { stringValue: now },
        updatedAt: { stringValue: now },
      },
    },
  }
  const commitResponse = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:commit`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/memberships/${identity.userId}`,
              fields: {
                workspaceId: { stringValue: workspaceId },
                email: { stringValue: identity.email },
                active: { booleanValue: true },
                mustChangePassword: { booleanValue: true },
                createdAt: { stringValue: now },
                updatedAt: { timestampValue: now },
              },
            },
          },
          {
            update: {
              name: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/workspaces/${workspaceId}/collections/users/items/${identity.userId}`,
              fields: {
                value: profile,
                position: { integerValue: '0' },
                updatedAt: { timestampValue: now },
              },
            },
          },
          {
            update: {
              name: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/workspaceInvitations/${identity.email}`,
              fields: {
                active: { booleanValue: false },
                claimedAt: { stringValue: now },
                claimedBy: { stringValue: identity.userId },
                updatedAt: { timestampValue: now },
              },
            },
            updateMask: { fieldPaths: ['active', 'claimedAt', 'claimedBy', 'updatedAt'] },
          },
        ],
      }),
    },
  )
  const commitBody = await commitResponse.json() as { error?: { message?: string } }
  if (!commitResponse.ok) throw new Error(commitBody.error?.message || 'Não foi possível ativar o acesso.')
  return true
}

type D1UserProfile = {
  id?: string
  name?: string
  email?: string
  role?: string
  permissions?: string[]
  invitationPending?: boolean
  active?: boolean
  mustChangePassword?: boolean
  [key: string]: unknown
}

const allFlyFlowPermissions = [
  'viewDashboard',
  'manageLeads',
  'manageClients',
  'manageProjects',
  'manageAgenda',
  'manageQuotes',
  'manageFinance',
  'manageEquipment',
  'viewReports',
  'manageSettings',
  'manageUsers',
]

const businessRecordCount = (state: Record<string, unknown>) => [
  'leads',
  'clients',
  'projects',
  'appointments',
  'quotes',
  'payments',
  'expenses',
  'recurringExpenses',
  'bankAccounts',
  'equipment',
  'tasks',
  'internalProjects',
].reduce((total, key) => total + (Array.isArray(state[key]) ? state[key].length : 0), 0)

const STATE_CHUNK_SIZE = 200_000

const readWorkspaceState = async (env: Env, workspaceId: string, fallbackJson = '{}') => {
  const chunks = await env.FLYFLOW_DB.prepare(
    'SELECT chunk_text FROM workspace_state_chunks WHERE workspace_id = ? ORDER BY chunk_index',
  ).bind(workspaceId).all<{ chunk_text: string }>()
  const serialized = chunks.results.length
    ? chunks.results.map((chunk) => chunk.chunk_text).join('')
    : fallbackJson
  return JSON.parse(serialized) as Record<string, unknown>
}

const writeWorkspaceState = async (env: Env, workspaceId: string, stateJson: string, updatedAt: string) => {
  const chunks: string[] = []
  for (let index = 0; index < stateJson.length; index += STATE_CHUNK_SIZE) {
    chunks.push(stateJson.slice(index, index + STATE_CHUNK_SIZE))
  }
  await env.FLYFLOW_DB.batch([
    env.FLYFLOW_DB.prepare('DELETE FROM workspace_state_chunks WHERE workspace_id = ?').bind(workspaceId),
    ...chunks.map((chunk, index) => env.FLYFLOW_DB.prepare(
      'INSERT INTO workspace_state_chunks (workspace_id, chunk_index, chunk_text) VALUES (?, ?, ?)',
    ).bind(workspaceId, index, chunk)),
    env.FLYFLOW_DB.prepare(
      "UPDATE workspaces SET state_json = '{}', updated_at = ? WHERE workspace_id = ?",
    ).bind(updatedAt, workspaceId),
  ])
}

const bootstrapD1Workspace = async (
  env: Env,
  identity: { userId: string; email: string },
  state: Record<string, unknown>,
) => {
  const users = Array.isArray(state.users) ? state.users as D1UserProfile[] : []
  const owner = users.find((user) => String(user.email || '').toLowerCase() === 'herodronecwb@gmail.com')
  if (!owner) throw new Error('A cópia local não contém a conta proprietária.')
  if (identity.email !== 'herodronecwb@gmail.com') {
    const existingWorkspace = await env.FLYFLOW_DB.prepare('SELECT workspace_id FROM workspaces LIMIT 1').first()
    if (existingWorkspace) throw new Error('Este usuário ainda não possui acesso ao workspace migrado.')
    const existingUser = users.find((user) => String(user.email || '').trim().toLowerCase() === identity.email)
    if (!existingUser) {
      users.unshift({
        id: identity.userId,
        name: identity.email.split('@')[0],
        email: identity.email,
        role: 'Administrador',
        permissions: allFlyFlowPermissions,
        active: true,
        invitationPending: true,
        mustChangePassword: true,
      })
      state.users = users
    } else {
      existingUser.active = true
      existingUser.invitationPending = true
      existingUser.mustChangePassword = true
    }
  }
  const workspaceId = String(owner.id || identity.userId)
  const ownerUserId = identity.email === 'herodronecwb@gmail.com' ? identity.userId : workspaceId
  const now = new Date().toISOString()
  const stateJson = JSON.stringify(state)
  if (new TextEncoder().encode(stateJson).byteLength > 20_000_000) {
    throw new Error('O estado excede o limite seguro de migração.')
  }
  const existingWorkspace = await env.FLYFLOW_DB.prepare(
    'SELECT state_json FROM workspaces WHERE workspace_id = ?',
  ).bind(workspaceId).first<{ state_json: string }>()
  const existingState = existingWorkspace
    ? await readWorkspaceState(env, workspaceId, existingWorkspace.state_json)
    : null
  const shouldRepairEmptyWorkspace = identity.email === 'herodronecwb@gmail.com'
    && existingWorkspace
    && existingState
    && businessRecordCount(existingState) === 0
    && businessRecordCount(state) > 0
  const workspaceStatement = shouldRepairEmptyWorkspace
    ? env.FLYFLOW_DB.prepare(
      'UPDATE workspaces SET owner_uid = ?, state_json = ?, updated_at = ? WHERE workspace_id = ?',
    ).bind(ownerUserId, '{}', now, workspaceId)
    : env.FLYFLOW_DB.prepare(`
      INSERT INTO workspaces (workspace_id, owner_uid, state_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO NOTHING
    `).bind(workspaceId, ownerUserId, '{}', now)
  const statements = [
    workspaceStatement,
    env.FLYFLOW_DB.prepare(`
      INSERT INTO memberships (user_id, workspace_id, email, profile_json, active, must_change_password, updated_at)
      VALUES (?, ?, ?, ?, 1, 0, ?)
      ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, active = 1, updated_at = excluded.updated_at
    `).bind(ownerUserId, workspaceId, 'herodronecwb@gmail.com', JSON.stringify({ ...owner, id: ownerUserId, active: true }), now),
  ]
  users
    .filter((user) => user.invitationPending && user.email)
    .forEach((user) => {
      const email = String(user.email).trim().toLowerCase()
      statements.push(env.FLYFLOW_DB.prepare(`
        INSERT INTO invitations (email, workspace_id, profile_json, active, updated_at)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(email) DO UPDATE SET profile_json = excluded.profile_json, active = 1, updated_at = excluded.updated_at
      `).bind(email, workspaceId, JSON.stringify(user), now))
    })
  users
    .filter((user) => user.active && !user.invitationPending && user.email && user.id && user.email.toLowerCase() !== identity.email)
    .forEach((user) => {
      const email = String(user.email).trim().toLowerCase()
      statements.push(env.FLYFLOW_DB.prepare(`
        INSERT INTO memberships (user_id, workspace_id, email, profile_json, active, must_change_password, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          email = excluded.email,
          profile_json = excluded.profile_json,
          active = 1,
          must_change_password = excluded.must_change_password,
          updated_at = excluded.updated_at
      `).bind(
        String(user.id),
        workspaceId,
        email,
        JSON.stringify(user),
        user.mustChangePassword ? 1 : 0,
        now,
      ))
    })
  await env.FLYFLOW_DB.batch(statements)
  if (!existingWorkspace || shouldRepairEmptyWorkspace) {
    await writeWorkspaceState(env, workspaceId, stateJson, now)
  }
  return workspaceId
}

const claimD1Invitation = async (env: Env, identity: { userId: string; email: string }) => {
  const existing = await env.FLYFLOW_DB.prepare(
    'SELECT workspace_id, profile_json, active, must_change_password FROM memberships WHERE user_id = ? OR email = ? LIMIT 1',
  ).bind(identity.userId, identity.email).first<{
    workspace_id: string
    profile_json: string
    active: number
    must_change_password: number
  }>()
  if (existing?.active) {
    if (!existing.profile_json) return null
    const profile = JSON.parse(existing.profile_json) as D1UserProfile
    if (profile.id !== identity.userId) {
      profile.id = identity.userId
      await env.FLYFLOW_DB.prepare(
        'UPDATE memberships SET user_id = ?, profile_json = ?, updated_at = ? WHERE email = ?',
      ).bind(identity.userId, JSON.stringify(profile), new Date().toISOString(), identity.email).run()
    }
    return { workspaceId: existing.workspace_id, profile, mustChangePassword: Boolean(existing.must_change_password) }
  }
  const invitation = await env.FLYFLOW_DB.prepare(
    'SELECT workspace_id, profile_json FROM invitations WHERE email = ? AND active = 1',
  ).bind(identity.email).first<{ workspace_id: string; profile_json: string }>()
  if (!invitation) return null
  const now = new Date().toISOString()
  const profile = {
    ...(JSON.parse(invitation.profile_json) as D1UserProfile),
    id: identity.userId,
    email: identity.email,
    invitationPending: false,
    active: true,
    mustChangePassword: true,
    updatedAt: now,
  }
  await env.FLYFLOW_DB.batch([
    env.FLYFLOW_DB.prepare(`
      INSERT INTO memberships (user_id, workspace_id, email, profile_json, active, must_change_password, updated_at)
      VALUES (?, ?, ?, ?, 1, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, active = 1, must_change_password = 1, updated_at = excluded.updated_at
    `).bind(identity.userId, invitation.workspace_id, identity.email, JSON.stringify(profile), now),
    env.FLYFLOW_DB.prepare('UPDATE invitations SET active = 0, updated_at = ? WHERE email = ?').bind(now, identity.email),
  ])
  return { workspaceId: invitation.workspace_id, profile, mustChangePassword: true }
}

const loadD1Workspace = async (env: Env, identity: { userId: string; email: string }) => {
  const access = await claimD1Invitation(env, identity)
  if (!access) return null
  const workspace = await env.FLYFLOW_DB.prepare(
    'SELECT state_json, updated_at FROM workspaces WHERE workspace_id = ?',
  ).bind(access.workspaceId).first<{ state_json: string; updated_at: string }>()
  if (!workspace) return null
  const state = await readWorkspaceState(env, access.workspaceId, workspace.state_json)
  const users = Array.isArray(state.users) ? state.users as D1UserProfile[] : []
  const membershipRows = await env.FLYFLOW_DB.prepare(
    'SELECT profile_json FROM memberships WHERE workspace_id = ? AND active = 1',
  ).bind(access.workspaceId).all<{ profile_json: string }>()
  const membershipProfiles = membershipRows.results
    .map((row) => {
      try {
        return JSON.parse(row.profile_json) as D1UserProfile
      } catch {
        return null
      }
    })
    .filter((profile): profile is D1UserProfile => Boolean(profile?.email))
  const profileEmails = new Set(membershipProfiles.map((profile) => String(profile.email).toLowerCase()))
  state.users = [
    ...membershipProfiles,
    ...users.filter((user) => !profileEmails.has(String(user.email || '').toLowerCase())),
  ]
  return { state, profile: access.profile, mustChangePassword: access.mustChangePassword, updatedAt: workspace.updated_at }
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
    if (request.method === 'POST' && url.pathname === '/admin/temporary-password') {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      if (identity.email !== 'herodronecwb@gmail.com') {
        return json({ error: 'Apenas a conta administradora principal pode alterar senhas.' }, 403, origin)
      }
      const body = await request.json().catch(() => null) as { email?: string; password?: string } | null
      const email = clean(body?.email, 160).toLowerCase()
      const password = String(body?.password || '')
      if (!email || !/^\d{6,12}$/.test(password)) {
        return json({ error: 'Use uma senha temporária de 6 a 12 números.' }, 400, origin)
      }
      if (email === identity.email) return json({ error: 'Altere sua própria senha em Minha conta.' }, 400, origin)
      try {
        await updateFirebaseTemporaryPassword(env, email, password)
        return json({ updated: true }, 200, origin)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Não foi possível alterar a senha.' }, 400, origin)
      }
    }
    if (request.method === 'POST' && url.pathname === '/auth/claim-invitation') {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity?.email) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      try {
        const d1Access = await claimD1Invitation(env, identity)
        if (d1Access) return json({ claimed: true, source: 'cloudflare' }, 200, origin)
        const claimed = await claimFirebaseInvitation(env, identity)
        return json({ claimed }, 200, origin)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Não foi possível ativar o acesso.' }, 400, origin)
      }
    }
    if (request.method === 'POST' && url.pathname === '/auth/complete-first-login') {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity?.email) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      const membership = await env.FLYFLOW_DB.prepare(
        'SELECT profile_json FROM memberships WHERE user_id = ? AND active = 1',
      ).bind(identity.userId).first<{ profile_json: string }>()
      if (!membership) return json({ error: 'Perfil não encontrado no Cloudflare.' }, 404, origin)
      const profile = { ...(JSON.parse(membership.profile_json) as D1UserProfile), mustChangePassword: false, passwordChangedAt: new Date().toISOString() }
      await env.FLYFLOW_DB.prepare(
        'UPDATE memberships SET profile_json = ?, must_change_password = 0, updated_at = ? WHERE user_id = ?',
      ).bind(JSON.stringify(profile), new Date().toISOString(), identity.userId).run()
      return json({ completed: true }, 200, origin)
    }
    if (request.method === 'POST' && url.pathname === '/data/bootstrap') {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity?.email) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      const body = await request.json().catch(() => null) as { state?: Record<string, unknown> } | null
      if (!body?.state) return json({ error: 'Estado do sistema não informado.' }, 400, origin)
      try {
        const workspaceId = await bootstrapD1Workspace(env, identity, body.state)
        return json({ migrated: true, workspaceId }, 200, origin)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Não foi possível migrar os dados.' }, 400, origin)
      }
    }
    if (request.method === 'GET' && url.pathname === '/data/state') {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity?.email) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      try {
        const workspace = await loadD1Workspace(env, identity)
        return workspace ? json(workspace, 200, origin) : json({ error: 'Workspace ainda não migrado.' }, 404, origin)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Não foi possível carregar o workspace.' }, 400, origin)
      }
    }
    if (request.method === 'POST' && url.pathname === '/data/state') {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity?.email) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      const body = await request.json().catch(() => null) as {
        state?: Record<string, unknown>
        expectedUpdatedAt?: string
      } | null
      if (!body?.state) return json({ error: 'Estado do sistema não informado.' }, 400, origin)
      try {
        const access = await claimD1Invitation(env, identity)
        if (!access) return json({ error: 'Usuário sem workspace no Cloudflare.' }, 403, origin)
        const currentWorkspace = await env.FLYFLOW_DB.prepare(
          'SELECT updated_at FROM workspaces WHERE workspace_id = ?',
        ).bind(access.workspaceId).first<{ updated_at: string }>()
        if (!body.expectedUpdatedAt || body.expectedUpdatedAt !== currentWorkspace?.updated_at) {
          return json({
            error: 'Os dados foram atualizados em outra sessão. Recarregue a página antes de salvar.',
          }, 409, origin)
        }
        const stateJson = JSON.stringify(body.state)
        if (new TextEncoder().encode(stateJson).byteLength > 20_000_000) {
          return json({ error: 'Os dados excedem o limite seguro de sincronização.' }, 413, origin)
        }
        const updatedAt = new Date().toISOString()
        await writeWorkspaceState(env, access.workspaceId, stateJson, updatedAt)
        const users = Array.isArray(body.state.users) ? body.state.users as D1UserProfile[] : []
        const now = new Date().toISOString()
        const profileStatements = users
          .filter((user) => user.email)
          .map((user) => {
            const email = String(user.email).trim().toLowerCase()
            if (user.invitationPending) {
              return env.FLYFLOW_DB.prepare(`
                INSERT INTO invitations (email, workspace_id, profile_json, active, updated_at)
                VALUES (?, ?, ?, 1, ?)
                ON CONFLICT(email) DO UPDATE SET
                  workspace_id = excluded.workspace_id,
                  profile_json = excluded.profile_json,
                  active = 1,
                  updated_at = excluded.updated_at
              `).bind(email, access.workspaceId, JSON.stringify(user), now)
            }
            return env.FLYFLOW_DB.prepare(`
              UPDATE memberships
              SET profile_json = ?, active = ?, updated_at = ?
              WHERE workspace_id = ? AND email = ?
            `).bind(JSON.stringify(user), user.active === false ? 0 : 1, now, access.workspaceId, email)
          })
        if (profileStatements.length) await env.FLYFLOW_DB.batch(profileStatements)
        return json({ saved: true, updatedAt }, 200, origin)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Não foi possível salvar no Cloudflare.' }, 400, origin)
      }
    }
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
      const limit = Math.max(10, Math.min(Number(body?.limit) || 10, 20))
      const candidatePoolTarget = Math.min(40, Math.max(limit * 2, 20))
      if (!cities.length || !categories.length) return json({ error: 'Informe cidade e categoria.' }, 400, origin)
      const leads: Array<Record<string, unknown>> = []
      const discoveredKeys = new Set<string>()
      const categoryCounts = new Map<string, number>()
      const warnings: string[] = []
      if (userId && env.GOOGLE_PLACES_API_KEY) {
        let googlePlacesQuotaBlocked = false
        for (const category of categories) {
          for (const city of cities) {
            if (googlePlacesQuotaBlocked) break
            if (leads.length >= candidatePoolTarget) break
            if ((categoryCounts.get(category) || 0) >= 12) break
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
                if (leads.length >= candidatePoolTarget) break
                if ((categoryCounts.get(category) || 0) >= 12) break
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'indisponível'
              warnings.push(`Google Places (${category}, ${city}): ${message}`)
              // Não repita dezenas de chamadas quando o próprio provedor já
              // informou que a cota do projeto acabou. A busca web e o Google
              // Maps do navegador continuam como fontes alternativas.
              if (/quota|429|resource_exhausted/i.test(message)) googlePlacesQuotaBlocked = true
            }
          }
          if (googlePlacesQuotaBlocked) break
          if (leads.length >= candidatePoolTarget) break
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
          const contactableLeads = leads
            .filter((lead) => Boolean(
              String(lead.whatsapp || '').trim() ||
              String(lead.phone || '').trim() ||
              String(lead.email || '').trim() ||
              String(lead.instagram || '').trim(),
            ))
            .sort((a, b) =>
              Number(Boolean(b.googleMapsUrl)) - Number(Boolean(a.googleMapsUrl)) ||
              Number(Boolean(b.whatsapp)) - Number(Boolean(a.whatsapp)) ||
              Number(b.score || 0) - Number(a.score || 0),
            )
            .slice(0, limit)
          if (contactableLeads.length) {
            return json({
              leads: contactableLeads,
              sources: ['Google Places API (perfil oficial)'],
              warnings: [
                ...warnings,
                ...(contactableLeads.length < 10
                  ? [`Somente ${contactableLeads.length} empresas com contato público verificável foram localizadas nesta rodada.`]
                  : []),
              ],
            }, 200, origin)
          }
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
