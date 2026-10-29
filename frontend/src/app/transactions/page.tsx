'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navigation from '../../components/Navigation';
import AppIcon from '../../components/AppIcon';
import { errorMessage } from '../../components/ErrorNotice';
import { formatVnd } from '../../lib/money';
import { transactionStatusLabel, transactionStatusTone, transactionTypeLabel } from '../../lib/labels';
import { useAuthStore } from '../../store/authStore';

interface TransactionItem { id: string; direction: 'incoming' | 'outgoing'; fromAccountNumber: string | null; toAccountNumber: string | null; amount: string; type: string; status: string; description: string; createdAt: string }
interface HistoryResponse { data: TransactionItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }

function TransactionHistoryScreen() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const search = (urlParams.get('search') || '').trim();
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => { setSearchDraft(search); setPage(1); }, [search]);
  const ready = useAuthStore((state) => state.ready);
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');

  const load = useCallback(async () => {
    if (!ready || !token || user?.role !== 'customer') return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10', sort });
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      const { data } = await api.get<HistoryResponse>(`/transactions?${params.toString()}`);
      setTransactions(data.data); setPages(Math.max(1, data.pagination.totalPages)); setTotal(data.pagination.total);
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [page, sort, status, type, search, ready, token, user?.role]);
  useEffect(() => { void load(); }, [load]);

  return <ProtectedRoute allowRoles={['customer']}><main className="dashboard-page"><Navigation title="Lịch sử giao dịch" />
    <section className="dashboard-content"><div className="inner-page-heading"><div className="eyebrow"><span className="eyebrow-dot"/> QUẢN LÝ DÒNG TIỀN</div><h2>Mọi giao dịch, luôn rõ ràng.</h2><p>Tìm theo mã giao dịch, số tài khoản, loại, trạng thái và thời gian của bạn.</p></div>
      <section className="history-card"><div className="history-header"><div className="card-heading-icon"><span className="head-icon"><AppIcon name="history" size={23}/></span><div><span className="eyebrow eyebrow-small">SỔ GIAO DỊCH</span><h3>Tiền vào và tiền ra</h3></div></div>{total !== null && <span className="count-pill">{total.toLocaleString('vi-VN')} giao dịch</span>}</div>
        <form className="history-search-row" role="search" onSubmit={event => {event.preventDefault();router.push(`/transactions${searchDraft.trim() ? `?search=${encodeURIComponent(searchDraft.trim())}` : ''}`);setPage(1);}}><AppIcon name="search" size={18}/><input aria-label="Tìm mã giao dịch hoặc số tài khoản" placeholder="Nhập mã giao dịch hoặc số tài khoản..." value={searchDraft} maxLength={80} onChange={event=>setSearchDraft(event.target.value)}/><button type="submit">Tra cứu</button></form>
        <div className="filters"><label><span><AppIcon name="filter" size={15}/> Sắp xếp</span><select value={sort} onChange={(event) => { setSort(event.target.value as 'asc' | 'desc'); setPage(1); }}><option value="desc">Mới nhất trước</option><option value="asc">Cũ nhất trước</option></select></label>
          <label><span>Trạng thái</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{['COMPLETED','PENDING_OTP','FAILED','REVERSED'].map((value) => <option key={value} value={value}>{transactionStatusLabel(value)}</option>)}</select></label>
          <label><span>Loại giao dịch</span><select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">Tất cả loại</option>{['transfer','deposit','withdrawal','reversal'].map((value) => <option key={value} value={value}>{transactionTypeLabel(value)}</option>)}</select></label></div>
        {loading && <div className="status-card">Đang tải giao dịch...</div>}
        {error && <div className="form-error">{error}</div>}
        {!loading && !error && transactions.length === 0 && <div className="recent-empty"><span className="empty-icon"><AppIcon name="receipt" size={25}/></span><strong>Không tìm thấy giao dịch</strong><p>Hãy thử điều chỉnh bộ lọc hoặc thực hiện một giao dịch mới.</p></div>}
        {!loading && !error && transactions.length > 0 && <div className="transaction-list">{transactions.map((tx) => <article className="transaction-item" key={tx.id}>
          <span className={`transaction-icon ${tx.direction}`}><AppIcon name={tx.direction === 'incoming' ? 'arrow-down-left' : 'arrow-up-right'} size={21}/></span>
          <div className="transaction-main"><div className="transaction-main-title"><strong>{tx.description || transactionTypeLabel(tx.type)}</strong><span className="transaction-type">{transactionTypeLabel(tx.type)}</span></div><p>{tx.fromAccountNumber || 'Tiền mặt'} <AppIcon name="arrow-right" size={13}/> {tx.toAccountNumber || 'Tiền mặt'}</p><small><AppIcon name="clock" size={13}/> {new Date(tx.createdAt).toLocaleString('vi-VN')} <span className={`status-badge status-${transactionStatusTone(tx.status)}`}>{transactionStatusLabel(tx.status)}</span></small></div>
          <strong className={tx.direction === 'incoming' ? 'amount incoming' : 'amount outgoing'}>{tx.direction === 'incoming' ? '+' : '−'}{formatVnd(tx.amount)}</strong>
        </article>)}</div>}
        <div className="pagination"><button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><AppIcon name="chevron-left" size={16}/> Trang trước</button><span>Trang <strong>{page}</strong> / {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Trang sau <AppIcon name="chevron-right" size={16}/></button></div>
      <p className="role-search-note">Tìm kiếm trên lịch sử của tài khoản hiện tại. Nội dung giao dịch được mã hóa không hỗ trợ tìm bằng từ khóa.</p></section>
    </section>
  </main></ProtectedRoute>;
}

export default function TransactionHistoryPage(){ return <Suspense fallback={<div className="status-card">Đang mở lịch sử...</div>}><TransactionHistoryScreen/></Suspense>; }
