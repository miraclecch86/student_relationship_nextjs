'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StudentForClient, StudentUpdateData } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface StudentDetailFormProps {
  studentId: string;
  classId: string;
  onClose: () => void;
  onSave?: (updatedStudent: StudentForClient) => void;
}

export default function StudentDetailForm({ 
  studentId, 
  classId, 
  onClose, 
  onSave 
}: StudentDetailFormProps) {
  const [student, setStudent] = useState<StudentForClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<StudentUpdateData>({});
  const [originalData, setOriginalData] = useState<StudentUpdateData>({}); // 원본 데이터 저장

  // 학생 정보 로드
  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const response = await fetch(`/api/class/${classId}/student/${studentId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || '학생 정보를 불러오는데 실패했습니다.');
        }

        setStudent(result.data);
        // 폼 데이터 초기화
        const initialData = {
          name: result.data.name || '',
          gender: result.data.gender || null,
          student_login_id: result.data.student_login_id || '',
          student_password: result.data.student_password_plain || '', // 평문 비밀번호 사용
          address: result.data.address || '',
          mother_phone_number: result.data.mother_phone_number || '',
          father_phone_number: result.data.father_phone_number || '',
          student_phone_number: result.data.student_phone_number || '',
          birthday: result.data.birthday || '',
          remarks: result.data.remarks || '',
          health_status: result.data.health_status || '',
          allergies: result.data.allergies || '',
          tablet_number: result.data.tablet_number || '',
          previous_school_records: result.data.previous_school_records || '',
        };
        setFormData(initialData);
        setOriginalData(initialData); // 원본 데이터도 저장
      } catch (error) {
        console.error('학생 정보 로드 오류:', error);
        toast.error(error instanceof Error ? error.message : '학생 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudent();
  }, [studentId, classId]);

  // 폼 데이터 변경 핸들러
  const handleInputChange = (field: keyof StudentUpdateData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 변경된 필드만 추출하는 함수
  const getChangedFields = () => {
    const changedFields: StudentUpdateData = {};
    
    for (const key in formData) {
      const typedKey = key as keyof StudentUpdateData;
      if (formData[typedKey] !== originalData[typedKey]) {
        (changedFields as any)[typedKey] = formData[typedKey];
      }
    }
    
    return changedFields;
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // 변경된 필드만 전송
      const changedFields = getChangedFields();
      
      // 변경된 필드가 없으면 저장하지 않음
      if (Object.keys(changedFields).length === 0) {
        toast.success('변경된 내용이 없습니다.');
        setIsSaving(false);
        return;
      }

      console.log('변경된 필드들:', changedFields); // 디버깅용

      const response = await fetch(`/api/class/${classId}/student/${studentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changedFields), // 변경된 필드만 전송
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '학생 정보 업데이트에 실패했습니다.');
      }

      toast.success('학생 정보가 성공적으로 업데이트되었습니다.');
      onSave?.(result.data);
      onClose();
    } catch (error) {
      console.error('학생 정보 업데이트 오류:', error);
      toast.error(error instanceof Error ? error.message : '학생 정보 업데이트에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600">학생 정보를 불러올 수 없습니다.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-6"
    >
      <div className="bg-white rounded-xl shadow-lg">
        {/* 헤더 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              {student.name} 학생 상세 정보
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* 기본 정보 섹션 */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">기본 정보</h3>
            <div className="space-y-4">
              {/* 첫 번째 줄: 이름, 성별 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    학생 이름 *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="학생 이름을 입력하세요"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    성별
                  </label>
                  <select
                    value={formData.gender || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleInputChange('gender', value === '' ? null : value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">선택하세요</option>
                    <option value="male">남</option>
                    <option value="female">여</option>
                  </select>
                </div>
              </div>
              
              {/* 두 번째 줄: 생일, 이전 학적 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    생일
                  </label>
                  <input
                    type="date"
                    value={formData.birthday || ''}
                    onChange={(e) => handleInputChange('birthday', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    이전 학적
                  </label>
                  <input
                    type="text"
                    value={formData.previous_school_records || ''}
                    onChange={(e) => handleInputChange('previous_school_records', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="이전 학적 정보를 입력하세요"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 계정 정보 섹션 */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">태블릿 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  태블릿 아이디
                </label>
                <input
                  type="text"
                  value={formData.student_login_id || ''}
                  onChange={(e) => handleInputChange('student_login_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="태블릿 로그인용 아이디"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  태블릿 비밀번호
                </label>
                <input
                  type="text"
                  value={formData.student_password || ''}
                  onChange={(e) => handleInputChange('student_password', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="태블릿 로그인용 비밀번호"
                />
                <p className="text-xs text-gray-600 mt-1">
                  선생님이 설정하는 태블릿 로그인용 비밀번호입니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  태블릿 번호
                </label>
                <input
                  type="text"
                  value={formData.tablet_number || ''}
                  onChange={(e) => handleInputChange('tablet_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="태블릿 번호를 입력하세요"
                />
              </div>
            </div>
          </div>

          {/* 연락처 정보 섹션 */}
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">연락처 정보</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  주소
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="주소를 입력하세요"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    어머니 전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.mother_phone_number || ''}
                    onChange={(e) => handleInputChange('mother_phone_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    아버지 전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.father_phone_number || ''}
                    onChange={(e) => handleInputChange('father_phone_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    학생 전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.student_phone_number || ''}
                    onChange={(e) => handleInputChange('student_phone_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 건강 및 특이사항 섹션 */}
          <div className="bg-yellow-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">건강 및 특이사항</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  건강상태
                </label>
                <textarea
                  value={formData.health_status || ''}
                  onChange={(e) => handleInputChange('health_status', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="건강상태에 대한 정보를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  알레르기
                </label>
                <textarea
                  value={formData.allergies || ''}
                  onChange={(e) => handleInputChange('allergies', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="알레르기 정보를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  특이사항
                </label>
                <textarea
                  value={formData.remarks || ''}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="기타 특이사항을 입력하세요"
                />
              </div>
            </div>
          </div>

          {/* 버튼 섹션 */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSaving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{isSaving ? '저장 중...' : '저장'}</span>
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
} 