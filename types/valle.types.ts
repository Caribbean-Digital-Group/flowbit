// Tipos temporales de Valle Bit (TRY-77) hasta correr `npm run db:types`
// con la migración 20261128120000_valle_avatar.sql aplicada.
import type { Database } from './database.types'

// `type` y no `interface`: supabase-js exige filas asignables a `Record<string, unknown>`.
export type ValleAvatarRow = {
  user_id: string
  /** Configuración del avatar; se valida con `normalizeAvatar` al leerla. */
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ValleAvatarInsert = Pick<ValleAvatarRow, 'user_id' | 'config'>

/** Cliente de Supabase con la tabla nueva. */
export type ValleDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      valle_avatar: {
        Row: ValleAvatarRow
        Insert: ValleAvatarInsert
        Update: Partial<ValleAvatarInsert>
        Relationships: []
      }
    }
  }
}
