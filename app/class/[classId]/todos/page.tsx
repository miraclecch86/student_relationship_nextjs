'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { supabase, Class } from '@/lib/supabase';
import { useAutoSave } from '@/hooks/useAutoSave';

// TODO 아이템 타입 정의
interface TodoItem {
  id: string;
  class_id: string;
  title: string;
  start_date: string;
  end_date: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

// 학급 정보 조회
async function fetchClassDetails(classId: string): Promise<Class | null> {
  const { data, error } = await (supabase as any)
    .from('classes')
    .select('*')
    .eq('id', classId)
    .single();

  if (error) {
    console.error('Error fetching class details:', error);
    return null;
  }

  return data;
}

// TODO 아이템 조회
async function fetchClassTodos(classId: string): Promise<TodoItem[]> {
  const { data, error } = await (supabase as any)
    .from('class_todos')
    .select('*')
    .eq('class_id', classId)
    .order('start_date', { ascending: true })
    .order('end_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching todos:', error);
    return [];
  }

  return data || [];
}

// TODO 아이템 추가
async function addClassTodo(todoData: { class_id: string; title: string; start_date: string; end_date: string }): Promise<TodoItem> {
  const { data, error } = await (supabase as any)
    .from('class_todos')
    .insert({
      ...todoData,
      is_completed: false
    })
    .select()
    .single();

  if (error) {
    throw new Error('TODO 추가 중 오류가 발생했습니다.');
  }

  return data;
}

// TODO 완료 상태 토글
async function toggleTodoComplete(todoId: string, isCompleted: boolean): Promise<TodoItem> {
  const { data, error } = await (supabase as any)
    .from('class_todos')
    .update({ is_completed: isCompleted })
    .eq('id', todoId)
    .select()
    .single();

  if (error) {
    throw new Error('TODO 상태 변경 중 오류가 발생했습니다.');
  }

  return data;
}

// TODO 아이템 삭제
async function deleteClassTodo(todoId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('class_todos')
    .delete()
    .eq('id', todoId);

  if (error) {
    throw new Error('TODO 삭제 중 오류가 발생했습니다.');
  }
}

