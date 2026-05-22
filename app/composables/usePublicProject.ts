import type { Database } from '~/types/database.types'

type ProjectStatus = Database['public']['Enums']['project_status']
type ProjectPriority = Database['public']['Enums']['project_priority']
type ProjectTaskStatus = Database['public']['Enums']['project_task_status']

export interface PublicProjectInfo {
  id: string
  code: string | null
  name: string
  description: string | null
  status: ProjectStatus
  priority: ProjectPriority
  start_date: string | null
  end_date_estimated: string | null
  end_date_actual: string | null
  progress: number
  color: string | null
  project_type_name: string | null
  project_type_color: string | null
  responsible_name: string | null
  company_name: string | null
  is_overdue: boolean
  updated_at: string | null
}

export interface PublicProjectTask {
  id: string
  code: string | null
  name: string
  description: string | null
  status: ProjectTaskStatus
  priority: ProjectPriority
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  progress: number
  order_index: number
  responsible_name: string | null
  is_overdue: boolean
}

export interface PublicProjectSummary {
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  pending_tasks: number
  overdue_tasks: number
}

export type PublicProjectResult =
  | { status: 'public'; project: PublicProjectInfo; summary: PublicProjectSummary; tasks: PublicProjectTask[] }
  | { status: 'private' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

/**
 * Acceso de solo lectura al RPC `get_public_project_view`.
 * El RPC sólo devuelve datos cuando el proyecto está marcado como público
 * y nunca expone información financiera o contable.
 */
export const usePublicProject = () => {
  const supabase = useSupabase()

  const getPublicProject = async (projectId: string): Promise<PublicProjectResult> => {
    if (!projectId) {
      return { status: 'not_found' }
    }

    // El tipo generado de Supabase aún no conoce este RPC (recién creado en
    // la migración). Se hace cast a `never` para evitar el error de tipos
    // y se valida el shape de la respuesta en runtime.
    const { data, error } = await supabase.rpc(
      'get_public_project_view' as never,
      { p_project_id: projectId } as never
    )

    if (error) {
      console.error('Error fetching public project:', error)
      return { status: 'error', message: error.message }
    }

    if (!data || typeof data !== 'object') {
      return { status: 'not_found' }
    }

    const payload = data as { status?: string }

    if (payload.status === 'private') return { status: 'private' }
    if (payload.status === 'not_found') return { status: 'not_found' }
    if (payload.status !== 'public') {
      return { status: 'error', message: 'Respuesta inesperada del servidor.' }
    }

    const full = data as {
      project: PublicProjectInfo
      summary: PublicProjectSummary
      tasks: PublicProjectTask[] | null
    }

    return {
      status: 'public',
      project: full.project,
      summary: full.summary,
      tasks: Array.isArray(full.tasks) ? full.tasks : []
    }
  }

  return { getPublicProject }
}
