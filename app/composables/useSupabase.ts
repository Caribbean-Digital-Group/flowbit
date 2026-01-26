import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

let supabaseClient: SupabaseClient<Database> | null = null

export const useSupabase = () => {
  const config = useRuntimeConfig()

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      config.public.supabaseUrl as string,
      config.public.supabasePublishableKey as string
    )
  }

  return supabaseClient
}

// Get the current authenticated user
export const useSupabaseUser = async () => {
  const supabase = useSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('Error getting user:', error)
    return null
  }
  
  return user
}

// Get the current session
export const useSupabaseSession = async () => {
  const supabase = useSupabase()
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error getting session:', error)
    return null
  }
  
  return session
}
