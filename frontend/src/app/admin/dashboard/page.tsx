'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { formatVnd } from '../../../lib/money';
import { transactionStatusLabel } from '../../../lib/labels';
import Navigation from '../../../components/Navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import AppIcon from '../../../components/AppIcon';
import { useAuthStore } from '../../../store/authStore';

type AdminTx = { id: string; amount: string; status: string; createdAt: string; tellerInitiated?: boolean; approvedById?: string | null };
type AdminUser = { id: string; role: string; status: string };
type DashboardData = { users: AdminUser[]; transactions: AdminTx[]; flagged: AdminTx[]; auditCount: number };

export default function AdminDashboardPage() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.accessToken);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin' || !token) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api.get<AdminUser[]>('/admin/users'),
      api.get<AdminTx[]>('/admin/transactions'),
      api.get<AdminTx[]>('/admin/flagged-transactions'),
      api.get<{ data: { id: string }[] }>('/admin/audit-logs?page=1&limit=5'),
    ]).then(([users, transactions, flagged, audits]) => {
      if (active) setData({ users: users.data, transactions: transactions.data, flagged: flagged.data, auditCount: audits.data.data.length });
    }).catch(() => { if (active) setError('Chưa tải được số liệu quản trị. Vui lòng kiểm tra quyền tài khoản và thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role, token]);

  const txs = data?.transactions ?? [];
  const pending = txs.filter(tx => tx.tellerInitiated && tx.status === 'PENDING_OTP' && !tx.approvedById);
  const recent = txs.slice(0, 6);
  const completed = txs.filter(tx => tx.status === 'COMPLETED').length;
  const failed = txs.filter(tx => tx.status === 'FAILED').length;
  const userTotal = data?.users.length ?? 0;

  return <ProtectedRoute allowRoles={['admin']}><main className="dashboard-page"><Navigation title="Tổng quan hệ thống"/>
    <section className="dashboard-content role-dashboard">
      <div className="role-hero"><div><span className="role-kicker"><AppIcon name="shield" size={16}/> KHÔNG GIAN QUẢN TRỊ</span><h2>Điều hành hệ thống tập trung</h2><p>Theo dõi tình trạng tài khoản, giao dịch và các yêu cầu cần xử lý. Các con số được lấy từ API, không phải dữ liệu minh họa.</p></div><Link href="/admin/ai-fraud" className="role-hero-action">Phân tích rủi ro AI <AppIcon name="arrow-right" size={18}/></Link></div>
      {loading && <div className="status-card">Đang tải dữ liệu toàn hệ thống...</div>}
      {error && <div className="form-error">{error}</div>}
      {data && <>
        <div className="role-kpi-grid">
          <article className="role-kpi-card"><span className="role-kpi-icon mint"><AppIcon name="user" size={22}/></span><small>Người dùng trong hệ thống</small><strong>{userTotal.toLocaleString('vi-VN')}</strong><span>Dữ liệu tài khoản đã đăng ký</span></article>
          <article className="role-kpi-card"><span className="role-kpi-icon sky"><AppIcon name="receipt" size={22}/></span><small>Giao dịch đang hiển thị</small><strong>{txs.length.toLocaleString('vi-VN')}</strong><span>Tối đa 100 giao dịch gần nhất</span></article>
          <article className="role-kpi-card"><span className="role-kpi-icon amber"><AppIcon name="clock" size={22}/></span><small>Chờ duyệt tại quầy</small><strong>{pending.length.toLocaleString('vi-VN')}</strong><span>Trong danh sách 100 giao dịch gần nhất</span></article>
          <article className="role-kpi-card"><span className="role-kpi-icon rose"><AppIcon name="shield" size={22}/></span><small>Giao dịch cần xem xét</small><strong>{data.flagged.length.toLocaleString('vi-VN')}</strong><span>Được đánh dấu từ nghiệp vụ</span></article>
        </div>
        <div className="role-two-col">
          <section className="role-panel"><div className="role-panel-head"><div><h3>Tình trạng giao dịch</h3><p>Thống kê từ tối đa 100 giao dịch gần nhất</p></div><Link href="/admin/transactions">Tra cứu <AppIcon name="arrow-right" size={15}/></Link></div>
            <div className="role-progress-track"><span className="good" style={{width:`${txs.length?100*completed/txs.length:0}%`}}/><span className="bad" style={{width:`${txs.length?100*failed/txs.length:0}%`}}/></div>
            <div className="role-status-grid"><div><span className="role-color-dot good"/>Hoàn thành<strong>{completed}</strong></div><div><span className="role-color-dot bad"/>Thất bại<strong>{failed}</strong></div><div><span className="role-color-dot neutral"/>Trạng thái khác<strong>{Math.max(0,txs.length-completed-failed)}</strong></div></div>
            <div className="role-shortcuts"><Link href="/admin"><AppIcon name="settings"/> Quản lý và phê duyệt</Link><Link href="/admin/ai-fraud"><AppIcon name="sparkles"/> Phát hiện bất thường AI</Link></div>
          </section>
          <section className="role-panel"><div className="role-panel-head"><div><h3>Giao dịch mới nhất</h3><p>Dữ liệu từ hệ thống, đã giới hạn 100 bản ghi</p></div><Link href="/admin/transactions">Xem tất cả <AppIcon name="arrow-right" size={15}/></Link></div>
            {!recent.length && <p className="role-empty">Chưa có giao dịch nào được ghi nhận.</p>}
            {recent.map(tx=><div className="role-recent-row" key={tx.id}><span className="role-recent-icon"><AppIcon name="receipt" size={17}/></span><span><strong>Mã {tx.id.slice(0,8)}…</strong><small>{new Date(tx.createdAt).toLocaleString('vi-VN')} · {transactionStatusLabel(tx.status)}</small></span><b>{formatVnd(tx.amount)}</b></div>)}
          </section>
        </div>
        <div className="role-helper-note"><AppIcon name="info" size={18}/><span>Thống kê quản trị sử dụng các API hiện có. Hệ thống chưa có báo cáo toàn bộ giao dịch theo thời gian, nên các chỉ số giao dịch ở đây được ghi rõ phạm vi 100 bản ghi.</span></div>
      </>}
    </section>
  </main></ProtectedRoute>;
}
