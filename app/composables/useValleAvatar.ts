import type { SupabaseClient } from '@supabase/supabase-js'
import type { ValleDatabase } from '~/types/valle.types'
import type { AvatarConfig } from '~/utils/valle/avatar'
import { DEFAULT_AVATAR, normalizeAvatar } from '~/utils/valle/avatar'

const STORAGE_KEY = 'flowbit:valle-avatar'

const readLocal = (): AvatarConfig | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeAvatar(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

const writeLocal = (config: AvatarConfig): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // modo privado o sin espacio: el avatar sigue en memoria
  }
}

/**
 * Avatar del usuario en Valle Bit. Es de la persona, no de la empresa:
 * `valle_avatar` se indexa por `user_id` y se ve igual en todas sus empresas.
 *
 * Se guarda también en `localStorage` para pintar al instante y como respaldo
 * mientras la migración no esté aplicada (42P01 / PGRST205).
 */
export const useValleAvatar = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<ValleDatabase>

  const avatar = ref<AvatarConfig>(readLocal() ?? { ...DEFAULT_AVATAR })
  /** `false` si la tabla aún no existe: el avatar solo vive en este navegador. */
  const isSynced = ref(true)

  const isMissingTable = (code: string | undefined): boolean => code === '42P01' || code === 'PGRST205'

  const load = async (): Promise<void> => {
    const user = await useSupabaseUser()
    if (!user) return
    const { data, error } = await supabase
      .from('valle_avatar')
      .select('config')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      isSynced.value = false
      if (!isMissingTable(error.code)) console.error('Error fetching Valle Bit avatar:', error)
      return
    }
    isSynced.value = true
    if (data) {
      avatar.value = normalizeAvatar(data.config)
      writeLocal(avatar.value)
    }
  }

  const save = async (config: AvatarConfig): Promise<boolean> => {
    const next = normalizeAvatar(config)
    avatar.value = next
    writeLocal(next)

    const user = await useSupabaseUser()
    if (!user) return false
    const { error } = await supabase
      .from('valle_avatar')
      .upsert({ user_id: user.id, config: { ...next } }, { onConflict: 'user_id' })

    if (error) {
      isSynced.value = false
      if (!isMissingTable(error.code)) console.error('Error saving Valle Bit avatar:', error)
      return false
    }
    isSynced.value = true
    return true
  }

  return { avatar, isSynced, load, save }
}
