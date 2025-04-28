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
  const { data: classesData, error: classesError } = await supabase
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
    classesData.map(async (cls) => {
      // 1. 학생 수 가져오기
      const { count: studentCount, error: studentCountError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', cls.id);

      // 2. 설문지 개수 가져오기
      const { count: surveyCount, error: surveyCountError } = await supabase
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

  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newClassName, setNewClassName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      setIsAuthLoading(true);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          console.error("Auth Error:", error);
          router.replace('/login');
          return;
        }

        if (!session) {
          router.replace('/login');
        } else {
          const userRole = session.user?.user_metadata?.role;
          console.log('[DEBUG] Checking role in main page:', userRole);
          
          if (!userRole) {
            router.replace('/select-role');
            return;
          } else if (userRole !== 'teacher') {
            router.replace('/student');
            return;
          }
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.replace('/login');
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const { data: classes, isLoading: isClassesLoading, isError, error } = useQuery<ClassWithCount[], Error>({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    enabled: isAuthenticated,
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
    await updateClassMutation.mutateAsync({ id, newName });
  };

  // ClassCard에 전달할 삭제 함수
  const handleDeleteClass = async (id: string) => {
    await deleteClassMutation.mutateAsync(id);
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  if (isAuthLoading) {
    return <div className="flex justify-center items-center h-screen">인증 확인 중...</div>;
  }

  if (!isAuthenticated || isClassesLoading) {
     return <div className="flex justify-center items-center h-screen text-primary">로딩 중...</div>;
  }

  if (isError) return <div className="text-red-500 text-center mt-10">데이터 로딩 중 오류 발생: {(error as any)?.message ?? '알 수 없는 오류'}</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">내 학급 목록</h1>
        <div className="flex items-center space-x-4">
          <Link
            href="/class/create/school"
            className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors duration-200 text-sm font-medium shadow-sm"
          >
            + 새 학급 만들기
          </Link>
          <button 
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-indigo-600"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="mb-8 flex space-x-4">
        <button 
          onClick={handleSave}
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-sm"
        >
          데이터 저장
        </button>
        <button 
          onClick={handleLoad}
          disabled={loadDataMutation.isPending}
          className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 shadow-sm"
        >
          {loadDataMutation.isPending ? '불러오는 중...' : '데이터 불러오기'}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".json" 
          className="hidden" 
        />
      </div>

      {isClassesLoading && <p>학급 목록을 불러오는 중...</p>}
      {isError && (
        <p className="text-red-500">
          오류 발생: {(error as any)?.message ?? '알 수 없는 오류'}
        </p>
      )}
      {!isClassesLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
            <p className="text-gray-500 italic col-span-full">생성된 학급이 없습니다. '새 학급 만들기' 버튼을 클릭하여 시작하세요.</p>
          )}
        </div>
      )}
    </div>
  );
}
