import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Não autorizado.' }, 401)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    )
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Sessão inválida.' }, 401)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')
    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary'
    if (!clientId || !clientSecret || !refreshToken) return json({ error: 'OAuth do Google Calendar não configurado.' }, 503)

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    if (!tokenResponse.ok) return json({ error: 'Não foi possível renovar o acesso ao Google.' }, 502)
    const token = await tokenResponse.json() as { access_token: string }
    const input = await request.json() as {
      externalEventId?: string
      title: string
      description: string
      startAt: string
      endAt: string
      location: string
      timeZone?: string
    }
    if (!input.title || !input.startAt || !input.endAt) return json({ error: 'Evento incompleto.' }, 400)

    const event = {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: { dateTime: input.startAt, timeZone: input.timeZone || 'America/Sao_Paulo' },
      end: { dateTime: input.endAt, timeZone: input.timeZone || 'America/Sao_Paulo' },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 }, { method: 'popup', minutes: 60 }] },
    }
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    const url = input.externalEventId ? `${base}/${encodeURIComponent(input.externalEventId)}` : base
    const googleResponse = await fetch(url, {
      method: input.externalEventId ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    const googleEvent = await googleResponse.json() as { id?: string; htmlLink?: string; error?: unknown }
    if (!googleResponse.ok || !googleEvent.id) return json({ error: 'Falha ao sincronizar evento.', details: googleEvent.error }, 502)
    return json({ externalEventId: googleEvent.id, calendarUrl: googleEvent.htmlLink })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})

