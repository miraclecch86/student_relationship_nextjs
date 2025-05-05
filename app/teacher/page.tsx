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

// 데이터 내보내기 함수 (RPC 호출)
async function exportUserData(): Promise<any> {
  const { data, error } = await supabase.rpc('export_user_data');
  
  if (error) {
    console.error('RPC export_user_data error:', error);
    throw new Error(`데이터 내보내기 실패: ${error.message}`);
  }
  
  return data;
}

// 데이터 가져오기 함수 (RPC 호출)
async function importUserData(userData: any): Promise<any> {
  console.log("importUserData 호출됨, userData:", JSON.stringify(userData).slice(0, 500) + "...");
  
  try {
    // 데이터 형식 확인 - 올바른 형식이어야 함
    if (!userData || typeof userData !== 'object') {
      throw new Error('유효하지 않은 데이터 형식입니다.');
    }
    
    // RPC 호출
    const { data, error } = await supabase.rpc('import_user_data', { user_data: userData });
    
    if (error) {
      console.error('RPC import_user_data error:', error);
      console.error('Error details:', JSON.stringify(error));
      throw new Error(`데이터 가져오기 실패: ${error.message || '알 수 없는 오류'}`);
    }
    
    console.log("RPC 성공 응답:", data);
    return data;
  } catch (err) {
    console.error('importUserData 예외 발생:', err);
    throw err;
  }
}

// 단순 버전 데이터 가져오기 함수 (RPC 호출)
async function importUserDataSimple(userData: any): Promise<any> {
  console.log("importUserDataSimple 호출됨");
  
  try {
    // RPC 호출
    const { data, error } = await supabase.rpc('import_user_data_simple', { user_data: userData });
    
    if (error) {
      console.error('RPC import_user_data_simple error:', error);
      throw new Error(`간단 데이터 가져오기 실패: ${error.message}`);
    }
    
    return data;
  } catch (err) {
    console.error('importUserDataSimple 예외 발생:', err);
    throw err;
  }
}

