// RoleSelector placeholder

interface RoleSelectorProps {
  onSelectRole: (role: 'teacher' | 'student') => void;
  isLoading?: boolean;
}

export default function RoleSelector({ onSelectRole, isLoading }: RoleSelectorProps) {
  // Implement role selection UI here
  return (
    <div>
      <button onClick={() => onSelectRole('teacher')} disabled={isLoading}>
        선생님
      </button>
      <button onClick={() => onSelectRole('student')} disabled={isLoading}>
        학생
      </button>
    </div>
  );
} 