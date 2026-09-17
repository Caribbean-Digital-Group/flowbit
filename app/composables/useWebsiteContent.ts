import type { WebsiteSection } from '~/utils/website/sections'

export interface RenderedWebsiteContent {
  html: string
  text: string
  word_count: number
  reading_minutes: number
  excerpt: string
}

/**
 * Puente con `/api/website/render`: el HTML del blog y de las secciones se
 * genera y sanea siempre en servidor antes de guardarse.
 */
export const useWebsiteContent = () => {
  const authHeaders = async (): Promise<Record<string, string>> => {
    const session = await useSupabaseSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  const renderDocument = async (doc: unknown): Promise<RenderedWebsiteContent | null> => {
    try {
      const result = await $fetch<{ status: string } & RenderedWebsiteContent>('/api/website/render', {
        method: 'POST',
        headers: await authHeaders(),
        body: { doc }
      })
      return result.status === 'ok' ? result : null
    } catch (error) {
      console.error('Error rendering document:', error)
      return null
    }
  }

  const renderHtml = async (html: string): Promise<RenderedWebsiteContent | null> => {
    try {
      const result = await $fetch<{ status: string } & RenderedWebsiteContent>('/api/website/render', {
        method: 'POST',
        headers: await authHeaders(),
        body: { html }
      })
      return result.status === 'ok' ? result : null
    } catch (error) {
      console.error('Error rendering html:', error)
      return null
    }
  }

  const sanitizeSections = async (sections: WebsiteSection[]): Promise<WebsiteSection[] | null> => {
    try {
      const result = await $fetch<{ status: string; sections: WebsiteSection[] }>('/api/website/render', {
        method: 'POST',
        headers: await authHeaders(),
        body: { sections }
      })
      return result.status === 'ok' ? result.sections : null
    } catch (error) {
      console.error('Error sanitizing sections:', error)
      return null
    }
  }

  return { renderDocument, renderHtml, sanitizeSections }
}