export default function TeacherPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newClassName, setNewClassName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    console.log("[TeacherPage MOUNT]");

    // 인증/역할 확인 로직 모두 제거 - Middleware에서 처리

    // 데이터 로딩 시작 시 로딩 상태 관리 (useQuery 사용)
    // setIsAuthLoading(true); // 제거

    // onAuthStateChange 리스너 - 로그아웃/로그인 시 상태/데이터 처리
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[TeacherPage Auth] onAuthStateChange triggered. Event: ${event}, Session: ${session ? 'exists' : 'null'}, isMounted: ${isMounted}`);
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        console.log('[TeacherPage Auth] SIGNED_OUT event. State will be handled by middleware.');
        // setIsAuthenticated(false); // 미들웨어가 리다이렉트
      } else if (event === 'SIGNED_IN') {
         console.log('[TeacherPage Auth] SIGNED_IN event. Invalidating queries.');
         // setIsAuthenticated(true); // 미들웨어가 접근을 보장
         queryClient.invalidateQueries({ queryKey: ['classes'] }); // 데이터 갱신
      }
    });

    return () => {
      console.log('[TeacherPage UNMOUNT] Cleaning up subscription.');
      isMounted = false;
      subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]); // 의존성 정리

  // 데이터 로딩 상태는 useQuery 사용
  const { data: classes, isLoading: isClassesLoading, isError, error } = useQuery<ClassWithCount[], Error>({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    // enabled: isAuthenticated, // Middleware가 접근을 제어하므로 항상 true 또는 제거
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

  // 데이터 내보내기 Mutation
  const exportDataMutation = useMutation<any, Error>({
    mutationFn: exportUserData,
    onSuccess: (data) => {
      const filename = `학급_데이터_${new Date().toISOString().slice(0, 10)}.json`;
      downloadJson(data, filename);
      toast.success('데이터를 성공적으로 내보냈습니다.');
    },
    onError: (error) => {
      toast.error(`데이터 내보내기 실패: ${error.message}`);
    },
  });

  // 데이터 가져오기 Mutation
  const importDataMutation = useMutation<any, Error, any>({
    mutationFn: importUserData,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      const insertedCounts = result?.inserted || {};
      const sourceInfo = result?.source || '알 수 없음';
      toast.success(
        `데이터를 성공적으로 가져왔습니다. (출처: ${sourceInfo})` +
        `\n학급: ${insertedCounts.classes || 0}, 학생: ${insertedCounts.students || 0}, 설문: ${insertedCounts.surveys || 0}`
      );
    },
    onError: (error) => {
      toast.error(`데이터 가져오기 실패: ${error.message}`);
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

  // 저장 버튼 핸들러 - 수정
  const handleSave = () => {
    if (!classes || classes.length === 0) {
      toast.error('저장할 학급 데이터가 없습니다.');
      return;
    }
    exportDataMutation.mutate();
  };

  // 불러오기 버튼 핸들러
  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  // 파일 선택 핸들러 - 수정
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      readJsonFile(file)
        .then((data) => {
          console.log("파일에서 읽은 데이터:", JSON.stringify(data).slice(0, 300) + "...");
          
          // 메타데이터 확인
          let sourceInfo = '알 수 없음';
          if (data.metadata && data.metadata.exported_by) {
            sourceInfo = data.metadata.exported_by;
          }
          
          // 데이터 검증
          if (!data.classes) {
            toast.error("유효하지 않은 데이터 형식입니다. 'classes' 필드가 없습니다.");
            return;
          }
          
          if (confirm(`데이터를 가져오시겠습니까?\n\n출처: ${sourceInfo}\n\n기존 데이터는 유지되고, 동일한 이름의 학급은 가져온 날짜와 출처 정보를 포함하여 추가됩니다.`)) {
            try {
              // 간단 버전의 함수 먼저 시도
              toast.success("간단 버전으로 데이터 가져오기 시도 중...");
              
              importUserDataSimple(data)
                .then(result => {
                  queryClient.invalidateQueries({ queryKey: ['classes'] });
                  toast.success(`간단 버전으로 데이터 가져오기 성공! 학급 ${result?.inserted?.classes || 0}개 추가됨`);
                })
                .catch(err => {
                  console.error("간단 버전 가져오기 실패:", err);
                  toast.error(`간단 버전 실패: ${err.message}`);
                  
                  // 원래 버전 시도
                  toast.success("원래 버전으로 다시 시도 중...");
                  importDataMutation.mutate(data);
                });
            } catch (err) {
              console.error("데이터 가져오기 중 오류 발생:", err);
              toast.error("데이터 처리 중 오류가 발생했습니다.");
            }
          }
        })
        .catch((error) => {
          console.error("파일 읽기 실패:", error);
          toast.error(`파일 읽기 실패: ${error.message}`);
        });
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

  // 역할 변경 핸들러 추가
  const handleRoleChange = () => {
    console.log('역할 변경하기 버튼 클릭됨');
    // API 라우트를 사용하여 역할 재설정
    window.location.href = '/api/reset-role';
  };

  // 로딩 및 에러 처리 (useQuery 상태 사용)
  if (isClassesLoading) {
      return <div className="flex justify-center items-center h-screen text-primary">학급 목록 로딩 중...</div>;
  }

  if (isError) return <div className="text-red-500 text-center mt-10">데이터 로딩 중 오류 발생: {(error as any)?.message ?? '알 수 없는 오류'}</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 lg:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">내 학급 목록</h1>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleRoleChange}
              className="px-3 py-1.5 text-xs bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-sm"
            >
              역할 변경하기
            </button>
            <button 
              onClick={handleSave}
              disabled={exportDataMutation.isPending || !classes || classes.length === 0}
              className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-sm disabled:opacity-50"
            >
              {exportDataMutation.isPending ? '저장 중...' : '데이터 내보내기'}
            </button>
            <button 
              onClick={handleLoad}
              disabled={importDataMutation.isPending}
              className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 shadow-sm"
            >
              {importDataMutation.isPending ? '가져오는 중...' : '데이터 가져오기'}
            </button>
            <button 
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-indigo-600"
            >
              로그아웃
            </button>
          </div>
        </header>

        <div className="mb-8 flex space-x-4">
          <Link
            href="/class/create/school"
            className="inline-block bg-indigo-600 text-white px-6 py-3 text-lg font-medium rounded-md hover:bg-indigo-700 transition-colors duration-200 shadow-md"
          >
            + 새 학급 만들기
          </Link>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            className="hidden" 
          />
        </div>

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
    </div>
  );
}
