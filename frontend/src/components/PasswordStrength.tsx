import { passwordFeedback } from '../lib/passwordPolicy';

export default function PasswordStrength({ value, email }: { value: string; email?: string }) {
  const result = passwordFeedback(value, email);
  return <div className="password-strength" aria-live="polite">
    <div className="password-strength-head"><span>Độ mạnh mật khẩu (tham khảo)</span><strong>{value ? result.title : 'Chưa nhập'}</strong></div>
    <div className="password-strength-bars" aria-hidden="true">
      {[1,2,3,4].map((index) => <i key={index} className={index <= result.level ? `active level-${result.level}` : ''} />)}
    </div>
    <p className={value && !result.valid ? 'password-hint needs-work' : 'password-hint'}>{result.hint}</p>
  </div>;
}
