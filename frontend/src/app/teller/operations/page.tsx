'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import Navigation from '../../../components/Navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import AppIcon from '../../../components/AppIcon';
import { errorMessage } from '../../../components/ErrorNotice';
import TransactionAuthorization, { PaymentAction } from '../../../components/TransactionAuthorization';

function TellerOperations() {
  const params = useSearchParams();
  const [tab, setTab] = useState<'deposit'|'transfer'>('deposit');
  const [accountNumber, setAccountNumber] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [description, setDescription] = useState('Giao dịch tại quầy');
  const [busy, setBusy] = useState(false);
  const [pendingOperation,setPendingOperation] = useState<{action:PaymentAction;payload:Record<string,string>}|null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [foundAccount, setFoundAccount] = useState<{accountNumber:string;ownerName:string;ownerId:string;status:string}|null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const account = params.get('account');
    const initialTab = params.get('tab');
    if (account) { setAccountNumber(account); setTab('deposit'); }
    else if (initialTab === 'transfer') setTab('transfer');
    else if (initialTab === 'deposit') setTab('deposit');
  }, [params]);

  async function lookupAccount(number = accountNumber) {
    if (!number.trim()) return;
    setLookupBusy(true); setLookupError(''); setFoundAccount(null);
    try {
      const { data } = await api.get<{accountNumber:string;ownerName:string;ownerId:string;status:string}>(`/teller/accounts/${encodeURIComponent(number.trim())}`);
      setFoundAccount(data);
    } catch(err) { setLookupError(errorMessage(err)); }
    finally { setLookupBusy(false); }
  }

  async function perform(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    setPendingOperation(tab === 'deposit' ? {action:'deposit',payload:{accountNumber:accountNumber.trim(),amount:depositAmount}} : {action:'teller-transfer',payload:{ownerId:ownerId.trim(),toAccountNumber:recipient.trim(),amount:transferAmount,description:description.trim() || 'Giao dịch tại quầy'}});
  }
  async function authorizedOperation(token:string) {
    if (!pendingOperation) return;
    setBusy(true);setError('');
    try {
      const endpoint = pendingOperation.action==='deposit'?'/transactions/deposit':'/transactions/teller-transfer';
      const response = await api.post<{status:string}>(endpoint,pendingOperation.payload,{headers:{'X-Transaction-Authorization':token, ...(pendingOperation.action==='teller-transfer'?{'Idempotency-Key':crypto.randomUUID()}:{})}});
      setMessage(response.data.status==='PENDING_OTP'?'Yêu cầu chuyển khoản lớn đang chờ phê duyệt và OTP của khách hàng.':'Giao dịch đã được xác nhận.');
      if (pendingOperation.action==='deposit') setDepositAmount(''); else setTransferAmount('');
      setPendingOperation(null);
    } catch(err) {setError(errorMessage(err));throw err;}
    finally {setBusy(false);}
  }

  return <ProtectedRoute allowRoles={['teller']}><main className="dashboard-page"><Navigation title="Nghiệp vụ tại quầy"/>
    <section className="dashboard-content role-dashboard"><div className="role-page-intro"><span className="role-kicker">GIAO DỊCH VIÊN</span><h2>Thực hiện nghiệp vụ</h2><p>Nhập dữ liệu chính xác và xác nhận yêu cầu với khách hàng trước khi gửi giao dịch.</p></div>
      <div className="teller-operations-layout"><section className="role-panel"><div className="teller-tabs" role="tablist" aria-label="Chọn nghiệp vụ"><button type="button" role="tab" aria-selected={tab==='deposit'} className={tab==='deposit'?'selected':''} onClick={()=>{setTab('deposit');setError('');setMessage('');}}><AppIcon name="wallet" size={18}/> Nạp tiền</button><button type="button" role="tab" aria-selected={tab==='transfer'} className={tab==='transfer'?'selected':''} onClick={()=>{setTab('transfer');setError('');setMessage('');}}><AppIcon name="arrow-up-right" size={18}/> Chuyển khoản hộ</button></div>
        {pendingOperation ? <TransactionAuthorization action={pendingOperation.action} payload={pendingOperation.payload} onAuthorized={authorizedOperation} onCancel={()=>setPendingOperation(null)} busy={busy}/> : <form className="teller-operation-form" onSubmit={perform}>
          {tab==='deposit' ? <><label>Số tài khoản nhận<input value={accountNumber} onChange={e=>{setAccountNumber(e.target.value);setFoundAccount(null);}} maxLength={30} placeholder="Nhập số tài khoản" required /></label><button className="teller-lookup-button" type="button" disabled={lookupBusy || !accountNumber.trim()} onClick={()=>void lookupAccount()}><AppIcon name="search" size={16}/>{lookupBusy?'Đang tra cứu...':'Kiểm tra tài khoản'}</button>{foundAccount && <div className="teller-lookup-result"><AppIcon name="circle-check" size={19}/><span><strong>{foundAccount.ownerName}</strong><small>{foundAccount.accountNumber} · {foundAccount.status === 'ACTIVE' ? 'Đang hoạt động' : 'Không hoạt động'}</small></span></div>}{lookupError && <div className="form-error">{lookupError}</div>}<label>Số tiền nạp (VND)<input type="number" min="1" step="1" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} placeholder="Ví dụ: 500000" required /></label></> : <><label>Mã khách hàng gửi (UUID)<input value={ownerId} onChange={e=>setOwnerId(e.target.value)} placeholder="Mã định danh khách hàng" required /></label><label>Số tài khoản nhận<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Số tài khoản thụ hưởng" required /></label><label>Số tiền chuyển (VND)<input type="number" min="1" step="1" value={transferAmount} onChange={e=>setTransferAmount(e.target.value)} placeholder="Ví dụ: 500000" required /></label><label>Nội dung chuyển khoản<input value={description} onChange={e=>setDescription(e.target.value)} maxLength={255} required /></label></>}
          {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
          <button type="submit" disabled={busy} className="role-submit">{busy?'Đang xử lý...':tab==='deposit'?'Xác nhận nạp tiền':'Gửi yêu cầu chuyển khoản'} <AppIcon name="arrow-right" size={17}/></button>
        </form>}</section>
        <aside className="role-panel teller-tips"><span className="role-kpi-icon mint"><AppIcon name="shield" size={26}/></span><h3>Kiểm tra trước khi xác nhận</h3><p>Vui lòng đảm bảo số tài khoản, số tiền và thông tin khách hàng đúng với yêu cầu được tiếp nhận.</p><div className="teller-tip-line"><AppIcon name="circle-check" size={17}/> Chỉ sử dụng tài khoản mô phỏng.</div><div className="teller-tip-line"><AppIcon name="circle-check" size={17}/> Không chia sẻ mã phiên hoặc khóa bảo mật.</div><div className="teller-tip-line"><AppIcon name="circle-check" size={17}/> Kết quả thao tác do Backend xác nhận.</div><p className="role-panel-hint">Ô tìm kiếm phía trên điền sẵn số tài khoản; chọn “Kiểm tra tài khoản” để xác minh chủ tài khoản và trạng thái. API chỉ trả về thông tin cần thiết cho tác nghiệp.</p></aside>
      </div>
    </section>
  </main></ProtectedRoute>;
}
export default function TellerOperationsPage() { return <Suspense fallback={<div className="status-card">Đang mở nghiệp vụ...</div>}><TellerOperations/></Suspense>; }
