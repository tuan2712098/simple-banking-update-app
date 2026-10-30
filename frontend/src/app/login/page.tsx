'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { AuthUser, useAuthStore } from '../../store/authStore';
import { errorMessage } from '../../components/ErrorNotice';
import AppIcon from '../../components/AppIcon';
import { homeForRole } from '../../lib/roleRoutes';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) return setError('Nhập email và mật khẩu nhé.');
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<{ user: AuthUser; accessToken: string }>('/auth/login', { email: email.trim(), password });
      setAuth(data.user, data.accessToken);
      router.replace(data.user.role === 'customer' && data.user.pinConfigured !== true ? '/setup-pin' : homeForRole(data.user.role));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page"><div className="auth-layout">
    <section className="auth-showcase"><div className="showcase-glow showcase-glow-one"/><div className="showcase-glow showcase-glow-two"/><div className="showcase-content"><div className="showcase-logo"><span className="brand-emblem"><AppIcon name="layers" size={23}/></span><strong>Lumi<span>Bank</span></strong></div><div className="showcase-copy"><span className="showcase-eyebrow"><AppIcon name="sparkles" size={16}/> NGÂN HÀNG SỐ CỦA BẠN</span><h1>Tài chính vững vàng.<br/><em>Cuộc sống thảnh thơi.</em></h1><p>Trải nghiệm quản lý tài khoản, chuyển tiền và theo dõi giao dịch đơn giản trong một không gian hiện đại.</p></div><div className="showcase-mini-card"><div className="showcase-mini-icon"><AppIcon name="shield" size={24}/></div><div><strong>An tâm trên mỗi giao dịch</strong><span>Ưu tiên sự riêng tư và an toàn dữ liệu</span></div><AppIcon name="check" size={20}/></div></div><div className="showcase-footer">LUMIBANK · ỨNG DỤNG MÔ PHỎNG</div></section>
    <section className="auth-form-pane"><div className="auth-mobile-logo"><span className="brand-emblem"><AppIcon name="layers" size={21}/></span><strong>LumiBank</strong></div><div className="auth-card"><span className="eyebrow eyebrow-small">CHÀO MỪNG TRỞ LẠI</span><h2>Đăng nhập tài khoản</h2><p className="auth-description">Rất vui được gặp lại bạn. Hãy đăng nhập để tiếp tục.</p>
      <form onSubmit={submit} autoComplete="off"><label htmlFor="email">Địa chỉ email</label><div className="field-shell"><AppIcon name="mail" size={19}/><input id="email" name="banking_login_email_manual" type="email" value={email} placeholder="tenban@example.com" onChange={(event) => setEmail(event.target.value)} autoComplete="off" required /></div>
      <label htmlFor="password">Mật khẩu</label><div className="field-shell"><AppIcon name="lock" size={19}/><input id="password" name="banking_login_password_manual" type="password" value={password} placeholder="Nhập mật khẩu" onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></div>
      {error && <div className="form-error">{error}</div>}<button className="primary-submit" type="submit" disabled={loading}>{loading ? 'Đang đăng nhập...' : <>Đăng nhập <AppIcon name="arrow-right" size={18}/></>}</button></form>
      <p className="auth-switch">Bạn chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link></p></div><div className="auth-form-bottom"><AppIcon name="shield" size={15}/> Kết nối được bảo vệ · Môi trường demo</div>
    </section>
  </div></main>;
}
