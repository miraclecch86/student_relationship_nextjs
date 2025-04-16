'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ConfirmModal from './ConfirmModal';
import toast from 'react-hot-toast';

interface ClassCardProps {
  id: string;
  name: string;
  onEdit: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ClassCard({
  id,
  name,
  onEdit,
  onDelete,
}: ClassCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [isHovering, setIsHovering] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editedName.trim() === name || !editedName.trim()) {
      setIsEditing(false);
      setEditedName(name);
      return;
    }
    try {
      await onEdit(id, editedName.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Edit failed:", error);
      toast.error("학급 이름 수정에 실패했습니다.");
    }
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditedName(name);
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
      await onDelete(id);
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("학급 삭제에 실패했습니다.");
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCardClick = () => {
    if (!isEditing && !isDeleteDialogOpen) {
      router.push(`/class/${id}`);
    }
  };

  return (
    <div
      className="group relative bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer border border-transparent hover:border-blue-300"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleCardClick}
    >
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editedName}
            onChange={handleNameChange}
            onKeyDown={handleKeyPress}
            className="flex-grow border-b border-blue-500 px-1 py-0.5 focus:outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button onClick={handleSaveClick} className="text-green-500 hover:text-green-700">
            <CheckIcon className="w-5 h-5" />
          </button>
          <button onClick={handleCancelClick} className="text-red-500 hover:text-red-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <h3 className="text-lg font-semibold mb-2 truncate">{name}</h3>
      )}

      {isHovering && !isEditing && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleEditClick}
            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-blue-600 transition-colors"
            title="수정"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-red-600 transition-colors"
            title="삭제"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="학급 삭제 확인"
        message={`\'${name}\' 학급을 정말 삭제하시겠습니까? 학급에 속한 모든 학생 정보도 함께 삭제됩니다.`}
        confirmText="삭제"
      />
    </div>
  );
} 