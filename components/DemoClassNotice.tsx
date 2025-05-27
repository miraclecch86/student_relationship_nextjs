import React from 'react';
import { getDemoNoticeMessage, getDemoBadgeText, getDemoCopyMessage } from '@/utils/demo-permissions';

interface DemoClassNoticeProps {
  className?: string;
  variant?: 'banner' | 'card' | 'inline';
  onCopyDemoClass?: () => void;
}

/**
 * 데모 학급 안내 컴포넌트
 * 
 * 사용자에게 현재 보고 있는 학급이 체험용임을 알리고
 * 실제 기능 사용을 위한 안내를 제공
 */
export const DemoClassNotice: React.FC<DemoClassNoticeProps> = ({ 
  className = '', 
  variant = 'banner',
  onCopyDemoClass
}) => {
  
  const baseClasses = "demo-notice";
  
  const variantClasses = {
    banner: "bg-blue-50 border-blue-200 text-blue-800 p-4 rounded-lg border-l-4 border-l-blue-400",
    card: "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm",
    inline: "bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
  };
  
  if (variant === 'inline') {
    return (
      <div className={`${baseClasses} ${variantClasses[variant]} ${className} flex items-center gap-2`}>
        <span>👁️</span>
        <span>{getDemoBadgeText()}</span>
      </div>
    );
  }
  
  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <span className="text-2xl">✨</span>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-blue-900">
              {getDemoBadgeText()} - 샘솔 초등학교 3학년 1반
            </h4>
            <span className="text-blue-600">🔒</span>
          </div>
          
          <p className="text-blue-700 mb-3">
            {getDemoNoticeMessage()}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">👁️</span>
              <span>모든 기능을 자유롭게 탐색해보세요</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">⚠️</span>
              <span>데이터 수정은 불가능합니다</span>
            </div>
          </div>
          
          {variant === 'card' && (
            <div className="mt-4 pt-3 border-t border-blue-200">
              <div className="flex gap-3">
                <button 
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  onClick={onCopyDemoClass}
                  disabled={!onCopyDemoClass}
                >
                  <span>📋</span>
                  내 계정으로 복사하기
                </button>
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => {
                    // TODO: 새 학급 생성 페이지로 이동
                    console.log('새 학급 생성으로 이동');
                  }}
                >
                  새 학급 만들기 →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 데모 학급 배지 컴포넌트 (간단한 표시용)
 */
export const DemoBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <DemoClassNotice variant="inline" className={className} />
  );
};

/**
 * 편집 시도 시 표시되는 경고 컴포넌트
 */
interface DemoEditWarningProps {
  action: string;
  onClose?: () => void;
  onCreateNewClass?: () => void;
  onCopyDemoClass?: () => void;
}

export const DemoEditWarning: React.FC<DemoEditWarningProps> = ({ 
  action, 
  onClose, 
  onCreateNewClass,
  onCopyDemoClass
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-red-600 text-xl">🔒</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">편집 불가</h3>
            <p className="text-sm text-gray-600">체험용 학급입니다</p>
          </div>
        </div>
        
        <p className="text-gray-700 mb-4">
          <strong>"{action}"</strong> 기능은 체험용 학급에서 사용할 수 없습니다. 
          이 학급을 복사하거나 새로운 학급을 만들어서 실제 데이터를 관리해보세요!
        </p>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={onCopyDemoClass}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
            disabled={!onCopyDemoClass}
          >
            <span>📋</span>
            이 학급을 내 계정으로 복사하기
          </button>
          <button
            onClick={onCreateNewClass}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            새 학급 만들기
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 🆕 복사 진행 상황 모달
 */
interface CopyProgressModalProps {
  isVisible: boolean;
  progress: {
    step: string;
    current: number;
    total: number;
    message: string;
  };
}

export const CopyProgressModal: React.FC<CopyProgressModalProps> = ({ 
  isVisible, 
  progress 
}) => {
  if (!isVisible) return null;
  
  const progressPercentage = Math.round((progress.current / progress.total) * 100);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">📋</span>
          </div>
          <h3 className="font-semibold text-gray-900">데모 학급 복사 중</h3>
          <p className="text-sm text-gray-600">잠시만 기다려주세요...</p>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>{progress.step}</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
        
        <p className="text-sm text-gray-600 text-center">
          {progress.message}
        </p>
      </div>
    </div>
  );
};

export default DemoClassNotice; 