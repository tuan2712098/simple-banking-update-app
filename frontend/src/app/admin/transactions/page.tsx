'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { formatVnd } from '../../../lib/money';
import { transactionStatusLabel, transactionTypeLabel } from '../../../lib/labels';
import Navigation from '../../../components/Navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import AppIcon from '../../../components/AppIcon';
import { useAuthStore } from '../../../store/authStore';
import TransactionAuthorization from '../../../components/TransactionAuthorization';

type AdminTransaction = { id: string; amount: string; description: string; status: string; type: string; createdAt: string };
function AdminTransactionSearch() {
  const params = useSearchParams();
  const query = (params.get('search') || '').trim().toLocaleLowerCase('vi-VN');
  const user = useAuthStore(s=>s.user);
  const token = useAuthStore(s=>s.accessToken);
  const [records, setRecords] = useState<AdminTransaction[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState('');
  const [reverseId,setReverseId]=useState<string|null>(null);
  const [actionBusy,setActionBusy]=useState(false);
  const [actionMessage,setActionMessage]=useState('');
  useEffect(()=>{
    if (user?.role !== 'admin' || !token) return;
    let active = true;
    setBusy(true);
    api.get<AdminTransaction[]>('/admin/transactions').then(({data})=>{if(active)setRecords(data);})
      .catch(()=>{if(active)setError('Không lấy được danh sách giao dịch.');})
      .finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[user?.role,token]);
  const results = useMemo(()=>records.filter(tx=>{
    const match = [tx.id, tx.status, transactionStatusLabel(tx.status), tx.type, transactionTypeLabel(tx.type), tx.amount, tx.description || ''].join(' ').toLocaleLowerCase('vi-VN');
    return (!query || match.includes(query)) && (!filter || tx.status === filter);
  }),[records, query, filter]);
  async function authorizedReverse(token:string){
    if(!reverseId)return;
    setActionBusy(true);setError('');
    try{await api.post(`/admin/transactions/${reverseId}/reverse`,{},{headers:{'X-Transaction-Authorization':token}});setActionMessage('Đã hoàn trả giao dịch.');setReverseId(null);const {data}=await api.get<AdminTransaction[]>('/admin/transactions');setRecords(data);}
    catch(err){setError(err instanceof Error?err.message:'Không thể hoàn trả giao dịch');throw err;}finally{setActionBusy(false);}
  }
  return <ProtectedRoute allowRoles={['admin']}><main className="dashboard-page"><Navigation title="Tra cứu giao dịch hệ thống"/>
    <section className="dashboard-content role-dashboard"><div className="role-page-intro"><span className="role-kicker"><AppIcon name="search" size={15}/> TRA CỨU QUẢN TRỊ</span><h2>Giao dịch trong hệ thống</h2><p>Danh sách lấy từ API quản trị, giới hạn tối đa 100 giao dịch gần nhất. Tìm kiếm chỉ lọc trong danh sách này.</p></div>
      {reverseId&&<TransactionAuthorization action="reverse" payload={{transactionId:reverseId}} busy={actionBusy} onCancel={()=>setReverseId(null)} onAuthorized={authorizedReverse}/>}
      {actionMessage&&<p className="form-success">{actionMessage}</p>}
      <div className="role-panel"><div className="role-panel-head"><div><h3>{query ? `Kết quả cho “${query}”` : 'Danh sách giao dịch gần nhất'}</h3><p>{results.length} / {records.length} giao dịch trong phạm vi đang tải</p></div><select className="role-filter-select" aria-label="Lọc trạng thái" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Tất cả trạng thái</option><option value="COMPLETED">Thành công</option><option value="PENDING_OTP">Chờ OTP</option><option value="FAILED">Thất bại</option><option value="REVERSED">Đã hoàn trả</option></select></div>
        {busy && <p className="role-empty">Đang lấy dữ liệu giao dịch...</p>}{error && <p className="form-error">{error}</p>}
        {!busy && !error && results.length===0 && <p className="role-empty">Không có giao dịch phù hợp trong 100 bản ghi gần nhất.</p>}
        {!busy && !error && results.length>0 && <div className="role-table-scroll"><table className="role-table"><thead><tr><th>Mã giao dịch</th><th>Thời gian</th><th>Loại</th><th>Trạng thái</th><th>Số tiền</th><th>Tác vụ</th></tr></thead><tbody>{results.map(tx=><tr key={tx.id}><td className="role-mono" title={tx.id}>{tx.id.slice(0,12)}…</td><td>{new Date(tx.createdAt).toLocaleString('vi-VN')}</td><td>{transactionTypeLabel(tx.type)}</td><td><span className="role-status-label">{transactionStatusLabel(tx.status)}</span></td><td className="role-right">{formatVnd(tx.amount)}</td><td>{tx.type==='transfer'&&tx.status==='COMPLETED'?<button type="button" onClick={()=>setReverseId(tx.id)}>Hoàn trả (OTP)</button>:'—'}</td></tr>)}</tbody></table></div>}
      </div>
    </section>
  </main></ProtectedRoute>;
}
export default function AdminTransactionsPage(){return <Suspense fallback={<div className="status-card">Đang mở danh sách...</div>}><AdminTransactionSearch/></Suspense>}
