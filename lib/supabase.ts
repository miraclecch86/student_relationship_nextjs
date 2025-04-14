import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wxxysfuvyrzmspxptgdc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eHlzZnV2eXJ6bXNweHB0Z2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2Mzk2MTAsImV4cCI6MjA2MDIxNTYxMH0.q7uhPI22xCCxbDMuItqHKKQQPCSkg0RoEwwS30862J0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface Class {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: number;
  name: string;
  class_id: number;
  created_at: string;
  weekly_form_data?: { [key: string]: string };
  class_?: {
    id: number;
    name: string;
  };
}

export interface Relationship {
  id: number;
  student_id: number;
  friend_id: number;
  relationship_type: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyFormQuestion {
  id: number;
  question: string;
  created_at: string;
}

export async function getWeeklyFormQuestions() {
  const { data, error } = await supabase
    .from('weekly_form_questions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as WeeklyFormQuestion[];
}

export async function addWeeklyFormQuestion(question: string) {
  const { data, error } = await supabase
    .from('weekly_form_questions')
    .insert([{ question }])
    .select();

  if (error) throw error;
  return data[0] as WeeklyFormQuestion;
}

export async function deleteWeeklyFormQuestion(id: number) {
  const { error } = await supabase
    .from('weekly_form_questions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateStudentWeeklyForm(studentId: number, formData: { [key: string]: string }) {
  const { error } = await supabase
    .from('students')
    .update({ weekly_form_data: formData })
    .eq('id', studentId);

  if (error) throw error;
} 