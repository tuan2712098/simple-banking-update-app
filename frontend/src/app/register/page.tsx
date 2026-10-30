'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { AuthUser, useAuthStore } from '../../store/authStore';
import { errorMessage } from '../../components/ErrorNotice';
import AppIcon from '../../components/AppIcon';
import PasswordField from '../../components/PasswordField';
import PasswordStrength from '../../components/PasswordStrength';
import { passwordFeedback } from '../../lib/passwordPolicy';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2 || !email.includes('@')) return setError('Kiểm tra lại họ tên và địa chỉ email.');
    if (!passwordFeedback(password, email).valid) return setError('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.');
    if (password !== confirmPassword) return setError('Hai lần nhập mật khẩu không trùng khớp.');
    if (!/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || ['123456', '654321'].includes(pin)) return setError('PIN phải gồm 6 số và không được quá dễ đoán.');
    if (pin !== confirmPin) return setError('Hai lần nhập PIN không trùng khớp.');
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<{ user: AuthUser; accessToken: string }>('/auth/register', { fullName: fullName.trim(), email: email.trim(), password, pin });
      setAuth(data.user, data.accessToken);
      router.replace('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page"><div className="auth-layout">
    <section className="auth-showcase"><div className="showcase-glow showcase-glow-one"/><div className="showcase-glow showcase-glow-two"/><div className="showcase-content"><div className="showcase-logo"><span className="brand-emblem"><AppIcon name="layers" size={23}/></span><strong>Lumi<span>Bank</span></strong></div><div className="showcase-copy"><span className="showcase-eyebrow"><AppIcon name="sparkles" size={16}/> BẮT ĐẦU HÀNH TRÌNH</span><h1>Mọi khởi đầu lớn<br/><em>đều thật đơn giản.</em></h1><p>Tạo tài khoản và trải nghiệm ứng dụng ngân hàng mô phỏng theo cách của riêng bạn.</p></div><div className="showcase-mini-card"><div className="showcase-mini-icon"><AppIcon name="shield" size={24}/></div><div><strong>Thông tin luôn được chú trọng</strong><span>Thiết kế tập trung vào trải nghiệm an toàn</span></div><AppIcon name="check" size={20}/></div></div><div className="showcase-footer">LUMIBANK · ỨNG DỤNG MÔ PHỎNG</div></section>
    <section className="auth-form-pane"><div className="auth-mobile-logo"><span className="brand-emblem"><AppIcon name="layers" size={21}/></span><strong>LumiBank</strong></div><div className="auth-card"><span className="eyebrow eyebrow-small">ĐĂNG KÝ THÀNH VIÊN</span><h2>Tạo tài khoản mới</h2><p className="auth-description">Bắt đầu với một vài thông tin cơ bản.</p>
      <form onSubmit={submit}><label htmlFor="name">Họ và tên</label><div className="field-shell"><AppIcon name="user" size={19}/><input id="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nhập họ và tên" minLength={2} maxLength={150} required /></div>
      <label htmlFor="email">Địa chỉ email</label><div className="field-shell"><AppIcon name="mail" size={19}/><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tenban@example.com" required /></div>
      <PasswordField id="password" label="Mật khẩu mới" value={password} onChange={setPassword} autoComplete="new-password" placeholder="Ít nhất 8 ký tự" shell minLength={8} />
      <PasswordStrength value={password} email={email} />
      <PasswordField id="confirm-password" label="Nhập lại mật khẩu" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" shell />
      {confirmPassword && password !== confirmPassword && <p className="password-mismatch" role="alert">Hai mật khẩu chưa trùng khớp.</p>}
      <div className="pin-onboard-intro"><AppIcon name="shield" size={19}/><div><strong>Tạo mã PIN giao dịch ngay từ đầu</strong><p>PIN 6 số dùng riêng khi chuyển tiền, không phải mật khẩu đăng nhập.</p></div></div>
      <label htmlFor="registerPin">Mã PIN giao dịch (6 số)</label><div className="field-shell"><AppIcon name="lock" size={18}/><input id="registerPin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập 6 chữ số" required /></div>
      <label htmlFor="registerConfirmPin">Xác nhận mã PIN giao dịch</label><div className="field-shell"><AppIcon name="lock" size={18}/><input id="registerConfirmPin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập lại PIN" required /></div>
      {confirmPin && pin !== confirmPin && <p className="password-mismatch" role="alert">Hai mã PIN chưa trùng khớp.</p>}
      {error && <div className="form-error">{error}</div>}<button className="primary-submit" type="submit" disabled={loading || !passwordFeedback(password,email).valid || password !== confirmPassword || !/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || ['123456','654321'].includes(pin) || pin !== confirmPin}>{loading ? 'Đang tạo tài khoản...' : <>Tạo tài khoản <AppIcon name="arrow-right" size={18}/></>}</button></form>
      <p className="auth-switch">Bạn đã có tài khoản? <Link href="/login">Đăng nhập</Link></p></div><div className="auth-form-bottom"><AppIcon name="shield" size={15}/> Kết nối được bảo vệ · Môi trường demo</div>
    </section>
  </div></main>;
}
