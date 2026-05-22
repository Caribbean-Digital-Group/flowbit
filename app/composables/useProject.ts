import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type Project = Tables<'project'>
type ProjectInsert = TablesInsert<'project'>
type ProjectUpdate = TablesUpdate<'project'>
type ProjectView = Database['public']['Views']['v_projects']['Row']
type ProjectStatus = Database['public']['Enums']['project_status']

export interface ProjectMetrics {
  total: number
  pending: number
  inProgress: number
  completed: number
  paused: number
  cancelled: number
  overdue: number
  totalBudgetEstimated: number
  totalBudgetActual: number
  averageProgress: number
}

export const useProject = () => {
  const supabase = useSupabase()

  const getProjectsByCompany = async (
    companyId: string,
    options?: {
      status?: ProjectStatus
      active?: boolean
    }
  ): Promise<ProjectView[]> => {
    if (!companyId) return []

    let query = supabase
      .from('v_projects')
      .select('*')
      .eq('company_id', companyId)

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.active !== undefined) {
      query = query.eq('active', options.active)
    } else {
      query = query.eq('active', true)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects by company:', error)
      return []
    }

    return data ?? []
  }

  const getProjectById = async (
    id: string,
    companyId: string
  ): Promise<Project | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('project')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching project:', error)
      return null
    }

    return data
  }

  const getProjectViewById = async (
    id: string,
    companyId: string
  ): Promise<ProjectView | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('v_projects')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching project view:', error)
      return null
    }

    return data
  }

  const createProject = async (
    companyId: string,
    payload: Omit<ProjectInsert, 'company_id'>
  ): Promise<Project | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('project')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating project:', error)
      return null
    }

    return data
  }

  const updateProject = async (
    id: string,
    companyId: string,
    updates: ProjectUpdate
  ): Promise<Project | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('project')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating project:', error)
      return null
    }

    return data
  }

  const archiveProject = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('project')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('Error archiving project:', error)
      return false
    }

    return true
  }

  const setProjectStatus = async (
    projectId: string,
    status: ProjectStatus
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('set_project_status', {
      p_project_id: projectId,
      p_new_status: status
    })

    if (error) {
      console.error('Error setting project status:', error)
      return false
    }

    return Boolean(data)
  }

  const recomputeProjectMetrics = async (projectId: string): Promise<boolean> => {
    const { error } = await supabase.rpc('recompute_project_metrics', {
      p_project_id: projectId
    })

    if (error) {
      console.error('Error recomputing project metrics:', error)
      return false
    }

    return true
  }

  /**
   * Calcula métricas agregadas a partir del listado de proyectos
   * (tipicamente usado en el listado/dashboard).
   */
  const computeAggregatedMetrics = (projects: ProjectView[]): ProjectMetrics => {
    const metrics: ProjectMetrics = {
      total: projects.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      paused: 0,
      cancelled: 0,
      overdue: 0,
      totalBudgetEstimated: 0,
      totalBudgetActual: 0,
      averageProgress: 0
    }

    if (projects.length === 0) return metrics

    let progressSum = 0
    let progressCount = 0

    for (const project of projects) {
      if (project.status === 'pending') metrics.pending += 1
      if (project.status === 'in_progress') metrics.inProgress += 1
      if (project.status === 'completed') metrics.completed += 1
      if (project.status === 'paused') metrics.paused += 1
      if (project.status === 'cancelled') metrics.cancelled += 1
      if (project.is_overdue) metrics.overdue += 1

      metrics.totalBudgetEstimated += Number(project.budget_estimated ?? 0)
      metrics.totalBudgetActual += Number(project.budget_actual ?? 0)

      if (project.status !== 'cancelled') {
        progressSum += Number(project.progress ?? 0)
        progressCount += 1
      }
    }

    metrics.averageProgress = progressCount > 0
      ? Math.round(progressSum / progressCount)
      : 0

    return metrics
  }

  return {
    getProjectsByCompany,
    getProjectById,
    getProjectViewById,
    createProject,
    updateProject,
    archiveProject,
    setProjectStatus,
    recomputeProjectMetrics,
    computeAggregatedMetrics
  }
}
