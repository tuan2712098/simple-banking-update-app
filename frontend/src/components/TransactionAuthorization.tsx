'use client';

import { FormEvent, useState } from 'react';
import api from '../lib/api';
import { errorMessage } from './ErrorNotice';

export type PaymentAction = 'transfer' | 'transfer-optimistic' | 'teller-transfer' | 'deposit' | 'reverse';
type Challenge = {challengeId:string;expiresAt:string;delivery:string;demoOtp?:string};

type Props = {
  action:PaymentAction;
  payload:Record<string,string>;
  requirePin?:boolean;
  busy?:boolean;
  onAuthorized:(authorizationToken:string)=>Promise<void>;
  onCancel:()=>void;
};

export default function TransactionAuthorization({action,payload,requirePin=false,busy=false,onAuthorized,onCancel}:Props) {
  const [pin,setPin] = useState('');
  const [otp,setOtp] = useState('');
  const [challenge,setChallenge] = useState<Challenge|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [verified,setVerified] = useState(false);
  const isLoading = loading || busy;
  async function requestOtp(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (isLoading) return;
    setError('');setLoading(true);
    try {
      const {data} = await api.post<Challenge>('/transaction-security/request',{action,payload,...(requirePin?{pin}:{})});
      setChallenge(data);setPin('');
    } catch(err) {setError(errorMessage(err));}
    finally {setLoading(false);}
  }
  async function verifyOtp(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if (!challenge || isLoading || verified) return;
    setError('');setLoading(true);
    try {
      const {data} = await api.post<{authorizationToken:string}>('/transaction-security/verify',{challengeId:challenge.challengeId,otp});
      setVerified(true);setOtp('');
      await onAuthorized(data.authorizationToken);
    } catch(err) {
      setVerified(false);setError(errorMessage(err));
    } finally {setLoading(false);}
  }
  return <section className="transaction-auth-panel" aria-label="Bảo mật giao dịch">
    <div className="transaction-auth-heading"><span>🔐</span><div><h3>Xác thực giao dịch</h3><p>{challenge?'Bước cuối: nhập OTP để hoàn tất':'Xác nhận thông tin trước khi gửi OTP'}</p></div></div>
    {!challenge ? <form onSubmit={requestOtp} autoComplete="off">
      {requirePin ? <><label htmlFor="paymentPin">Mã PIN giao dịch (6 số)</label>
        <input id="paymentPin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} required />
        <p className="transaction-auth-help">Đây là mã PIN riêng, không phải mật khẩu đăng nhập. PIN được thiết lập khi mở tài khoản.</p></> : <p className="transaction-auth-help">Giao dịch tại quầy yêu cầu OTP của nhân viên đang đăng nhập. Không dùng PIN của khách hàng.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="transaction-auth-actions"><button type="button" onClick={onCancel} disabled={isLoading}>Quay lại</button><button type="submit" disabled={isLoading || (requirePin && pin.length!==6)}>{isLoading?'Đang kiểm tra...':'Tiếp tục nhận OTP'}</button></div>
    </form> : <form onSubmit={verifyOtp} autoComplete="off">
      <p className="transaction-auth-help">OTP có hiệu lực 5 phút, tối đa 3 lần nhập sai. Mã xác thực chỉ áp dụng cho giao dịch này.</p>
      {challenge.demoOtp && <div className="transaction-auth-demo" role="status">OTP DEMO (chỉ môi trường phát triển): <strong>{challenge.demoOtp}</strong></div>}
      {challenge.delivery==='not-configured' && <p className="form-error">Chưa cấu hình kênh gửi OTP. Không thể tiếp tục nếu không có mã.</p>}
      <label htmlFor="paymentOtp">Mã OTP (6 số)</label>
      <input id="paymentOtp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="transaction-auth-actions"><button type="button" onClick={onCancel} disabled={isLoading}>Hủy</button><button type="submit" disabled={isLoading || otp.length!==6 || challenge.delivery==='not-configured'}>{isLoading?'Đang xác thực...':'Xác nhận và thực hiện'}</button></div>
    </form>}
  </section>;
}
