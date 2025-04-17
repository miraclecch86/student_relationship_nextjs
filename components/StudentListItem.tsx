'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NodeData } from '@/app/class/[classId]/page';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ConfirmModal from './ConfirmModal';

interface StudentListItemProps {
  student: NodeData;
  classId: string;
  onSelect: (student: NodeData) => void;
  isSelected: boolean;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
}

export default function StudentListItem({
  student,
  classId,
  onSelect,
  isSelected,
  onUpdateStudent,
  onDeleteStudent,
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
    router.push(`/class/${classId}/student/${student.id}`);
  };

  return (
    <div
      className={`relative group rounded-lg shadow-md p-3 transition-transform duration-200 cursor-pointer text-sm ${isSelected ? 'bg-indigo-100 scale-[1.02] shadow-lg' : 'bg-white hover:shadow-lg hover:scale-[1.03]'}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleCardClick}
      title={student.name}
    >
      {isEditing ? (
        <div className="flex items-center gap-1 w-full">
          <input
            type="text"
            value={editedName}
            onChange={handleNameChange}
            onKeyDown={handleKeyPress}
            className="flex-grow border-b border-[#6366f1] px-1 py-0.5 text-sm focus:outline-none bg-transparent text-black"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button onClick={handleSaveClick} className="p-0.5 text-green-600 hover:text-green-800 flex-shrink-0">
            <CheckIcon className="w-4 h-4" />
          </button>
          <button onClick={handleCancelClick} className="p-0.5 text-red-600 hover:text-red-800 flex-shrink-0">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p className="text-center font-medium truncate text-black" title={student.name}>
          {student.name}
        </p>
      )}

      <div
        className={`absolute top-1 right-1 flex items-center gap-0.5 transition-opacity duration-150 ${isHovering && !isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
      >
        <button
          onClick={handleEditClick}
          className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-blue-600"
          title="이름 수정"
        >
          <PencilIcon className="w-3 h-3" />
        </button>
        <button
          onClick={handleDeleteClick}
          className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-red-600"
          title="삭제"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
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