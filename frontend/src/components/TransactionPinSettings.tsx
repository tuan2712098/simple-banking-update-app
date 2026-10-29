'use client';

import { FormEvent, useEffect, useState } from 'react';
import api from '../lib/api';
import { errorMessage } from './ErrorNotice';

type PinStatus = { pinConfigured: boolean; pinLocked?: boolean };

export default function TransactionPinSettings() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    api.get<PinStatus>('/transaction-security/pin-status')
      .then(({ data }) => {
        if (!active) return;
        setConfigured(data.pinConfigured);
        setLocked(Boolean(data.pinLocked));
      })
      .catch(() => {
        if (active) setError('Không tải được trạng thái PIN. Vui lòng tải lại trang.');
      });
    return () => { active = false; };
  }, []);

  function clearFields() {
    setCurrentPassword('');
    setCurrentPin('');
    setPin('');
    setConfirmPin('');
  }

  function beginChange() {
    clearFields();
    setError('');
    setSuccess('');
    setEditing(true);
  }

  function cancelChange() {
    clearFields();
    setError('');
    setEditing(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!/^\d{6}$/.test(pin) || pin !== confirmPin) {
      setError('PIN mới phải gồm đúng 6 chữ số và trùng với phần xác nhận.');
      return;
    }
    if (configured === true && !/^\d{6}$/.test(currentPin)) {
      setError('Vui lòng nhập PIN hiện tại gồm 6 chữ số.');
      return;
    }
    if (configured === false && !currentPassword) {
      setError('Vui lòng nhập mật khẩu đăng nhập để thiết lập PIN lần đầu.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/transaction-security/pin',
        configured === true ? { currentPin, pin } : { currentPassword, pin });
      setConfigured(true);
      setLocked(false);
      setEditing(false);
      setSuccess(configured ? 'Đổi PIN giao dịch thành công.' : 'Thiết lập PIN giao dịch thành công.');
      clearFields();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const showForm = configured === false || (configured === true && editing);
  const ready = /^\d{6}$/.test(pin) && pin === confirmPin &&
    (configured === true ? /^\d{6}$/.test(currentPin) : Boolean(currentPassword));

  return <section className="page-card transaction-pin-settings">
    <h3>Mã PIN giao dịch</h3>
    {configured === null ? (
      <p className="card-description">Đang kiểm tra trạng thái PIN...</p>
    ) : configured && !editing ? (
      <div className="pin-status-panel">
        <div className="pin-status-icon" aria-hidden="true">✓</div>
        <div className="pin-status-copy">
          <strong>PIN giao dịch đã được thiết lập</strong>
          <p>Bạn sẽ dùng mã PIN 6 số khi xác thực giao dịch. Không cần thiết lập lại.</p>
          {locked && <p className="form-error">PIN đang bị khóa tạm thời do nhập sai nhiều lần.</p>}
        </div>
        <button type="button" className="pin-change-button" onClick={beginChange}>Đổi PIN</button>
      </div>
    ) : (
      <p className="card-description">
        {configured ? 'Để đổi PIN, nhập PIN hiện tại rồi tạo PIN mới.' :
          'Thiết lập PIN 6 số lần đầu để xác thực khi chuyển tiền.'}
      </p>
    )}

    {showForm && <form onSubmit={save} autoComplete="off">
      {configured ? <>
        <label htmlFor="currentTransactionPin">PIN hiện tại</label>
        <input id="currentTransactionPin" type="password" inputMode="numeric" autoComplete="off"
          maxLength={6} pattern="[0-9]{6}" value={currentPin}
          onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
      </> : <>
        <label htmlFor="pinPassword">Mật khẩu đăng nhập để xác minh</label>
        <input id="pinPassword" type="password" autoComplete="current-password"
          value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
      </>}
      <label htmlFor="newPin">PIN mới (6 số)</label>
      <input id="newPin" type="password" inputMode="numeric" autoComplete="off"
        maxLength={6} pattern="[0-9]{6}" value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
      <label htmlFor="confirmPin">Nhập lại PIN mới</label>
      <input id="confirmPin" type="password" inputMode="numeric" autoComplete="off"
        maxLength={6} pattern="[0-9]{6}" value={confirmPin}
        onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="pin-form-actions">
        {configured && <button type="button" className="pin-cancel-button" disabled={busy} onClick={cancelChange}>Hủy</button>}
        <button className="primary-submit" type="submit" disabled={busy || !ready}>
          {busy ? 'Đang lưu...' : configured ? 'Xác nhận đổi PIN' : 'Thiết lập PIN giao dịch'}
        </button>
      </div>
    </form>}
    {success && <p className="form-success" role="status">{success}</p>}
    {!showForm && error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
