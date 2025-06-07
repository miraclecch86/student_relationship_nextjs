import { useCallback, useRef } from 'react';

interface UseAutoSaveOptions<T> {
  delay?: number; // 지연 시간 (ms), 기본값: 1000ms
  onSave: (value: T) => Promise<void> | void;
  enabled?: boolean; // 자동저장 활성화 여부, 기본값: true
}

export function useAutoSave<T>({ delay = 1000, onSave, enabled = true }: UseAutoSaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<T | null>(null);

  const debouncedSave = useCallback((value: T) => {
    if (!enabled) return;

    // 이전 타이머 제거
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 값이 변경되지 않았으면 저장하지 않음
    if (lastValueRef.current !== null && JSON.stringify(lastValueRef.current) === JSON.stringify(value)) {
      return;
    }

    // 새로운 타이머 설정
    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(value);
        lastValueRef.current = value;
        console.log('자동저장 완료:', value);
      } catch (error) {
        console.error('자동저장 실패:', error);
      }
    }, delay);
  }, [delay, onSave, enabled]);

  const immediateeSave = useCallback(async (value: T) => {
    if (!enabled) return;

    // 타이머 제거
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      await onSave(value);
      lastValueRef.current = value;
      console.log('즉시저장 완료:', value);
    } catch (error) {
      console.error('즉시저장 실패:', error);
    }
  }, [onSave, enabled]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    autoSave: debouncedSave,
    immediateeSave,
    cancel
  };
}

// 특정 입력 필드에 자동저장을 적용하는 훅
export function useInputAutoSave<T extends string | number>({
  initialValue,
  onSave,
  delay = 1000,
  enabled = true
}: {
  initialValue: T;
  onSave: (value: T) => Promise<void> | void;
  delay?: number;
  enabled?: boolean;
}) {
  const { autoSave, immediateeSave, cancel } = useAutoSave<T>({ delay, onSave, enabled });

  const handleChange = useCallback((newValue: T) => {
    autoSave(newValue);
  }, [autoSave]);

  const handleBlur = useCallback((value: T) => {
    immediateeSave(value);
  }, [immediateeSave]);

  return {
    handleChange,
    handleBlur,
    cancel
  };
} 