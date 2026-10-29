'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import AppIcon from '../../components/AppIcon';
import { errorMessage } from '../../components/ErrorNotice';
import { useAuthStore } from '../../store/authStore';
import { homeForRole } from '../../lib/roleRoutes';

export default function SetupPinPage() {
  const router = useRouter();
  const { user, ready, markPinConfigured, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'customer' || user.pinConfigured === true) router.replace(homeForRole(user.role));
  }, [ready, user, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || ['123456', '654321'].includes(pin)) {
      setError('PIN phải gồm 6 số và không được quá dễ đoán.'); return;
    }
    if (pin !== confirmation) { setError('Hai lần nhập PIN không trùng khớp.'); return; }
    if (!currentPassword) { setError('Nhập mật khẩu đăng nhập để xác minh.'); return; }
    setBusy(true);
    try {
      await api.post('/transaction-security/pin', { currentPassword, pin });
      markPinConfigured();
      router.replace('/dashboard');
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  if (!ready || !user || user.role !== 'customer' || user.pinConfigured === true) {
    return <main className="auth-page"><div className="status-card">Đang kiểm tra tài khoản...</div></main>;
  }

  return <main className="auth-page"><div className="pin-onboard-card">
    <div className="pin-onboard-badge"><AppIcon name="shield" size={23}/></div>
    <span className="eyebrow eyebrow-small">KÍCH HOẠT BẢO MẬT TÀI KHOẢN</span>
    <h1>Thiết lập PIN trước khi bắt đầu</h1>
    <p className="auth-description">Tài khoản của bạn được tạo trước khi có tính năng PIN. Bạn chỉ cần thiết lập một lần ở bước kích hoạt, không phải chờ đến lúc chuyển khoản.</p>
    <form onSubmit={submit} autoComplete="off">
      <label htmlFor="passwordVerification">Xác nhận mật khẩu đăng nhập hiện tại</label>
      <input id="passwordVerification" type="password" value={currentPassword} autoComplete="current-password" onChange={event => setCurrentPassword(event.target.value)} required />
      <label htmlFor="initialPin">Tạo mã PIN giao dịch (6 số)</label>
      <input id="initialPin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} pattern="[0-9]{6}" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0,6))} required />
      <label htmlFor="initialPinConfirmation">Nhập lại mã PIN</label>
      <input id="initialPinConfirmation" type="password" inputMode="numeric" autoComplete="off" maxLength={6} pattern="[0-9]{6}" value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/\D/g, '').slice(0,6))} required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-submit" type="submit" disabled={busy || !currentPassword || pin.length !== 6 || pin !== confirmation}>{busy ? 'Đang thiết lập...' : 'Kích hoạt tài khoản'}</button>
    </form>
    <p className="pin-onboard-note">PIN được băm trước khi lưu. Tuyệt đối không chia sẻ PIN hoặc OTP cho người khác.</p>
    <button className="pin-onboard-signout" type="button" onClick={async () => { await logout(); router.replace('/login'); }}>Đăng xuất</button>
  </div></main>;
}
