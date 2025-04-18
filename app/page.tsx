'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class as BaseClass } from '@/lib/supabase';
import ClassCard from '@/components/ClassCard';
import { downloadJson, readJsonFile } from '@/utils/fileUtils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// 주관식 질문 개수를 포함하는 새로운 인터페이스 정의
interface ClassWithCount extends BaseClass {
  subjectiveQuestionCount: number;
}

// fetchClasses 함수를 RPC 호출 대신 기본 select 로 변경
async function fetchClasses(): Promise<ClassWithCount[]> {
  // 기본 select 쿼리 사용
  const { data, error } = await supabase
      .from('classes')
      .select('id, name, created_at') // 스키마에 정의된 컬럼만 선택
      .order('created_at'); // 생성 시간 순 정렬 추가

  if (error) {
    console.error('Error fetching classes:', error);
    throw new Error('학급 정보를 불러오는 중 오류가 발생했습니다.');
  }

  // 2. 각 학급별 주관식 질문 개수 가져오기
  const classesWithCounts = await Promise.all(
    data.map(async (cls) => {
      const { count, error: countError } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true }) // 개수만 필요
        .eq('class_id', cls.id)
        .eq('question_type', 'subjective'); // 주관식 필터링

      if (countError) {
        console.error(`Error fetching subjective question count for class ${cls.id}:`, countError);
        // 오류 발생 시 개수를 0으로 처리하거나, 오류를 전파할 수 있음
        return { ...cls, subjectiveQuestionCount: 0 };
      }
      return { ...cls, subjectiveQuestionCount: count ?? 0 };
    })
  );

  return classesWithCounts;
}

async function addClass(name: string): Promise<BaseClass> {
  // teacher_name 제거
  const { data, error } = await supabase
    .from('classes')
    .insert([{ name: name.trim() }]) // teacher_name 삽입 제거
    .select('id, name, created_at') // select 구체화
    .single();

  if (error) throw new Error(error.message);
  // student_count 제거됨
  return data;
}

