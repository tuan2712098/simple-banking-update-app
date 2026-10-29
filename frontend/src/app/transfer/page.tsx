'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import axios from 'axios';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navigation from '../../components/Navigation';
import { errorMessage } from '../../components/ErrorNotice';
import { formatVnd } from '../../lib/money';
import AppIcon from '../../components/AppIcon';
import TransactionAuthorization from '../../components/TransactionAuthorization';

interface TransferResult {
  id: string;
  amount?: string;
  status: string;
  otpRequired?: boolean;
  demoOtp?: string;
}

export default function TransferPage() {
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [otp, setOtp] = useState('');
  const [pending, setPending] = useState<TransferResult | null>(null);
  const [requiresAuthorization, setRequiresAuthorization] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const key = useRef('');
  const busy = useRef(false);

  useEffect(() => { key.current = crypto.randomUUID(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!/^\d{8,30}$/.test(toAccountNumber.trim()) || !/^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/.test(amount) || !description.trim()) {
      setError('Kiểm tra lại số tài khoản, số tiền và nội dung.');
      return;
    }
    setError('');
    setSuccess('');
    setRequiresAuthorization(true);
  }

  async function authorizedTransfer(authorizationToken:string) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const payload = { toAccountNumber: toAccountNumber.trim(), amount, description: description.trim() };
    try {
      let result: TransferResult | undefined;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await api.post<TransferResult>('/transactions/transfer', payload, {
            headers: { 'Idempotency-Key': key.current, 'X-Transaction-Authorization': authorizationToken },
            timeout: 10000,
          });
          result = response.data;
          break;
        } catch (error: unknown) {
          if (attempt === 0 && axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK')) continue;
          throw error;
        }
      }
      if (!result) throw new Error('Không nhận được phản hồi từ hệ thống');
      if (result.otpRequired) {
        setPending(result);
        setRequiresAuthorization(false);
      } else {
        setRequiresAuthorization(false);
        setSuccess(`Đã chuyển ${formatVnd(result.amount || amount)}.`);
        setToAccountNumber('');
        setAmount('');
        setDescription('');
        key.current = crypto.randomUUID();
      }
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function confirmOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<TransferResult>('/transactions/confirm-otp', { transactionId: pending.id, otp });
      if (data.status !== 'COMPLETED') throw new Error('OTP chưa hợp lệ');
      setSuccess(`Đã chuyển ${formatVnd(amount)}.`);
      setPending(null);
      setOtp('');
      setToAccountNumber('');
      setAmount('');
      setDescription('');
      key.current = crypto.randomUUID();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  const enteredAmount = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0 ? formatVnd(amount) : '—';

  return <ProtectedRoute allowRoles={['customer']}><main className="dashboard-page"><Navigation title="Chuyển tiền" />
    <section className="dashboard-content">
      <div className="inner-page-heading"><div className="eyebrow"><span className="eyebrow-dot"/> THANH TOÁN VÀ CHUYỂN TIỀN</div><h2>Chuyển tiền dễ dàng, an tâm mỗi ngày.</h2><p>Điền thông tin người nhận để thực hiện chuyển khoản nội bộ.</p></div>
      <div className="transfer-grid">
        <section className="page-card transfer-form-card"><div className="card-heading-icon"><span className="head-icon"><AppIcon name="arrow-up-right" size={22}/></span><div><span className="eyebrow eyebrow-small">GIAO DỊCH MỚI</span><h3>{pending || requiresAuthorization ? 'Xác nhận giao dịch' : 'Thông tin chuyển khoản'}</h3></div></div>
          {requiresAuthorization ? <TransactionAuthorization action="transfer" payload={{toAccountNumber:toAccountNumber.trim(),amount,description:description.trim()}} requirePin busy={loading} onAuthorized={authorizedTransfer} onCancel={()=>setRequiresAuthorization(false)}/> : !pending ? <form onSubmit={submit}>
            <label htmlFor="receiver">Số tài khoản người nhận</label><div className="field-shell"><AppIcon name="credit-card" size={20}/><input id="receiver" inputMode="numeric" value={toAccountNumber} onChange={(event) => setToAccountNumber(event.target.value)} placeholder="Nhập số tài khoản nhận" required /></div>
            <label htmlFor="amount">Số tiền chuyển (VND)</label><div className="field-shell"><AppIcon name="wallet" size={20}/><input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ví dụ: 100000" required /><span className="field-suffix">VND</span></div>
            <label htmlFor="description">Nội dung chuyển khoản</label><textarea id="description" value={description} maxLength={255} onChange={(event) => setDescription(event.target.value)} placeholder="Nhập nội dung chuyển khoản..." required />
            {error && <div className="form-error">{error}</div>}{success && <div className="form-success"><AppIcon name="circle-check" size={19}/>{success}</div>}
            <button className="primary-submit" type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : <>Tiếp tục chuyển tiền <AppIcon name="arrow-right" size={19}/></>}</button>
          </form> : <form onSubmit={confirmOtp}>
            <div className="status-card"><AppIcon name="shield" size={19}/> Giao dịch cần mã xác thực OTP. Mã có hiệu lực trong 5 phút, tối đa 3 lần nhập sai.</div>
            {pending.demoOtp && <div className="status-card">OTP trong môi trường demo: <strong>{pending.demoOtp}</strong></div>}
            <label htmlFor="otp">Mã xác thực gồm 6 chữ số</label><div className="field-shell"><AppIcon name="lock" size={20}/><input id="otp" value={otp} maxLength={6} inputMode="numeric" onChange={(event) => setOtp(event.target.value)} placeholder="Nhập mã OTP" required /></div>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-submit" type="submit" disabled={loading || otp.length !== 6}>{loading ? 'Đang xác nhận...' : <>Xác nhận OTP <AppIcon name="arrow-right" size={19}/></>}</button>
          </form>}
        </section>
        <aside className="transfer-summary"><div className="summary-top"><div className="summary-icon"><AppIcon name="receipt" size={23}/></div><span className="eyebrow eyebrow-small">TÓM TẮT GIAO DỊCH</span><h3>Kiểm tra trước khi gửi</h3><p>Thông tin dưới đây thay đổi theo nội dung bạn nhập.</p></div>
          <div className="summary-data"><div><span>Tài khoản nhận</span><strong>{toAccountNumber || 'Chưa nhập'}</strong></div><div><span>Nội dung</span><strong className="summary-description">{description || 'Chưa nhập'}</strong></div><div className="summary-amount"><span>Số tiền chuyển</span><strong>{enteredAmount}</strong></div></div>
          <div className="security-notice"><AppIcon name="shield" size={19}/><span>Chỉ xác nhận khi bạn đã kiểm tra đúng thông tin người nhận.</span></div>
        </aside>
      </div>
    </section>
  </main></ProtectedRoute>;
}
