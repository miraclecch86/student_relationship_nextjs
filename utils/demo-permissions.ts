/**
 * 데모 학급 권한 관리 유틸리티
 * 
 * 데모 학급은 모든 사용자가 볼 수 있지만 수정할 수 없도록 관리
 */

interface ClassData {
  id: string;
  name: string;
  user_id: string;
  is_demo?: boolean;
  is_public?: boolean;
  created_at: string;
}

interface StudentData {
  id: string;
  class_id: string;
  name: string;
  // ... 다른 필드들
}

// 🔑 관리자 이메일 목록 (환경 변수로 관리 권장)
const ADMIN_EMAILS = [
  'admin@example.com',
  'developer@example.com',
  // 필요에 따라 추가
];

/**
 * 관리자 권한 확인
 */
export const isAdmin = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_EMAILS.includes(userEmail.toLowerCase());
};

/**
 * 개발 모드 확인
 */
export const isDevelopmentMode = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * 데모 학급인지 확인
 */
export const isDemoClass = (classData: ClassData): boolean => {
  return Boolean(classData.is_demo && classData.is_public);
};

/**
 * 학급 편집 권한 확인
 */
export const canEditClass = (classData: ClassData, userId: string | null, userEmail?: string | null): boolean => {
  // 데모 학급은 기본적으로 편집 불가
  if (isDemoClass(classData)) {
    // 🔧 단, 관리자이거나 개발 모드에서는 편집 가능
    return isAdmin(userEmail) || isDevelopmentMode();
  }

  // 일반 학급은 소유자만 편집 가능
  return classData.user_id === userId;
};

/**
 * 학급 삭제 권한 확인
 */
export const canDeleteClass = (classData: ClassData, userId: string | null, userEmail?: string | null): boolean => {
  // 데모 학급은 관리자도 삭제 불가 (보호)
  if (isDemoClass(classData)) {
    return false;
  }

  // 일반 학급은 소유자만 삭제 가능
  return classData.user_id === userId;
};

/**
 * 🆕 데모 학급 복사 권한 확인
 */
export const canCopyDemoClass = (userId: string | null): boolean => {
  return userId !== null; // 로그인한 사용자는 모두 복사 가능
};

/**
 * 학생 추가/수정/삭제 권한 확인
 */
export const canManageStudents = (classData: ClassData, userId: string | null, userEmail?: string | null): boolean => {
  return canEditClass(classData, userId, userEmail);
};

/**
 * 설문 관리 권한 확인
 */
export const canManageSurveys = (classData: ClassData, userId: string | null, userEmail?: string | null): boolean => {
  return canEditClass(classData, userId, userEmail);
};

/**
 * 관계 데이터 수정 권한 확인
 */
export const canEditRelations = (classData: ClassData, userId: string | null, userEmail?: string | null): boolean => {
  return canEditClass(classData, userId, userEmail);
};

/**
 * 데모 학급 배지 텍스트 반환
 */
export const getDemoBadgeText = (): string => {
  return "🌟 체험용 학급";
};

/**
 * 데모 학급 안내 메시지 반환
 */
export const getDemoNoticeMessage = (): string => {
  return "💡 이것은 체험용 학급입니다. 실제 데이터 입력을 위해 새 학급을 만들어보세요!";
};

/**
 * 🆕 데모 학급 복사 안내 메시지
 */
export const getDemoCopyMessage = (): string => {
  return "📋 이 데모 학급을 내 계정으로 복사하여 자유롭게 수정하고 분석해보세요!";
};

/**
 * 데모 학급에서 수정 시도 시 에러 메시지
 */
export const getDemoEditErrorMessage = (): string => {
  return "❌ 체험용 학급은 수정할 수 없습니다. 새로운 학급을 만들거나 복사해서 사용해보세요!";
};

/**
 * 🆕 데모 학급 관계 수정 시도 시 친절한 안내 메시지
 */
export const getDemoRelationEditMessage = (): string => {
  return "🌟 체험판 안내\n\n관계 설정 변경사항은 저장되지 않습니다.\n\n실제 학급을 생성하시면 모든 기능을 자유롭게 사용하실 수 있습니다.";
};

/**
 * 🆕 데모 학급에서 데이터 저장 시도를 차단하고 메시지를 반환하는 함수
 */
export const handleDemoSaveAttempt = (classData: ClassData, action?: string): {
  canSave: boolean;
  message?: string;
  isDemo: boolean;
} => {
  const isDemo = isDemoClass(classData);

  if (isDemo) {
    // 🔧 개발 모드에서는 저장 허용
    if (isDevelopmentMode()) {
      return {
        canSave: true,
        isDemo: true
      };
    }

    const actionText = action || "수정 내용";
    return {
      canSave: false,
      message: `🌟 체험판 안내\n\n${actionText}은 저장되지 않습니다.\n\n실제 학급을 생성하시면 모든 기능을 자유롭게 사용하실 수 있습니다.`,
      isDemo: true
    };
  }

  return {
    canSave: true,
    isDemo: false
  };
};

