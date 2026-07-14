import { isSupabaseConfigured, supabase } from './supabase'

export interface GoogleCalendarEventInput {
  externalEventId?: string
  title: string
  description: string
  startAt: string
  endAt: string
  location: string
  timeZone: string
}

export const syncGoogleCalendarEvent = async (event: GoogleCalendarEventInput) => {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.functions.invoke('google-calendar', { body: event })
  if (error) throw error
  return data as { externalEventId: string; calendarUrl: string }
}

