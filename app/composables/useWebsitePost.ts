import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WebsiteDatabase,
  WebsitePostRow,
  WebsitePostInsert,
  WebsitePostUpdate,
  WebsitePostRevisionRow,
  WebsitePostStatus
} from '~/types/website.types'

export interface WebsitePostListFilters {
  status?: WebsitePostStatus | 'all'
  categoryId?: string | null
  authorId?: string | null
  search?: string | null
}

/**
 * Publicaciones del blog (website_post).
 *
 * El cuerpo se guarda como documento Tiptap (`body`) más el HTML saneado en
 * servidor (`body_html`), el texto plano y las métricas de lectura que devuelve
 * `/api/website/render`. Las etiquetas se sincronizan con el RPC
 * set_website_post_tags (crea las que no existan).
 */
export const useWebsitePost = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string, filters: WebsitePostListFilters = {}): Promise<WebsitePostRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('website_post')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: true })
      .order('updated_at', { ascending: false })
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters.authorId) query = query.eq('author_id', filters.authorId)
    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`
      query = query.or(`title.ilike.${term},subtitle.ilike.${term},excerpt.ilike.${term}`)
    }
    const { data, error } = await query
    if (error) {
      console.error('Error fetching posts:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<WebsitePostRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('website_post')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching post:', error)
      return null
    }
    return data
  }

  const getTagIds = async (postId: string, companyId: string): Promise<string[]> => {
    if (!postId || !companyId) return []
    const { data, error } = await supabase
      .from('website_post_tag')
      .select('tag_id')
      .eq('post_id', postId)
      .eq('company_id', companyId)
    if (error) return []
    return (data ?? []).map(r => r.tag_id)
  }

  const create = async (post: WebsitePostInsert): Promise<WebsitePostRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_post')
      .insert({ ...post, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating post:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear la publicación.')
      return null
    }
    lastError.value = null
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsitePostUpdate): Promise<WebsitePostRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_post')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating post:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar la publicación.')
      return null
    }
    lastError.value = null
    return data
  }

  const setTags = async (postId: string, tagNames: string[]): Promise<boolean> => {
    if (!postId) return false
    const { data, error } = await supabase.rpc('set_website_post_tags' as never, {
      p_post_id: postId,
      p_tag_names: tagNames
    } as never)
    if (error) {
      console.error('Error setting post tags:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudieron guardar las etiquetas.')
      return false
    }
    return (data as { status?: string } | null)?.status === 'ok'
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_post')
      .update({ status: 'archived', is_pinned: false, is_featured: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error archiving post:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo archivar la publicación.')
      return false
    }
    return true
  }

  const getRevisions = async (postId: string, companyId: string): Promise<WebsitePostRevisionRow[]> => {
    if (!postId || !companyId) return []
    const { data, error } = await supabase
      .from('website_post_revision')
      .select('*')
      .eq('post_id', postId)
      .eq('company_id', companyId)
      .order('revision_no', { ascending: false })
      .limit(20)
    if (error) {
      console.error('Error fetching post revisions:', error)
      return []
    }
    return data ?? []
  }

  return { getAllByCompany, getById, getTagIds, create, update, setTags, archive, getRevisions, lastError }
}
