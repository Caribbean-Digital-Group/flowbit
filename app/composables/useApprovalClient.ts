import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApprovalDatabase } from '~/types/approval.types'

type DbError = { message: string; code?: string }

/**
 * Base común de los composables de Aprobaciones: cliente tipado con el shim
 * `ApprovalDatabase`, último error traducido y llamada tipada a RPCs del motor.
 */
export const useApprovalClient = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<ApprovalDatabase>
  const lastError = ref<string | null>(null)

  const fail = (context: string, error: DbError): null => {
    console.error(`Error ${context}:`, error)
    lastError.value = approvalErrorMessage(error)
    return null
  }

  /** Llama un RPC y devuelve `null` (con `lastError`) si falla. */
  const rpc = async <T>(fn: string, args: Record<string, unknown>, context: string): Promise<T | null> => {
    lastError.value = null
    const { data, error } = await supabase.rpc(fn as never, args as never) as unknown as {
      data: T | null
      error: DbError | null
    }
    if (error) return fail(context, error)
    return data
  }

  const userId = async (): Promise<string | null> => (await useSupabaseUser())?.id ?? null

  return { supabase, lastError, fail, rpc, userId }
}
