'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class as BaseClass } from '@/lib/supabase';
import ClassCard from '@/components/ClassCard';
import { downloadJson, readJsonFile } from '@/utils/fileUtils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import Link from 'next/link';
import UserProfile from '@/components/UserProfile';

// 주관식 질문 개수를 포함하는 새로운 인터페이스 정의
interface ClassWithCount extends BaseClass {
  user_id: string;
  subjectiveQuestionCount?: number;
  studentCount: number;
  surveyCount: number;
}

// fetchClasses 함수를 RPC 호출 대신 기본 select 로 변경
async function fetchClasses(): Promise<ClassWithCount[]> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  // console.log('Session check:', { session, sessionError }); // 로그 잠시 비활성화

  if (sessionError || !session) {
    console.error('Session error:', sessionError);
    throw new Error('인증 세션을 확인할 수 없습니다.');
  }

  // 클래스 데이터 조회
  const { data: classesData, error: classesError } = await (supabase as any)
      .from('classes')
    .select('id, name, created_at, user_id')
    .eq('user_id', session.user.id)
    .order('created_at');

  if (classesError) {
    console.error('Classes error:', classesError); // 에러 객체 전체를 로깅
    throw new Error('학급 정보를 불러오는 중 오류가 발생했습니다.');
  }

  if (!classesData) {
    return [];
  }

  // --- 임시 주석 처리 제거 시작 ---
  // 각 학급별 학생 수와 주관식 질문 개수 가져오기
  const classesWithCounts = await Promise.all(
    classesData.map(async (cls: any) => {
      // 1. 학생 수 가져오기
      const { count: studentCount, error: studentCountError } = await (supabase as any)
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', cls.id);

      // 2. 설문지 개수 가져오기
      const { count: surveyCount, error: surveyCountError } = await (supabase as any)
        .from('surveys')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', cls.id);

      if (studentCountError || surveyCountError) {
        console.error(`Error fetching counts for class ${cls.id}:`, studentCountError, surveyCountError);
        return { ...cls, studentCount: 0, surveyCount: 0 };
      }

      return {
        ...cls,
        studentCount: studentCount ?? 0,
        surveyCount: surveyCount ?? 0,
      };
    })
  );

  return classesWithCounts;
  // --- 임시 주석 처리 제거 끝 ---

  // 임시 반환: 카운트 없이 클래스 데이터만 반환 (타입 맞추기 위해 임시 카운트 추가)
  // return classesData.map(cls => ({ ...cls, studentCount: 0, subjectiveQuestionCount: 0 }));
}

async function addClass(name: string): Promise<BaseClass> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error('사용자 정보를 가져올 수 없습니다.');
  if (!user) throw new Error('로그인이 필요합니다.');

  const { data, error } = await (supabase as any)
    .from('classes')
    .insert([{ 
      name: name.trim(),
      user_id: user.id 
    }])
    .select('id, name, created_at, user_id')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// 학급 수정 함수
async function updateClass(id: string, newName: string): Promise<BaseClass | null> {
  const { data, error } = await (supabase as any)
    .from('classes')
    .update({ name: newName.trim() })
    .eq('id', id)
    .select('id, name, created_at, user_id')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// 학급 삭제 함수 (RPC 호출로 변경)
async function deleteClass(id: string): Promise<void> {
  // RPC 함수 호출로 변경: 학급 및 하위 데이터(학생, 관계, 질문, 답변) 삭제
  const { error } = await (supabase as any).rpc('delete_class', { class_id_to_delete: id });

  if (error) {
    console.error('RPC delete_class error:', error);
    throw new Error(`학급 삭제 실패: ${error.message}`);
  }
}

// 불러온 데이터로 학급 및 학생 데이터 교체 함수 (RPC 호출로 변경)
async function replaceAllClasses(loadedClasses: Omit<BaseClass, 'id' | 'created_at'>[]): Promise<void> {
    // RPC 함수 호출로 변경: 모든 클래스/학생 삭제 후 새 데이터 삽입
    // 참고: Supabase RPC는 기본적으로 JSON을 지원합니다.
    const classesToInsert = loadedClasses.map(cls => ({ name: cls.name }));
    const { error } = await (supabase as any).rpc('replace_all_classes', { new_classes: classesToInsert });

    if (error) {
        console.error('RPC replace_all_classes error:', error);
        throw new Error(`데이터 교체 실패: ${error.message}`);
    }
    // 기존 로직 (개별 테이블 delete/insert) 제거
}

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: classes, isLoading: isClassesLoading, isError, error } = useQuery<ClassWithCount[], Error>({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  // 학급 수정 뮤테이션
  const updateClassMutation = useMutation<BaseClass | null, Error, { id: string; newName: string }>({
    mutationFn: ({ id, newName }) => updateClass(id, newName),
    onSuccess: (updatedClass) => {
      if (updatedClass) {
        queryClient.invalidateQueries({ queryKey: ['classes'] });
        toast.success(`'${updatedClass.name}'으로 수정되었습니다.`);
      }
    },
    onError: (error) => {
      toast.error(`수정 중 오류 발생: ${error.message}`);
    },
  });

  // 학급 삭제 뮤테이션
  const deleteClassMutation = useMutation<void, Error, string>({
    mutationFn: deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('학급이 삭제되었습니다.');
    },
    onError: (error) => {
      toast.error(`삭제 중 오류 발생: ${error.message}`);
    },
  });

  // 학급 수정 핸들러
  const handleEditClass = async (id: string, newName: string) => {
    updateClassMutation.mutate({ id, newName });
  };

  // 학급 삭제 핸들러
  const handleDeleteClass = async (id: string) => {
    deleteClassMutation.mutate(id);
  };

  if (isClassesLoading) {
     return <div className="flex justify-center items-center h-screen text-primary">로딩 중...</div>;
  }

  if (isError) return <div className="text-red-500 text-center mt-10">데이터 로딩 중 오류 발생: {(error as any)?.message ?? '알 수 없는 오류'}</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">내 학급 목록</h1>
          <div className="flex items-center space-x-4">
            <Link
              href="/class/create/school"
              className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors duration-200 text-sm font-medium shadow-sm"
            >
              + 새 학급 만들기
            </Link>
            <UserProfile />
          </div>
        </header>

        {/* 학급 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
          {classes && classes.length > 0 ? (
            classes.map((cls) => (
              <motion.div 
                key={cls.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ClassCard
                  classData={cls}
                  onEdit={handleEditClass}
                  onDelete={handleDeleteClass}
                />
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg mb-4">생성된 학급이 없습니다.</p>
              <Link
                href="/class/create/school"
                className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors duration-200 font-medium"
              >
                첫 번째 학급 만들기
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