// 학급 수정 함수
async function updateClass(id: string, newName: string): Promise<BaseClass | null> {
  const { data, error } = await supabase
    .from('classes')
    .update({ name: newName.trim() })
    .eq('id', id)
    .select('id, name, created_at') // select 구체화
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// 학급 삭제 함수 (RPC 호출로 변경)
async function deleteClass(id: string): Promise<void> {
  // RPC 함수 호출로 변경: 학급 및 하위 데이터(학생, 관계, 질문, 답변) 삭제
  const { error } = await supabase.rpc('delete_class', { class_id_to_delete: id });

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
    const { error } = await supabase.rpc('replace_all_classes', { new_classes: classesToInsert });

    if (error) {
        console.error('RPC replace_all_classes error:', error);
        throw new Error(`데이터 교체 실패: ${error.message}`);
    }
    // 기존 로직 (개별 테이블 delete/insert) 제거
}

export default function Home() {
  const queryClient = useQueryClient();
  const [newClassName, setNewClassName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: classes, isLoading, isError, error } = useQuery<ClassWithCount[], Error>({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  // 학급 추가 Mutation
  const addClassMutation = useMutation<BaseClass, Error, string>({
    mutationFn: addClass,
    onSuccess: (newClass) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setNewClassName('');
      toast.success(`'${newClass.name}' 학급이 추가되었습니다.`);
    },
    onError: (error) => {
      toast.error(`학급 추가 실패: ${error.message}`);
    },
  });

  // 학급 수정 Mutation
  const updateClassMutation = useMutation<BaseClass | null, Error, { id: string; newName: string }>({
    mutationFn: ({ id, newName }) => updateClass(id, newName),
    onSuccess: (updatedClass, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success(`'${variables.newName}'으로 학급 이름이 수정되었습니다.`);
    },
    onError: (error) => {
      toast.error(`학급 수정 실패: ${error.message}`);
    },
  });

  // 학급 삭제 Mutation
  const deleteClassMutation = useMutation<void, Error, string>({
    mutationFn: deleteClass,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('학급이 삭제되었습니다.');
    },
    onError: (error) => {
      toast.error(`학급 삭제 실패: ${error.message}`);
    },
  });

  // 데이터 불러오기 Mutation (mutationFn 내부만 수정)
  const loadDataMutation = useMutation<void, Error, File>({
      mutationFn: async (file) => {
          const loadedData = await readJsonFile(file);
          if (!Array.isArray(loadedData)) {
              throw new Error('잘못된 파일 형식입니다. 학급 목록 배열이 필요합니다.');
          }
          // RPC 함수 호출
          await replaceAllClasses(loadedData as Omit<BaseClass, 'id' | 'created_at'>[]);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['classes'] });
          toast.success('데이터를 성공적으로 불러왔습니다.');
      },
      onError: (error) => {
          toast.error(`데이터 불러오기 실패: ${error.message}`);
      },
  });

  const handleAddClass = () => {
    if (newClassName.trim()) {
      addClassMutation.mutate(newClassName.trim());
    } else {
      toast.error('학급 이름을 입력해주세요.');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAddClass();
    }
  };

  // 저장 버튼 핸들러
  const handleSave = () => {
    if (!classes || classes.length === 0) {
      toast.error('저장할 학급 데이터가 없습니다.');
      return;
    }
    // 저장할 데이터 정제 (id, created_at 제외 - teacher_name, student_count는 이미 타입에서 제외됨)
    const dataToSave = classes.map(({ id, created_at, ...rest }) => rest);
    const filename = `학급_데이터_${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(dataToSave, filename);
  };

  // 불러오기 버튼 핸들러
  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  // 파일 선택 핸들러
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        loadDataMutation.mutate(file);
    }
    // 파일 입력 초기화 (동일 파일 다시 선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ClassCard에 전달할 수정 함수
  const handleEditClass = async (id: string, newName: string) => {
    console.log(`Attempting to edit class ${id} to ${newName}`);
    // 실제 수정 로직은 ClassCard 내부의 상태 관리 및 저장 버튼 클릭 시 처리 필요
    // 예: updateClassMutation.mutate({ id, newName });
    // 성공/실패 처리는 해당 뮤테이션에서 담당
  };

  // ClassCard에 전달할 삭제 함수
  const handleDeleteClass = async (id: string) => {
    await deleteClassMutation.mutateAsync(id);
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen text-primary">로딩 중...</div>;
  if (isError) return <div className="text-red-500 text-center mt-10">데이터 로딩 중 오류 발생: {error?.message}</div>;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-6">학급 관리</h1>

        {/* 저장하기 / 불러오기 버튼 추가 */}
        <div className="flex gap-2 justify-end mb-4">
          <motion.button
            onClick={handleSave}
            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            학급 정보 저장하기
          </motion.button>
          <motion.button
            onClick={handleLoad}
            className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            학급 정보 불러오기
          </motion.button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            style={{ display: 'none' }} // 숨김 처리
          />
        </div>

        <motion.div 
          className="mb-8 p-4 bg-white rounded-lg shadow-md flex items-center gap-3" 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="새 학급 이름 입력..."
            className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent cursor-pointer shadow-sm text-gray-800 placeholder:text-gray-400"
          />
          <motion.button
            onClick={handleAddClass}
            disabled={!newClassName.trim() || addClassMutation.isPending}
            className="px-4 py-2 bg-indigo-500 text-white rounded-md shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 cursor-pointer font-semibold transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            {addClassMutation.isPending ? '추가중...' : '학급 추가'}
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes && classes.length > 0 ? (
            classes
              .filter(classData => !!classData) 
              .map((classData) => (
                classData ? (
                  <ClassCard
                    key={classData.id}
                    classData={classData}
                    onEdit={handleEditClass}
                    onDelete={handleDeleteClass}
                  />
                ) : null
            ))
          ) : (
            !isLoading && (
              <p className="sm:col-span-2 lg:col-span-3 text-center text-gray-500 py-5">
                생성된 학급이 없습니다.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
