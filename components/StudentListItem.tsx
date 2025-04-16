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
      setIsDeleteDialogOpen(false);
    }
  };

  const handleItemClick = () => {
    if (isEditing) return;
    router.push(`/class/${classId}/student/${student.id}`);
  };

  return (
    <li
      className={`group relative flex items-center justify-between text-sm p-2 rounded hover:bg-gray-100 cursor-pointer ${isSelected ? 'bg-blue-100 font-medium' : ''}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleItemClick}
      title={`클릭하여 ${student.name} 학생 정보 보기`}
    >
      {isEditing ? (
        <div className="flex-grow flex items-center gap-1 mr-2">
          <input
            type="text"
            value={editedName}
            onChange={handleNameChange}
            onKeyDown={handleKeyPress}
            className="flex-grow border-b border-blue-500 px-1 py-0.5 text-sm focus:outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button onClick={handleSaveClick} className="p-0.5 text-green-600 hover:text-green-800">
            <CheckIcon className="w-4 h-4" />
          </button>
          <button onClick={handleCancelClick} className="p-0.5 text-red-600 hover:text-red-800">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <span className="truncate flex-grow" title={student.name}>{student.name}</span>
      )}

      {isHovering && !isEditing && (
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleEditClick}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600"
            title="이름 수정"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-red-600"
            title="삭제"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="학생 삭제 확인"
        message={`'${student.name}' 학생을 정말 삭제하시겠습니까? 관련된 모든 관계 및 답변 데이터도 삭제됩니다.`}
        confirmText="삭제"
      />
    </li>
  );
} 