// SocialLoginButton placeholder

interface SocialLoginButtonProps {
  provider: 'google' | 'kakao';
  onClick: () => void;
  disabled?: boolean;
}

export default function SocialLoginButton({ provider, onClick, disabled }: SocialLoginButtonProps) {
  // Implement button UI here
  return (
    <button onClick={onClick} disabled={disabled}>
      {provider === 'google' ? 'Google 로그인' : 'Kakao 로그인'}
    </button>
  );
} 