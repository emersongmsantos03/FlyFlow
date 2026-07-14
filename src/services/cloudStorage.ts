import type { AppState } from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

export const loadCloudAppState = async (): Promise<AppState | null> => {
  if (!isSupabaseConfigured || !supabase) return null
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return null
  const { data, error } = await supabase
    .from('app_state_snapshots')
    .select('state')
    .eq('owner_user_id', authData.user.id)
    .maybeSingle()
  if (error) throw error
  return (data?.state as AppState | undefined) ?? null
}

export const saveCloudAppState = async (state: AppState) => {
  if (!isSupabaseConfigured || !supabase) return
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return
  const { error } = await supabase.from('app_state_snapshots').upsert({
    owner_user_id: authData.user.id,
    state,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

