import { Suspense } from 'react';
import StudentsPageClientContent from './StudentsPageClientContent';

export default function CreateStudentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    }>
      <StudentsPageClientContent />
    </Suspense>
  );
} 