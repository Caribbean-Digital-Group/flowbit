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

interface LoginCredentials {
  email: string
  password: string
}

interface AuthResult {
  success: boolean
  error: string | null
}

export const useSupabaseAuth = () => {
  const supabase = useSupabase()
  const authStore = useAuthStore()

  const isInvalidCredentialsError = (error: { code?: string; message?: string } | null): boolean => {
    if (!error) return false
    if (error.code === 'invalid_credentials') return true
    return /invalid login credentials/i.test(error.message || '')
  }

  const isUserAlreadyRegisteredError = (error: { code?: string; message?: string } | null): boolean => {
    if (!error) return false
    if (error.code === 'user_already_exists') return true
    return /user already registered|already exists/i.test(error.message || '')
  }

  const signIn = async (credentials: LoginCredentials): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })

    if (error) {
      console.error('Error signing in:', error)
      return { success: false, error: error.message }
    }

    if (data.session) {
      await authStore.setSession(data.session)
    }

    return { success: true, error: null }
  }

  const signUp = async (credentials: LoginCredentials): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    })

    if (error) {
      console.error('Error signing up:', error)
      return { success: false, error: error.message }
    }

    if (data.user && !data.session) {
      return { success: false, error: 'Se envió un correo de confirmación. Revisa tu bandeja de entrada.' }
    }

    if (data.session) {
      await authStore.setSession(data.session)
    }

    return { success: true, error: null }
  }

  const signInOrSignUp = async (credentials: LoginCredentials): Promise<AuthResult> => {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })

    if (!signInError) {
      if (signInData.session) {
        await authStore.setSession(signInData.session)
      }
      return { success: true, error: null }
    }

    if (!isInvalidCredentialsError(signInError)) {
      console.error('Error signing in:', signInError)
      return { success: false, error: signInError.message }
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    })

    if (signUpError) {
      if (isUserAlreadyRegisteredError(signUpError)) {
        return { success: false, error: 'La contraseña es incorrecta. Verifica tus credenciales.' }
      }
      console.error('Error signing up:', signUpError)
      return { success: false, error: signUpError.message }
    }

    if (signUpData.user && !signUpData.session) {
      return { success: false, error: 'Se envió un correo de confirmación. Revisa tu bandeja de entrada.' }
    }

    if (signUpData.session) {
      await authStore.setSession(signUpData.session)
    }

    return { success: true, error: null }
  }

  const signOut = async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Error signing out:', error)
      return { success: false, error: error.message }
    }

    authStore.clearSession()

    return { success: true, error: null }
  }

  return { signIn, signUp, signInOrSignUp, signOut }
}