/**
 * 읽기 전용 권한인지 확인 (데모 학급 또는 다른 사용자 학급)
 */
export const isReadOnlyAccess = (classData: ClassData, userId: string | null, userEmail?: string | null): boolean => {
  if (isDemoClass(classData)) {
    // 관리자나 개발 모드에서는 편집 가능
    return !(isAdmin(userEmail) || isDevelopmentMode());
  }
  return classData.user_id !== userId;
};

/**
 * 액션 버튼 표시 여부 결정
 */
export const shouldShowActionButtons = (
  classData: ClassData,
  userId: string | null,
  action: 'edit' | 'delete' | 'add_student' | 'create_survey' | 'copy_demo',
  userEmail?: string | null
): boolean => {
  switch (action) {
    case 'edit':
      return canEditClass(classData, userId, userEmail);
    case 'delete':
      return canDeleteClass(classData, userId, userEmail);
    case 'add_student':
      return canManageStudents(classData, userId, userEmail);
    case 'create_survey':
      return canManageSurveys(classData, userId, userEmail);
    case 'copy_demo':
      return isDemoClass(classData) && canCopyDemoClass(userId);
    default:
      return false;
  }
};

/**
 * 데모 학급 필터링 (학급 목록에서 사용)
 */
export const filterDemoClasses = (classes: ClassData[]): ClassData[] => {
  return classes.filter(classData => isDemoClass(classData));
};

/**
 * 사용자 학급 필터링 (학급 목록에서 사용)
 */
export const filterUserClasses = (classes: ClassData[], userId: string | null): ClassData[] => {
  return classes.filter(classData => !isDemoClass(classData) && classData.user_id === userId);
};

/**
 * 전체 학급 정렬 (데모 학급을 맨 위에)
 */
export const sortClassesWithDemoFirst = (classes: ClassData[]): ClassData[] => {
  return classes.sort((a, b) => {
    const aIsDemo = isDemoClass(a);
    const bIsDemo = isDemoClass(b);

    if (aIsDemo && !bIsDemo) return -1;
    if (!aIsDemo && bIsDemo) return 1;

    // 같은 타입이면 생성일 기준 정렬
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

/**
 * 권한별 CSS 클래스 반환
 */
export const getPermissionClasses = (classData: ClassData, userId: string | null, userEmail?: string | null): string => {
  if (isDemoClass(classData)) {
    const canEdit = canEditClass(classData, userId, userEmail);
    return canEdit ? "demo-class editable admin" : "demo-class read-only";
  }

  if (canEditClass(classData, userId)) {
    return "user-class editable";
  }

  return "other-class read-only";
};

/**
 * API 호출 전 권한 체크
 */
export const validateApiPermission = (
  classData: ClassData,
  userId: string | null,
  operation: 'create' | 'read' | 'update' | 'delete' | 'copy',
  userEmail?: string | null
): { allowed: boolean; message?: string } => {

  if (operation === 'read') {
    return { allowed: true };
  }

  if (operation === 'copy' && isDemoClass(classData)) {
    return canCopyDemoClass(userId)
      ? { allowed: true }
      : { allowed: false, message: "로그인이 필요합니다." };
  }

  if (isDemoClass(classData)) {
    const canEdit = isAdmin(userEmail) || isDevelopmentMode();
    if (!canEdit) {
      return {
        allowed: false,
        message: getDemoEditErrorMessage()
      };
    }
  }

  if (classData.user_id !== userId && !isAdmin(userEmail)) {
    return {
      allowed: false,
      message: "이 학급을 수정할 권한이 없습니다."
    };
  }

  return { allowed: true };
};

/**
 * 🆕 권한 상태 메시지 생성
 */
export const getPermissionStatusMessage = (
  classData: ClassData,
  userId: string | null,
  userEmail?: string | null
): string => {
  if (isDemoClass(classData)) {
    if (isAdmin(userEmail)) {
      return "🔧 관리자 권한으로 편집 가능합니다";
    }
    if (isDevelopmentMode()) {
      return "🛠️ 개발 모드에서 편집 가능합니다";
    }
    return "👀 읽기 전용 모드입니다 (복사하여 편집 가능)";
  }

  if (classData.user_id === userId) {
    return "✏️ 편집 가능한 내 학급입니다";
  }

  return "👀 읽기 전용 학급입니다";
};

// 타입 가드 함수들
export const isClassData = (obj: any): obj is ClassData => {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
};

export const isStudentData = (obj: any): obj is StudentData => {
  return obj && typeof obj.id === 'string' && typeof obj.class_id === 'string';
}; 