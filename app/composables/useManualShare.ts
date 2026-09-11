import type { DocArticle } from '~/utils/manual/types'
import {
  articleSections,
  articleToMarkdown,
  articleToSocialText,
  buildArticleUrl,
  buildShareTargetUrl,
  copyText,
  downloadBlob,
  renderShareCard,
  type ShareTarget
} from '~/utils/manualShare'

/**
 * Acciones de copiar y compartir del manual. Centraliza el armado de enlaces
 * públicos (/help/:id) y el aviso visual de confirmación.
 */
export const useManualShare = () => {
  const config = useRuntimeConfig()

  // Aviso compartido: cualquier botón de copiar/compartir lo alimenta.
  const feedback = useState<string | null>('manual-share-feedback', () => null)
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const notify = (message: string) => {
    feedback.value = message
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => { feedback.value = null }, 2600)
  }

  /** Dominio público del sitio; en el navegador se prefiere el origen real. */
  const siteOrigin = (): string => {
    if (import.meta.client && window.location.origin) return window.location.origin
    return config.public.siteUrl as string
  }

  const siteLabel = computed(() => siteOrigin().replace(/^https?:\/\//, ''))

  const articleUrl = (articleId: string, sectionId?: string): string =>
    buildArticleUrl(siteOrigin(), articleId, sectionId)

  const copy = async (text: string, message = 'Copiado al portapapeles'): Promise<boolean> => {
    const ok = await copyText(text)
    notify(ok ? message : 'No se pudo copiar')
    return ok
  }

  /** Copia el enlace público del artículo o de una de sus secciones. */
  const copyLink = async (articleId: string, sectionId?: string): Promise<boolean> =>
    copy(articleUrl(articleId, sectionId), 'Enlace copiado')

  /** Copia el artículo completo en formato Markdown. */
  const copyArticle = async (article: DocArticle): Promise<boolean> =>
    copy(`${articleToMarkdown(article)}\n\n${articleUrl(article.id)}`, 'Documentación copiada')

  /** Copia una sección concreta con su enlace directo. */
  const copySection = async (article: DocArticle, sectionId: string, text: string): Promise<boolean> =>
    copy(`${text}\n\n${articleUrl(article.id, sectionId)}`, 'Sección copiada')

  /** Abre el diálogo nativo de compartir del sistema, si el navegador lo soporta. */
  const canUseNativeShare = (): boolean =>
    import.meta.client && typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const shareNative = async (article: DocArticle, sectionId?: string): Promise<boolean> => {
    if (!canUseNativeShare()) return false
    try {
      await navigator.share({
        title: `Flowbit — ${article.title}`,
        text: articleToSocialText(article),
        url: articleUrl(article.id, sectionId)
      })
      return true
    } catch (error) {
      // El usuario canceló el diálogo: no es un error que deba reportarse.
      if ((error as DOMException)?.name === 'AbortError') return false
      console.error('Error compartiendo:', error)
      return false
    }
  }

  /** Abre la red social elegida con el texto y el enlace ya preparados. */
  const shareTo = (target: ShareTarget, article: DocArticle, sectionId?: string, customText?: string) => {
    const url = articleUrl(article.id, sectionId)
    const text = customText ?? articleToSocialText(article)
    const shareUrl = buildShareTargetUrl(target, text, url)

    if (target === 'email') {
      window.location.href = shareUrl
      return
    }
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  /** Genera y descarga la tarjeta de imagen del artículo, lista para publicar. */
  const downloadCard = async (article: DocArticle): Promise<boolean> => {
    const blob = await renderShareCard(article, siteLabel.value)
    if (!blob) {
      notify('No se pudo generar la imagen')
      return false
    }
    downloadBlob(blob, `flowbit-${article.id}.png`)
    notify('Tarjeta descargada')
    return true
  }

  return {
    feedback,
    notify,
    siteLabel,
    articleUrl,
    sections: articleSections,
    socialText: articleToSocialText,
    markdown: articleToMarkdown,
    copy,
    copyLink,
    copyArticle,
    copySection,
    canUseNativeShare,
    shareNative,
    shareTo,
    downloadCard
  }
}
