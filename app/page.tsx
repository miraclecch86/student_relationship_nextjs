'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class } from '@/lib/supabase';
import ClassCard from '@/components/ClassCard';
import { downloadJson, readJsonFile } from '@/utils/fileUtils';
import toast from 'react-hot-toast';

// fetchClasses 함수를 RPC 호출 대신 기본 select 로 변경
async function fetchClasses(): Promise<Class[]> {
  // 기본 select 쿼리 사용
  const { data, error } = await supabase
      .from('classes')
      .select('id, name, created_at'); // 스키마에 정의된 컬럼만 선택

  if (error) {
    console.error('Error fetching classes:', error);
    throw new Error('학급 정보를 불러오는 중 오류가 발생했습니다.');
  }

  // 반환 타입은 Class[]와 호환됨
  return data || [];
}

async function addClass(name: string): Promise<Class> {
  // teacher_name 제거
  const { data, error } = await supabase
    .from('classes')
    .insert([{ name: name.trim() }]) // teacher_name 삽입 제거
    .select()
    .single();

  if (error) throw new Error(error.message);
  // student_count 제거됨
  return data;
}

// 학급 수정 함수
async function updateClass(id: string, newName: string): Promise<Class | null> {
  const { data, error } = await supabase
    .from('classes')
    .update({ name: newName.trim() })
    .eq('id', id)
    .select()
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
async function replaceAllClasses(loadedClasses: Omit<Class, 'id' | 'created_at'>[]): Promise<void> {
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

  const { data: classes, isLoading, isError, error } = useQuery<Class[], Error>({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  // 학급 추가 Mutation
  const addClassMutation = useMutation<Class, Error, string>({
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
  const updateClassMutation = useMutation<Class | null, Error, { id: string; newName: string }>({
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
          await replaceAllClasses(loadedData as Omit<Class, 'id' | 'created_at'>[]);
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
    await updateClassMutation.mutateAsync({ id, newName });
  };

  // ClassCard에 전달할 삭제 함수
  const handleDeleteClass = async (id: string) => {
    await deleteClassMutation.mutateAsync(id);
  };


  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">학급 관리</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition-colors"
              disabled={isLoading || !classes || classes.length === 0}
            >
              저장
            </button>
            <button
              onClick={handleLoad}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg shadow hover:bg-gray-600 transition-colors"
              disabled={loadDataMutation.isPending}
            >
              {loadDataMutation.isPending ? '불러오는 중...' : '불러오기'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </header>

        <div className="mb-8 flex gap-2">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="새 학급 이름 입력"
            className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          <button
            onClick={handleAddClass}
            disabled={!newClassName.trim() || addClassMutation.isPending}
            className="px-6 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addClassMutation.isPending ? '추가 중...' : '추가'}
          </button>
        </div>

        {isLoading && <p>로딩 중...</p>}
        {isError && <p className="text-red-500">오류 발생: {error?.message}</p>}
        {loadDataMutation.isPending && <p>데이터를 불러오는 중입니다...</p>}

        {classes && classes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <ClassCard
                key={cls.id}
                id={cls.id}
                name={cls.name}
                onEdit={handleEditClass}
                onDelete={handleDeleteClass}
              />
            ))}
          </div>
        ) : (
          <p>학급 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
