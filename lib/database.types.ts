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
      students: {
        Row: {
          id: string
          name: string
          class_id: string
          gender: 'male' | 'female' | null
          position_x: number | null
          position_y: number | null
          student_number: number | null
          student_login_id: string | null
          student_password_hashed: string | null
          address: string | null
          mother_phone_number: string | null
          father_phone_number: string | null
          student_phone_number: string | null
          birthday: string | null
          remarks: string | null
          health_status: string | null
          allergies: string | null
          tablet_number: string | null
          previous_school_records: string | null
          display_order: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          class_id: string
          gender?: 'male' | 'female' | null
          position_x?: number | null
          position_y?: number | null
          student_number?: number | null
          student_login_id?: string | null
          student_password_hashed?: string | null
          address?: string | null
          mother_phone_number?: string | null
          father_phone_number?: string | null
          student_phone_number?: string | null
          birthday?: string | null
          remarks?: string | null
          health_status?: string | null
          allergies?: string | null
          tablet_number?: string | null
          previous_school_records?: string | null
          display_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          class_id?: string
          gender?: 'male' | 'female' | null
          position_x?: number | null
          position_y?: number | null
          student_number?: number | null
          student_login_id?: string | null
          student_password_hashed?: string | null
          address?: string | null
          mother_phone_number?: string | null
          father_phone_number?: string | null
          student_phone_number?: string | null
          birthday?: string | null
          remarks?: string | null
          health_status?: string | null
          allergies?: string | null
          tablet_number?: string | null
          previous_school_records?: string | null
          display_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          }
        ]
      }
      classes: {
        Row: {
          id: string
          name: string
          user_id: string
          grade: number | null
          year: number
          school_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          grade?: number | null
          year?: number
          school_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          grade?: number | null
          year?: number
          school_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      relationships: {
        Row: {
          id: string
          from_student_id: string
          to_student_id: string
          relation_type: '친한' | '보통' | '안친한'
          survey_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          from_student_id: string
          to_student_id: string
          relation_type: '친한' | '보통' | '안친한'
          survey_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          from_student_id?: string
          to_student_id?: string
          relation_type?: '친한' | '보통' | '안친한'
          survey_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_from_student_id_fkey"
            columns: ["from_student_id"]
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_to_student_id_fkey"
            columns: ["to_student_id"]
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_survey_id_fkey"
            columns: ["survey_id"]
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
      surveys: {
        Row: {
          id: string
          class_id: string
          name: string
          description: string | null
          survey_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          name: string
          description?: string | null
          survey_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          name?: string
          description?: string | null
          survey_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          }
        ]
      }
      questions: {
        Row: {
          id: string
          class_id: string
          question_text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          question_text: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          question_text?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          }
        ]
      }
      answers: {
        Row: {
          id: string
          student_id: string
          question_id: string
          answer_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          question_id: string
          answer_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          question_id?: string
          answer_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_student_id_fkey"
            columns: ["student_id"]
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
      }
      class_journals: {
        Row: {
          id: string
          class_id: string
          journal_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          journal_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          journal_date?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_journals_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          }
        ]
      }
      journal_announcements: {
        Row: {
          id: string
          journal_id: string
          keywords: string[] | null
          teacher_input_content: string | null
          ai_generated_content: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          journal_id: string
          keywords?: string[] | null
          teacher_input_content?: string | null
          ai_generated_content?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          journal_id?: string
          keywords?: string[] | null
          teacher_input_content?: string | null
          ai_generated_content?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_announcements_journal_id_fkey"
            columns: ["journal_id"]
            referencedRelation: "class_journals"
            referencedColumns: ["id"]
          }
        ]
      }
      journal_student_status: {
        Row: {
          id: string
          journal_id: string
          student_id: string
          attendance_status: '출석' | '조퇴' | '결석' | '체험학습'
          memo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          journal_id: string
          student_id: string
          attendance_status: '출석' | '조퇴' | '결석' | '체험학습'
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          journal_id?: string
          student_id?: string
          attendance_status?: '출석' | '조퇴' | '결석' | '체험학습'
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_student_status_journal_id_fkey"
            columns: ["journal_id"]
            referencedRelation: "class_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_student_status_student_id_fkey"
            columns: ["student_id"]
            referencedRelation: "students"
            referencedColumns: ["id"]
          }
        ]
      }
      journal_class_memos: {
        Row: {
          id: string
          journal_id: string
          content: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          journal_id: string
          content?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          journal_id?: string
          content?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_class_memos_journal_id_fkey"
            columns: ["journal_id"]
            referencedRelation: "class_journals"
            referencedColumns: ["id"]
          }
        ]
      }
      analysis_results: {
        Row: {
          id: string
          class_id: string
          analysis_type: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          analysis_type: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          analysis_type?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          }
        ]
      }
      class_daily_records: {
        Row: {
          id: string
          class_id: string
          record_date: string
          actual_date: string
          title: string
          content: string
          hashtags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          record_date: string
          actual_date: string
          title: string
          content: string
          hashtags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          record_date?: string
          actual_date?: string
          title?: string
          content?: string
          hashtags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_daily_records_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
