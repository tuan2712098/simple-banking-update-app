'use client';

import { FormEvent, useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navigation from '../../components/Navigation';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { errorMessage } from '../../components/ErrorNotice';
import { useRouter } from 'next/navigation';
import AppIcon from '../../components/AppIcon';
import { userRoleLabel } from '../../lib/labels';
import PasswordField from '../../components/PasswordField';
import PasswordStrength from '../../components/PasswordStrength';
import { passwordFeedback } from '../../lib/passwordPolicy';
import TransactionPinSettings from '../../components/TransactionPinSettings';

export default function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const reset = useAuthStore((state) => state.reset);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<{ id: string; previousEmail: string; updatedEmail: string; createdAt: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    api.get<typeof history>('/accounts/me/history').then(({ data }) => setHistory(data)).catch(() => {});
  }, [user]);

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await api.patch('/accounts/me/email', { email });
      reset();
      router.replace('/login');
    } catch (err) { setError(errorMessage(err)); }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!passwordFeedback(newPassword, user?.email).valid) return setError('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.');
    if (newPassword !== confirmPassword) return setError('Hai lần nhập mật khẩu mới không trùng khớp.');
    if (currentPassword === newPassword) return setError('Mật khẩu mới phải khác mật khẩu đang sử dụng.');
    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      reset();
      router.replace('/login?passwordChanged=1');
    } catch (err) { setError(errorMessage(err)); } finally { setChangingPassword(false); }
  }

  const initials = user?.fullName?.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'SB';
  return <ProtectedRoute><main className="dashboard-page"><Navigation title="Tài khoản của tôi" />
    <section className="dashboard-content"><div className="inner-page-heading"><div className="eyebrow"><span className="eyebrow-dot"/> THÔNG TIN CÁ NHÂN</div><h2>Không gian riêng của bạn.</h2><p>Quản lý thông tin đăng nhập và bảo mật tài khoản.</p></div>
      <section className="profile-hero"><div className="profile-avatar">{initials}</div><div><span className="eyebrow eyebrow-small">HỒ SƠ CÁ NHÂN</span><h2>{user?.fullName}</h2><p>{user?.email}</p></div><span className="profile-role"><AppIcon name="shield" size={15}/>{user?.role ? userRoleLabel(user.role) : 'Người dùng'}</span></section>
      <div className="two-col account-forms"><section className="page-card"><div className="card-heading-icon"><span className="head-icon"><AppIcon name="mail" size={22}/></span><div><span className="eyebrow eyebrow-small">LIÊN HỆ</span><h3>Thay đổi email</h3></div></div><p className="card-description">Cập nhật email đăng nhập. Bạn sẽ cần đăng nhập lại sau khi thay đổi.</p>
        <form onSubmit={updateEmail}><label htmlFor="email">Địa chỉ email mới</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><button className="primary-submit" type="submit">Cập nhật email <AppIcon name="arrow-right" size={17}/></button></form></section>
        <section className="page-card"><div className="card-heading-icon"><span className="head-icon"><AppIcon name="lock" size={22}/></span><div><span className="eyebrow eyebrow-small">BẢO MẬT</span><h3>Đổi mật khẩu</h3></div></div><p className="card-description">Đặt mật khẩu mới và bảo vệ tài khoản của bạn.</p>
        <form onSubmit={updatePassword}>
          <PasswordField id="current" label="Mật khẩu hiện tại" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField id="replacement" label="Mật khẩu mới" value={newPassword} onChange={setNewPassword} autoComplete="new-password" minLength={15} placeholder="Ít nhất 15 ký tự" />
          <PasswordStrength value={newPassword} email={user?.email} />
          <PasswordField id="confirm-replacement" label="Xác nhận mật khẩu mới" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" />
          {confirmPassword && newPassword !== confirmPassword && <p className="password-mismatch" role="alert">Hai mật khẩu mới chưa trùng khớp.</p>}
          <p className="password-session-note"><AppIcon name="shield" size={16}/> Sau khi đổi mật khẩu, bạn cần đăng nhập lại trên các thiết bị.</p>
          <button className="primary-submit" type="submit" disabled={changingPassword || !currentPassword || !passwordFeedback(newPassword,user?.email).valid || newPassword !== confirmPassword}>{changingPassword ? 'Đang cập nhật...' : 'Đổi mật khẩu'} <AppIcon name="arrow-right" size={17}/></button>
        </form></section></div>
      {user?.role === 'customer' && <TransactionPinSettings />}
      {error && <div className="form-error">{error}</div>}
      <section className="page-card email-history-card"><div className="card-heading-icon"><span className="head-icon"><AppIcon name="history" size={22}/></span><div><span className="eyebrow eyebrow-small">LỊCH SỬ THAY ĐỔI</span><h3>Cập nhật email</h3></div></div>
        {history.length === 0 ? <div className="recent-empty compact"><strong>Chưa có thay đổi nào</strong><p>Lịch sử cập nhật email sẽ xuất hiện tại đây.</p></div> : history.map((item) => <div className="email-history-row" key={item.id}><div>{item.previousEmail} <AppIcon name="arrow-right" size={14}/> {item.updatedEmail}</div><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></div>)}</section>
    </section>
  </main></ProtectedRoute>;
}
