'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class as BaseClass } from '@/lib/supabase';
import ClassCard from '@/components/ClassCard';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import Link from 'next/link';
// import Banner from '@/components/Banner'; // 기존 Banner 주석 처리 또는 삭제
import CarouselBanner from '@/components/CarouselBanner'; // CarouselBanner import
import { SparklesIcon, UserGroupIcon } from '@heroicons/react/24/outline'; // 예시 아이콘
import { handleDemoSaveAttempt, isDemoClass } from '@/utils/demo-permissions';

// 주관식 질문 개수를 포함하는 새로운 인터페이스 정의
interface ClassWithCount extends BaseClass {
  user_id: string;
  is_demo?: boolean;
  is_public?: boolean;
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

  // 🎯 사용자 학급 + 공개 데모 학급 모두 조회
  const { data: classesData, error: classesError } = await (supabase as any)
    .from('classes')
    .select('id, name, created_at, user_id, is_demo, is_public')
    .or(`user_id.eq.${session.user.id},and(is_demo.eq.true,is_public.eq.true)`)
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

  // 🌟 데모 학급을 맨 위로 정렬
  const sortedClasses = classesWithCounts.sort((a, b) => {
    const aIsDemo = a.is_demo && a.is_public;
    const bIsDemo = b.is_demo && b.is_public;

    if (aIsDemo && !bIsDemo) return -1;
    if (!aIsDemo && bIsDemo) return 1;

    // 같은 타입이면 생성일 기준 정렬
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return sortedClasses;
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

// 학급 삭제 함수 (API 호출로 변경)
async function deleteClass(id: string): Promise<void> {
  const response = await fetch(`/api/classes/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || response.statusText);
  }
}

export default function TeacherPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newClassName, setNewClassName] = useState('');
  const [teacherName, setTeacherName] = useState<string | null>(null);
  // const [showBanner, setShowBanner] = useState(true); // 기존 Banner 상태 주석 처리

  // CarouselBanner를 위한 슬라이드 데이터 예시
  const bannerSlides = [
    {
      id: 1,
      title: '🚀 NEW! 문항 자동 생성앱 - OX 퀴즈 항목 추가(5/17)',
      description: '교과서 텍스트를 OX퀴즈로 만들고 자동으로 구글 슬라이드를 생성합니다.',
      link: '#',
      // titleIcon: <SparklesIcon className="w-6 h-6 text-yellow-300" /> // 아이콘 사용 예시
    },
    {
      id: 2,
      title: '💡 학습 분석 기능 업데이트 안내',
      description: '더욱 정확해진 AI 분석으로 학생들의 학습 패턴을 파악해보세요.',
      link: '#',
    },
    {
      id: 3,
      title: '🎉 여름방학 맞이 특별 이벤트!',
      description: '지금 바로 참여하고 다양한 혜택을 받아가세요.',
      link: '#',
      imageUrl: 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80' // 예시 이미지
    }
  ];

  useEffect(() => {
    let isMounted = true;
    console.log("[TeacherPage MOUNT]");

    // 선생님 이름 가져오기
    const getTeacherName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const teacherName = session.user.user_metadata?.teacher_name;
        setTeacherName(teacherName || null);
      }
    };

    getTeacherName();

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
        // 선생님 이름도 다시 가져오기
        getTeacherName();
      } else if (event === 'USER_UPDATED' && session?.user) {
        // 사용자 메타데이터 업데이트 시 선생님 이름 즉시 반영
        const teacherName = session.user.user_metadata?.teacher_name;
        setTeacherName(teacherName || null);
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
  const updateClassMutation = useMutation<BaseClass | null, Error, { id: string; newName: string; classData: ClassWithCount }>({
    mutationFn: async ({ id, newName, classData }) => {
      // 🌟 데모 학급 권한 체크
      if (isDemoClass(classData)) {
        const saveAttempt = handleDemoSaveAttempt(classData, "학급 이름 수정");
        if (!saveAttempt.canSave) {
          toast.success(saveAttempt.message || "체험판에서는 저장되지 않습니다.", {
            duration: 4000,
            style: {
              background: '#3B82F6',
              color: 'white',
              padding: '16px',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }
          });
          throw new Error("DEMO_BLOCKED");
        }
      }
      return updateClass(id, newName);
    },
    onSuccess: (updatedClass, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (!isDemoClass(variables.classData)) {
        toast.success(`'${variables.newName}'으로 학급 이름이 수정되었습니다.`);
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(`학급 수정 실패: ${error.message}`);
    },
  });

  // 학급 삭제 Mutation
  const deleteClassMutation = useMutation<void, Error, { id: string; classData: ClassWithCount }>({
    mutationFn: async ({ id, classData }) => {
      // 🌟 데모 학급 권한 체크
      if (isDemoClass(classData)) {
        const saveAttempt = handleDemoSaveAttempt(classData, "학급 삭제");
        if (!saveAttempt.canSave) {
          toast.success(saveAttempt.message || "체험판에서는 저장되지 않습니다.", {
            duration: 4000,
            style: {
              background: '#3B82F6',
              color: 'white',
              padding: '16px',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }
          });
          throw new Error("DEMO_BLOCKED");
        }
      }
      return deleteClass(id);
    },
    onSuccess: (_, { classData }) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (!isDemoClass(classData)) {
        toast.success('학급이 삭제되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(`학급 삭제 실패: ${error.message}`);
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

  // ClassCard에 전달할 수정 함수
  const handleEditClass = async (id: string, newName: string) => {
    const classData = classes?.find(cls => cls.id === id);
    if (classData) {
      await updateClassMutation.mutateAsync({ id, newName, classData });
    }
  };

  // ClassCard에 전달할 삭제 함수
  const handleDeleteClass = async (id: string) => {
    const classData = classes?.find(cls => cls.id === id);
    if (classData) {
      await deleteClassMutation.mutateAsync({ id, classData });
    }
  };

  // 로딩 및 에러 처리 (useQuery 상태 사용)
  if (isClassesLoading) {
    return <div className="flex justify-center items-center h-screen text-primary">학급 목록 로딩 중...</div>;
  }

  if (isError) return <div className="text-red-500 text-center mt-10">데이터 로딩 중 오류 발생: {(error as any)?.message ?? '알 수 없는 오류'}</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* CarouselBanner와 하단 콘텐츠를 모두 감싸는 단일 div */}
      <div className="max-w-7xl mx-auto px-6 pb-10 pt-5">
        <CarouselBanner slides={bannerSlides} autoPlayInterval={5000} />
        <header className="flex justify-between items-center mt-5 mb-5 bg-white p-5 rounded-lg shadow-md">
          <div>
            <h1 className="text-2xl font-bold text-black flex items-center space-x-3">
              <UserGroupIcon className="h-7 w-7 text-indigo-600" />
              <span>{teacherName ? `${teacherName}선생님의 학급 목록` : '내 학급 목록'}</span>
            </h1>
            {teacherName && (
              <p className="text-sm text-gray-600 mt-1">
                안녕하세요, {teacherName}선생님! 오늘도 좋은 하루 되세요 😊
              </p>
            )}
          </div>
          <Link
            href="/class/create/school"
            className="inline-block bg-indigo-500 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200"
          >
            + 새 학급 만들기
          </Link>
        </header>

        {!isClassesLoading && !isError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
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
