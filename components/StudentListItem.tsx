'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NodeData } from '@/app/class/[classId]/page';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import ConfirmModal from './ConfirmModal';
import { DraggableSyntheticListeners } from '@dnd-kit/core';

interface StudentListItemProps {
  student: NodeData;
  classId: string;
  onSelect: (student: NodeData) => void;
  isSelected: boolean;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  listeners?: DraggableSyntheticListeners;
  isDragging?: boolean;
  disabled?: boolean;
}

export default function StudentListItem({
  student,
  classId,
  onSelect,
  isSelected,
  onUpdateStudent,
  onDeleteStudent,
  listeners,
  isDragging = false,
  disabled = false,
}: StudentListItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(student.name);
  const [isHovering, setIsHovering] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editedName.trim() === student.name || !editedName.trim()) {
      setIsEditing(false);
      setEditedName(student.name);
      return;
    }
    try {
      await onUpdateStudent(student.id, editedName.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Student update failed:", error);
      alert("학생 이름 수정에 실패했습니다.");
    }
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditedName(student.name);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveClick(e as any);
    } else if (e.key === 'Escape') {
      handleCancelClick(e as any);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await onDeleteStudent(student.id);
    } catch (error) {
      console.error("Student delete failed:", error);
      alert("학생 삭제에 실패했습니다.");
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCardClick = () => {
    if (isEditing) return;
    onSelect(student);
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`relative group py-1.5 px-2 rounded-lg transition-all duration-150 cursor-pointer border ${
        isSelected
          ? 'bg-indigo-50 border-indigo-500'
          : 'hover:bg-gray-50 border-gray-200'
      } shadow-sm hover:shadow ${
        isDragging ? 'opacity-100 scale-105 shadow-lg bg-white' : ''
      } ${disabled ? 'pointer-events-none' : ''}`}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="flex items-center gap-1">
        <div 
          {...listeners}
          className={`p-1 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing flex-shrink-0 drag-handle ${disabled ? 'opacity-50' : ''}`}
          title="드래그하여 순서 변경"
          style={{ touchAction: 'none' }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <Bars3Icon className="w-3.5 h-3.5 text-gray-400" />
        </div>
      {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={handleNameChange}
            onKeyDown={handleKeyPress}
            className="flex-1 min-w-0 px-1.5 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
            autoFocus
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm font-medium text-gray-700 truncate">
            {student.name}
          </span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveClick}
                className="p-1 rounded-full hover:bg-green-100 text-gray-700 hover:text-green-600"
                title="저장"
              >
            <CheckIcon className="w-4 h-4" />
          </button>
              <button
                onClick={handleCancelClick}
                className="p-1 rounded-full hover:bg-red-100 text-gray-700 hover:text-red-600"
                title="취소"
              >
            <XMarkIcon className="w-4 h-4" />
          </button>
            </>
      ) : (
            <div className={`flex items-center gap-1 transition-opacity duration-150 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={handleEditClick}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-700 hover:text-blue-600"
          title="이름 수정"
        >
                <PencilIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleDeleteClick}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-700 hover:text-red-600"
          title="삭제"
        >
                <TrashIcon className="w-4 h-4" />
        </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="학생 삭제 확인"
        message={`'${student.name}' 학생을 정말 삭제하시겠습니까? 관련된 모든 관계 및 답변 데이터도 삭제됩니다.`}
        confirmText="삭제"
      />
    </div>
  );
} 