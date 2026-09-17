import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteMediaRow, WebsiteMediaUpdate } from '~/types/website.types'

export const WEBSITE_MEDIA_BUCKET = 'website-media'
export const WEBSITE_MEDIA_MAX_BYTES = 10 * 1024 * 1024
export const WEBSITE_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,video/mp4,application/pdf'

const ALLOWED_MIME = new Set(WEBSITE_MEDIA_ACCEPT.split(','))

const safeFileName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase()
    .slice(0, 80)

const readImageSize = (file: File): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/') || typeof window === 'undefined') {
      resolve(null)
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })

/**
 * Biblioteca de medios del sitio web: sube archivos al bucket `website-media`
 * (ruta {company_id}/aaaa/mm/uuid-nombre.ext, protegida por políticas de
 * Storage por prefijo) y registra sus metadatos en website_media.
 */
export const useWebsiteMedia = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const list = async (
    companyId: string,
    options: { folder?: string | null; search?: string | null; limit?: number; imagesOnly?: boolean } = {}
  ): Promise<WebsiteMediaRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('website_media')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 200)
    if (options.folder) query = query.eq('folder', options.folder)
    if (options.imagesOnly) query = query.like('mime_type', 'image/%')
    if (options.search?.trim()) {
      const term = `%${options.search.trim()}%`
      query = query.or(`file_name.ilike.${term},alt_text.ilike.${term},title.ilike.${term}`)
    }
    const { data, error } = await query
    if (error) {
      console.error('Error fetching media:', error)
      return []
    }
    return data ?? []
  }

  const upload = async (companyId: string, file: File, folder = 'general'): Promise<WebsiteMediaRow | null> => {
    if (!companyId) return null
    lastError.value = null

    if (!ALLOWED_MIME.has(file.type)) {
      lastError.value = 'Tipo de archivo no permitido. Usa imágenes (JPG, PNG, WebP, GIF, SVG, AVIF), video MP4 o PDF.'
      return null
    }
    if (file.size > WEBSITE_MEDIA_MAX_BYTES) {
      lastError.value = 'El archivo supera el límite de 10 MB.'
      return null
    }

    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`
    const path = `${companyId}/${yyyy}/${mm}/${uuid}-${safeFileName(file.name) || 'archivo'}`

    const { error: uploadError } = await supabase.storage
      .from(WEBSITE_MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' })

    if (uploadError) {
      console.error('Error uploading media:', uploadError)
      lastError.value = /bucket/i.test(uploadError.message)
        ? 'El bucket «website-media» no existe. Aplica las migraciones pendientes con «npm run db:push».'
        : uploadError.message
      return null
    }

    const { data: urlData } = supabase.storage.from(WEBSITE_MEDIA_BUCKET).getPublicUrl(path)
    const size = await readImageSize(file)
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('website_media')
      .insert({
        company_id: companyId,
        bucket: WEBSITE_MEDIA_BUCKET,
        path,
        public_url: urlData.publicUrl,
        file_name: file.name.slice(0, 255),
        mime_type: file.type,
        size_bytes: file.size,
        width: size?.width ?? null,
        height: size?.height ?? null,
        alt_text: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 255),
        folder: folder || 'general',
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null
      })
      .select()
      .single()

    if (error) {
      console.error('Error registering media:', error)
      // Sin registro no hay forma de gestionarlo: se limpia el objeto subido.
      await supabase.storage.from(WEBSITE_MEDIA_BUCKET).remove([path])
      lastError.value = websiteErrorMessage(error, 'No se pudo registrar el archivo.')
      return null
    }
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsiteMediaUpdate): Promise<WebsiteMediaRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_media')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating media:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo actualizar el archivo.')
      return null
    }
    return data
  }

  /** Elimina el archivo del bucket y su registro (borrado físico: el objeto ya no existe). */
  const remove = async (media: WebsiteMediaRow): Promise<boolean> => {
    const { error: storageError } = await supabase.storage.from(media.bucket).remove([media.path])
    if (storageError) {
      console.error('Error deleting media object:', storageError)
      lastError.value = storageError.message
      return false
    }
    const { error } = await supabase.from('website_media').delete().eq('id', media.id).eq('company_id', media.company_id)
    if (error) {
      console.error('Error deleting media row:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo eliminar el archivo.')
      return false
    }
    return true
  }

  const folders = async (companyId: string): Promise<string[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('website_media')
      .select('folder')
      .eq('company_id', companyId)
      .eq('active', true)
    if (error) return []
    return Array.from(new Set((data ?? []).map(r => r.folder))).sort()
  }

  return { list, upload, update, remove, folders, lastError }
}
