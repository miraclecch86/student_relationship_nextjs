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
      },
      analysis_results: {
        Row: {
          id: string
          class_id: string
          created_at: string
          result_data: Json
          summary: string
          type: string
        }
        Insert: {
          id?: string
          class_id: string
          created_at?: string
          result_data: Json
          summary: string
          type?: string
        }
        Update: {
          id?: string
          class_id?: string
          created_at?: string
          result_data?: Json
          summary?: string
          type?: string
        }
      }
    }
  }
} 