export default function TodoListPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const queryClient = useQueryClient();

  // 상태 관리
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd')
  });
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 자동저장 설정 (검색어 자동저장)
  const { autoSave: autoSaveSearch } = useAutoSave<string>({
    onSave: (value: string) => {
      // 검색어는 localStorage에 자동저장
      if (classId && value) {
        localStorage.setItem(`todos_search_${classId}`, value);
        console.log('TODO 검색어 자동저장됨:', value);
      }
    },
    delay: 1000, // 1초 딜레이
    enabled: searchTerm.length > 0
  });

  // 데이터 조회
  const { data: classDetails } = useQuery<Class | null, Error>({
    queryKey: ['class', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  const { data: classTodos, isLoading: isTodosLoading } = useQuery<TodoItem[], Error>({
    queryKey: ['class-todos', classId],
    queryFn: () => fetchClassTodos(classId),
    enabled: !!classId,
  });

  // 뮤테이션
  const addTodoMutation = useMutation({
    mutationFn: addClassTodo,
    onSuccess: () => {
      toast.success('TODO가 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['class-todos'] });
      setIsTodoModalOpen(false);
      setNewTodo({
        title: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd')
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleTodoMutation = useMutation({
    mutationFn: ({ todoId, isCompleted }: { todoId: string; isCompleted: boolean }) =>
      toggleTodoComplete(todoId, isCompleted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-todos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: deleteClassTodo,
    onSuccess: () => {
      toast.success('TODO가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['class-todos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 필터링된 TODO 목록 (+ 구분 AND 조건)
  const filteredTodos = useMemo(() => {
    if (!classTodos) return [];
    
    let filtered = classTodos;
    
    // 검색어 필터링 (+ 구분 AND 조건)
    if (searchTerm.trim()) {
      const keywords = searchTerm.toLowerCase().trim().split('+').map(keyword => keyword.trim()).filter(keyword => keyword.length > 0);
      
      filtered = filtered.filter(todo => {
        const title = todo.title.toLowerCase();
        // 모든 키워드가 제목에 포함되어야 함 (AND 조건)
        return keywords.every(keyword => title.includes(keyword));
      });
    }
    
    // 상태 필터링
    switch (filter) {
      case 'active':
        return filtered.filter(todo => !todo.is_completed);
      case 'completed':
        return filtered.filter(todo => todo.is_completed);
      default:
        return filtered;
    }
  }, [classTodos, filter, searchTerm]);

  // 핸들러 함수들
  const handleAddTodo = () => {
    if (!newTodo.title.trim()) {
      toast.error('TODO 제목을 입력해주세요.');
      return;
    }

    if (new Date(newTodo.start_date) > new Date(newTodo.end_date)) {
      toast.error('시작일이 종료일보다 늦을 수 없습니다.');
      return;
    }

    addTodoMutation.mutate({
      class_id: classId,
      title: newTodo.title.trim(),
      start_date: newTodo.start_date,
      end_date: newTodo.end_date
    });
  };

  const handleToggleTodo = (todoId: string, currentCompleted: boolean) => {
    toggleTodoMutation.mutate({
      todoId,
      isCompleted: !currentCompleted
    });
  };

  const handleDeleteTodo = (todoId: string) => {
    if (confirm('정말로 이 TODO를 삭제하시겠습니까?')) {
      deleteTodoMutation.mutate(todoId);
    }
  };

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
                          {/* 헤더 */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center space-x-2">
            <span className="text-2xl">✅</span>
            <span>{classDetails.name} TO-DO</span>
          </h1>
          <button
            onClick={() => setIsTodoModalOpen(true)}
            className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            <span>새 TODO 추가</span>
          </button>
        </div>

        {/* 검색 및 필터 섹션 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* 검색창 */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setSearchTerm(newValue);
                  autoSaveSearch(newValue);
                }}
                placeholder="TODO 검색 (여러 단어는 +로 구분)"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* 필터 버튼들 */}
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700 hidden lg:block">필터:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-green-100 text-green-800 ring-2 ring-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체 <span className="ml-1 text-xs">({classTodos?.length || 0})</span>
                </button>
                <button
                  onClick={() => setFilter('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'active'
                      ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  진행 중 <span className="ml-1 text-xs">({classTodos?.filter(t => !t.is_completed).length || 0})</span>
                </button>
                <button
                  onClick={() => setFilter('completed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'completed'
                      ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  완료 <span className="ml-1 text-xs">({classTodos?.filter(t => t.is_completed).length || 0})</span>
                </button>
              </div>
            </div>
          </div>

          {/* 검색 결과 표시 */}
          {searchTerm.trim() && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">"{searchTerm}"</span> 검색 결과: 
                <span className="ml-1 font-semibold text-green-600">{filteredTodos.length}개</span>
              </p>
            </div>
          )}
        </div>

        {/* TODO 리스트 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {isTodosLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">TODO 목록을 불러오는 중...</p>
            </div>
                     ) : filteredTodos.length > 0 ? (
             <div className="space-y-2">
               {filteredTodos.map((todo) => (
                 <div
                   key={todo.id}
                   className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors ${
                     todo.is_completed
                       ? 'bg-gray-50 border-gray-200'
                       : 'bg-white border-green-200 hover:bg-green-50'
                   }`}
                 >
                   {/* 체크박스 */}
                   <input
                     type="checkbox"
                     checked={todo.is_completed}
                     onChange={() => handleToggleTodo(todo.id, todo.is_completed)}
                     className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded flex-shrink-0"
                   />
                   
                   {/* 우선순위 점 */}
                   {!todo.is_completed ? (
                     <div className="flex-shrink-0">
                       {(() => {
                         const today = new Date();
                         const startDate = new Date(todo.start_date);
                         const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                         
                         if (diffDays < 0) {
                           return <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="지난 TODO"></div>;
                         } else if (diffDays === 0) {
                           return <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="오늘 TODO"></div>;
                         } else if (diffDays <= 3) {
                           return <div className="w-2 h-2 bg-yellow-500 rounded-full" title="임박한 TODO"></div>;
                         } else {
                           return <div className="w-2 h-2 bg-green-500 rounded-full" title="여유있는 TODO"></div>;
                         }
                       })()}
                     </div>
                   ) : (
                     <div className="w-2 h-2 flex-shrink-0"></div>
                   )}
                   
                   {/* 내용 영역 */}
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between">
                       <div className={`text-sm font-medium truncate ${
                         todo.is_completed 
                           ? 'text-gray-500 line-through' 
                           : 'text-gray-800'
                       }`}>
                         {todo.title}
                       </div>
                       <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                         {format(new Date(todo.start_date), 'M/d', { locale: ko })}
                         {todo.start_date !== todo.end_date && (
                           <span>~{format(new Date(todo.end_date), 'M/d', { locale: ko })}</span>
                         )}
                       </div>
                     </div>
                   </div>
                   
                   {/* 상태 및 삭제 버튼 */}
                   <div className="flex items-center space-x-1 flex-shrink-0">
                     {todo.is_completed && (
                       <CheckIcon className="h-3 w-3 text-green-600" title="완료" />
                     )}
                     <button
                       onClick={() => handleDeleteTodo(todo.id)}
                       className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                       title="삭제"
                     >
                       <TrashIcon className="h-3 w-3" />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
                     ) : (
             <div className="text-center py-16">
               <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                 <span className="text-4xl">
                   {searchTerm.trim() ? '🔍' : 
                    filter === 'all' ? '📝' : 
                    filter === 'active' ? '⏳' : 
                    '✅'}
                 </span>
               </div>
               <h3 className="text-xl font-semibold text-gray-900 mb-3">
                 {searchTerm.trim() ? `"${searchTerm}" 검색 결과가 없습니다` :
                  filter === 'all' ? 'TODO가 없습니다' : 
                  filter === 'active' ? '진행 중인 TODO가 없습니다' : 
                  '완료된 TODO가 없습니다'}
               </h3>
               <p className="text-gray-500 mb-6 max-w-md mx-auto">
                 {searchTerm.trim() ? '다른 검색어로 시도해보거나 새로운 TODO를 추가해보세요.' :
                  filter === 'all' ? '첫 번째 TODO를 추가해서 할 일을 관리해보세요!' : 
                  filter === 'active' ? '훌륭해요! 모든 TODO를 완료했습니다. 🎉' : 
                  '완료한 TODO가 여기에 표시됩니다.'}
               </p>
               {(!searchTerm.trim() && filter !== 'completed') && (
                 <button
                   onClick={() => setIsTodoModalOpen(true)}
                   className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
                 >
                   <PlusIcon className="h-5 w-5 mr-2" />
                   첫 TODO 추가하기
                 </button>
               )}
             </div>
           )}
        </div>
      </div>

      {/* TODO 추가 모달 */}
      {isTodoModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">TODO 추가</h3>
              <button
                onClick={() => {
                  setIsTodoModalOpen(false);
                  setNewTodo({
                    title: '',
                    start_date: format(new Date(), 'yyyy-MM-dd'),
                    end_date: format(new Date(), 'yyyy-MM-dd')
                  });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">내용</label>
                <input
                  type="text"
                  value={newTodo.title}
                  onChange={(e) => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="할 일을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  maxLength={200}
                />
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">시작일</label>
                  <input
                    type="date"
                    value={newTodo.start_date}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">종료일</label>
                  <input
                    type="date"
                    value={newTodo.end_date}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsTodoModalOpen(false);
                  setNewTodo({
                    title: '',
                    start_date: format(new Date(), 'yyyy-MM-dd'),
                    end_date: format(new Date(), 'yyyy-MM-dd')
                  });
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddTodo}
                disabled={!newTodo.title.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 