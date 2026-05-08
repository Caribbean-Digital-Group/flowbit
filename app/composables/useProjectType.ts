import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type ProjectType = Tables<'project_type'>
type ProjectTypeInsert = TablesInsert<'project_type'>
type ProjectTypeUpdate = TablesUpdate<'project_type'>

export const useProjectType = () => {
  const supabase = useSupabase()

  /**
   * Lista los tipos de proyecto activos para una empresa.
   */
  const getProjectTypesByCompany = async (
    companyId: string,
    options?: { active?: boolean }
  ): Promise<ProjectType[]> => {
    if (!companyId) return []

    let query = supabase
      .from('project_type')
      .select('*')
      .eq('company_id', companyId)

    if (options?.active !== undefined) {
      query = query.eq('active', options.active)
    } else {
      query = query.eq('active', true)
    }

    const { data, error } = await query.order('name')

    if (error) {
      console.error('Error fetching project types:', error)
      return []
    }

    return data ?? []
  }

  const getProjectTypeById = async (id: string): Promise<ProjectType | null> => {
    if (!id) return null

    const { data, error } = await supabase
      .from('project_type')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching project type:', error)
      return null
    }

    return data
  }

  const createProjectType = async (
    companyId: string,
    payload: Omit<ProjectTypeInsert, 'company_id'>
  ): Promise<ProjectType | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('project_type')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating project type:', error)
      return null
    }

    return data
  }

  const updateProjectType = async (
    id: string,
    updates: ProjectTypeUpdate
  ): Promise<ProjectType | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('project_type')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating project type:', error)
      return null
    }

    return data
  }

  const archiveProjectType = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('project_type')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('Error archiving project type:', error)
      return false
    }

    return true
  }

  return {
    getProjectTypesByCompany,
    getProjectTypeById,
    createProjectType,
    updateProjectType,
    archiveProjectType
  }
}
