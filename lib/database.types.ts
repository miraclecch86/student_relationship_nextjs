export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      classes: {
        Row: {
          id: string
          created_at: string
          user_id: string
          grade: number
          class: number
          name: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          grade: number
          class: number
          name: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          grade?: number
          class?: number
          name?: string
        }
      }
    }
  }
} 