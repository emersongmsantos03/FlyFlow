import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose'
import { handleDataApiRequest } from './dataApi'
import { handleIntegrationRequest, handleMetricsRequest } from './metrics'
import { handleRedirect, handleSiteEvent } from './tracking'

interface Env {
  FIREBASE_PROJECT_ID: string
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
  GOOGLE_OAUTH: KVNamespace
  FLYFLOW_DB: D1Database
  IP_HASH_SALT?: string
}

const allowedOrigins = new Set([
  'https://flyflow.herodrone.com.br',
  'https://flyflow-a97ab.web.app',
  'https://flyflow-a97ab.firebaseapp.com',
  'https://emersongmsantos03.github.io',
  'http://localhost:5173',
])

const clean = (value: unknown, max = 300) => [...String(value || '')]
  .map((character) => character.charCodeAt(0) < 32 || character === '<' || character === '>' ? ' ' : character)
  .join('').replace(/\s+/g, ' ').trim().slice(0, max)

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
  let localId = lookupBody.users?.[0]?.localId

  // Se a conta de e-mail ainda não tiver sido registrada no Firebase Auth, crie-a via Admin API do Cloudflare Worker
  if (!localId) {
    const signup = await fetch(`${baseUrl}/accounts:signUp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    })
    const signupBody = await signup.json() as { localId?: string; error?: { message?: string } }
    if (!signup.ok || !signupBody.localId) {
      throw new Error(signupBody.error?.message || 'Não foi possível criar a conta no Firebase.')
    }
    localId = signupBody.localId
  } else {
    const update = await fetch(`${baseUrl}/accounts:update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId, password }),
    })
    const updateBody = await update.json() as { error?: { message?: string } }
    if (!update.ok) throw new Error(updateBody.error?.message || 'O Firebase recusou a nova senha.')
  }
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
      ON CONFLICT(email) DO UPDATE SET user_id = excluded.user_id, profile_json = excluded.profile_json, active = 1, updated_at = excluded.updated_at
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
        ON CONFLICT(email) DO UPDATE SET
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
      ON CONFLICT(email) DO UPDATE SET user_id = excluded.user_id, profile_json = excluded.profile_json, active = 1, must_change_password = 1, updated_at = excluded.updated_at
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
    .map((membershipProfile) => {
      const storedProfile = users.find(
        (user) => String(user.email || '').toLowerCase() === String(membershipProfile.email || '').toLowerCase(),
      )
      return storedProfile
        ? {
          ...membershipProfile,
          ...storedProfile,
          id: membershipProfile.id,
          invitationPending: false,
          active: true,
          mustChangePassword: membershipProfile.mustChangePassword,
        }
        : membershipProfile
    })
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const url = new URL(request.url)
    // Rotas públicas: têm política de origem própria e vêm antes da validação do app.
    const redirectMatch = url.pathname.match(/^\/r\/([A-Za-z0-9]{4,32})$/)
    if (redirectMatch && (request.method === 'GET' || request.method === 'HEAD')) return handleRedirect(redirectMatch[1], request, env)
    if (url.pathname === '/t/event') return handleSiteEvent(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'flyflow-api' }, 200, origin)
    if (request.method === 'GET' && url.pathname === '/internal/status') {
      return json({
        ok: true,
        hasServiceAccount: Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON),
        hasD1: Boolean(env.FLYFLOW_DB),
        firebaseProjectId: Boolean(env.FIREBASE_PROJECT_ID),
      }, 200, origin)
    }
    const signatureImageMatch = url.pathname.match(/^\/google\/signature\/image\/([a-f0-9-]{36})$/)
    if (request.method === 'GET' && signatureImageMatch) {
      const signature = await env.GOOGLE_OAUTH.get(`signature:${signatureImageMatch[1]}`)
      return signature ? signatureResponse(signature, origin) : json({ error: 'Assinatura não encontrada.' }, 404, origin)
    }
    if (origin && !allowedOrigins.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin)

    const authorization = request.headers.get('Authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (url.pathname.startsWith('/integrations/data/')) {
      return handleDataApiRequest(request, url, env, token, {
        read: (workspaceId, fallbackJson) => readWorkspaceState(env, workspaceId, fallbackJson),
        write: (workspaceId, stateJson, updatedAt) => writeWorkspaceState(env, workspaceId, stateJson, updatedAt),
      }, (body, status) => json(body, status, origin))
    }
    if (url.pathname.startsWith('/integrations/') && !url.pathname.startsWith('/integrations/tokens')) {
      return handleIntegrationRequest(request, url, env, token, origin)
    }
    if (url.pathname === '/metrics' || url.pathname.startsWith('/metrics/') || url.pathname.startsWith('/integrations/') || url.pathname.startsWith('/crm/events/')) {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity?.email) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      const access = await claimD1Invitation(env, identity)
      if (!access) return json({ error: 'Usuário sem workspace no Cloudflare.' }, 403, origin)
      return handleMetricsRequest(request, url, env, {
        workspaceId: access.workspaceId,
        userId: identity.userId,
        canManage: identity.email === 'herodronecwb@gmail.com' || Boolean(access.profile.permissions?.includes('manageSettings')),
      }, origin)
    }
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
    if (request.method === 'POST' && url.pathname === '/data/records') {
      const identity = token ? await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID) : null
      if (!identity?.email) return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
      const body = await request.json().catch(() => null) as {
        expectedUpdatedAt?: string
        mutation?: {
          upserts?: Record<string, Array<Record<string, unknown>>>
          deletes?: Record<string, string[]>
          dismissedTaskSourceKeys?: string[]
        }
      } | null
      if (!body?.mutation) return json({ error: 'Alteração não informada.' }, 400, origin)
      try {
        const access = await claimD1Invitation(env, identity)
        if (!access) return json({ error: 'Usuário sem workspace no Cloudflare.' }, 403, origin)
        const workspace = await env.FLYFLOW_DB.prepare(
          'SELECT state_json, updated_at FROM workspaces WHERE workspace_id = ?',
        ).bind(access.workspaceId).first<{ state_json: string; updated_at: string }>()
        if (!workspace) return json({ error: 'Workspace não encontrado.' }, 404, origin)
        if (!body.expectedUpdatedAt || body.expectedUpdatedAt !== workspace.updated_at) {
          return json({ error: 'Os dados foram atualizados em outra sessão. Recarregue a página antes de salvar.' }, 409, origin)
        }
        const state = await readWorkspaceState(env, access.workspaceId, workspace.state_json)
        const allowedUpserts = new Set(['tasks', 'appointments', 'leads', 'statusHistory', 'leadInteractions', 'clients', 'notifications'])
        const allowedDeletes = new Set(['tasks', 'appointments'])
        for (const [section, records] of Object.entries(body.mutation.upserts || {})) {
          if (!allowedUpserts.has(section) || !Array.isArray(records)) continue
          const current = Array.isArray(state[section]) ? state[section] as Array<Record<string, unknown>> : []
          const byId = new Map(current.map((record) => [String(record.id || ''), record]))
          records.forEach((record) => { if (record?.id) byId.set(String(record.id), record) })
          state[section] = section === 'statusHistory' ? [...records, ...current.filter((record) => !records.some((item) => item.id === record.id))] : [...byId.values()]
        }
        for (const [section, ids] of Object.entries(body.mutation.deletes || {})) {
          if (!allowedDeletes.has(section) || !Array.isArray(ids)) continue
          const deleted = new Set(ids.map(String))
          const current = Array.isArray(state[section]) ? state[section] as Array<Record<string, unknown>> : []
          state[section] = current.filter((record) => !deleted.has(String(record.id || '')))
        }
        if (Array.isArray(body.mutation.dismissedTaskSourceKeys)) {
          const previous = Array.isArray(state.dismissedTaskSourceKeys) ? state.dismissedTaskSourceKeys as string[] : []
          state.dismissedTaskSourceKeys = [...new Set([...previous, ...body.mutation.dismissedTaskSourceKeys.map(String)])]
        }
        const updatedAt = new Date().toISOString()
        state.updatedAt = updatedAt
        await writeWorkspaceState(env, access.workspaceId, JSON.stringify(state), updatedAt)
        return json({ saved: true, updatedAt }, 200, origin)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Não foi possível alterar os registros.' }, 400, origin)
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
        const canManageUsers = identity.email === 'herodronecwb@gmail.com' || Boolean(access.profile.permissions?.includes('manageUsers'))
        if (!canManageUsers) {
          // O snapshot vem inteiro do navegador: sem esta trava, qualquer membro
          // poderia se dar permissões ou reativar contas editando `users`.
          const storedState = await readWorkspaceState(env, access.workspaceId)
          const storedUsers = Array.isArray(storedState.users) ? storedState.users as D1UserProfile[] : []
          const incomingUsers = Array.isArray(body.state.users) ? body.state.users as D1UserProfile[] : []
          const ownProfile = incomingUsers.find((user) => String(user.email || '').toLowerCase() === identity.email)
          body.state.users = storedUsers.map((user) =>
            String(user.email || '').toLowerCase() === identity.email && ownProfile
              ? { ...ownProfile, role: user.role, permissions: user.permissions, active: user.active, isPrimaryOwner: user.isPrimaryOwner }
              : user)
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
    if (!userId) {
      return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
    }

    if (url.pathname.startsWith('/google/')) {
      try {
        // The shared workspace now lives in D1. Keep the former Firestore key as
        // a migration source so existing Google connections remain authorized.
        const googleIdentity = await verifyFirebaseIdentity(token, env.FIREBASE_PROJECT_ID)
        const d1Access = googleIdentity ? await claimD1Invitation(env, googleIdentity) : null
        const legacyWorkspaceId = await workspaceForUser(token, userId, env.FIREBASE_PROJECT_ID).catch(() => '')
        const workspaceId = d1Access?.workspaceId || legacyWorkspaceId
        if (!workspaceId) throw new Error('Usuário sem workspace ativo para conectar ao Google.')
        const key = `workspace:${workspaceId}`
        const signatureKey = `workspace:${workspaceId}:signature`
        const legacyKey = legacyWorkspaceId && legacyWorkspaceId !== workspaceId ? `workspace:${legacyWorkspaceId}` : ''
        const legacySignatureKey = legacyKey ? `${legacyKey}:signature` : ''
        let stored = await env.GOOGLE_OAUTH.get(key, 'json') as { refreshToken?: string; email?: string; connectedAt?: string } | null
        if (!stored?.refreshToken && legacyKey) {
          const legacyStored = await env.GOOGLE_OAUTH.get(legacyKey, 'json') as typeof stored
          if (legacyStored?.refreshToken) {
            stored = legacyStored
            await env.GOOGLE_OAUTH.put(key, JSON.stringify(legacyStored))
          }
        }
        if (legacySignatureKey && !await env.GOOGLE_OAUTH.get(signatureKey)) {
          const legacySignatureToken = await env.GOOGLE_OAUTH.get(legacySignatureKey)
          if (legacySignatureToken) await env.GOOGLE_OAUTH.put(signatureKey, legacySignatureToken)
        }

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

    return json({ error: 'Rota não encontrada.' }, 404, origin)
  },
}
