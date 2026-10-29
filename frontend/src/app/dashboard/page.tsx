'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navigation from '../../components/Navigation';
import AppIcon from '../../components/AppIcon';
import { errorMessage } from '../../components/ErrorNotice';
import { formatVnd } from '../../lib/money';
import { accountStatusLabel, transactionStatusLabel, transactionTypeLabel } from '../../lib/labels';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'next/navigation';
import { homeForRole } from '../../lib/roleRoutes';

interface AccountInfo { id: string; accountNumber: string; balance: string; currency: string; tier: string; status: string }
interface TransactionItem { id: string; direction: 'incoming' | 'outgoing'; amount: string; description: string; type: string; status: string; createdAt: string; fromAccountNumber?: string | null; toAccountNumber?: string | null }
interface HistoryResponse { data: TransactionItem[]; pagination: { total: number } }

type DailyPoint = { label: string; incoming: number; outgoing: number };
const shortMoney = (n: number) => n >= 1_000_000_000 ? `${(n / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ` : n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr` : n >= 1000 ? `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}k` : String(Math.round(n));
const value = (s: string) => { const number = Number(s); return Number.isFinite(number) && number > 0 ? number : 0; };

function TrendChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.flatMap(p => [p.incoming, p.outgoing]));
  const width = 620, height = 194, left = 10, top = 14, bottom = 174;
  const makeLine = (field: 'incoming' | 'outgoing') => points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${left + (i / Math.max(1, points.length - 1)) * (width - 2 * left)} ${bottom - (point[field] / max) * (bottom - top)}`).join(' ');
  const incoming = makeLine('incoming'), outgoing = makeLine('outgoing');
  const empty = points.every(p => p.incoming === 0 && p.outgoing === 0);
  return <div className="fin-chart-wrap">
    <svg className="fin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ tổng tiền vào và tiền ra theo ngày của 30 ngày gần nhất">
      <defs><linearGradient id="incomeShade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1aa88d" stopOpacity="0.22"/><stop offset="100%" stopColor="#1aa88d" stopOpacity="0"/></linearGradient></defs>
      {[0, .33, .66, 1].map((step) => <line key={step} x1={left} x2={width - left} y1={top + (bottom - top) * step} y2={top + (bottom - top) * step} stroke="#e7ecec" strokeDasharray="4 6"/>) }
      {!empty && <><path d={`${incoming} L ${width - left} ${bottom} L ${left} ${bottom} Z`} fill="url(#incomeShade)"/><path d={incoming} fill="none" stroke="#078a76" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><path d={outgoing} fill="none" stroke="#f1b73d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></>}
    </svg>
    <div className="fin-chart-labels"><span>{points[0]?.label}</span><span>{points[7]?.label}</span><span>{points[14]?.label}</span><span>{points[21]?.label}</span><span>{points[29]?.label}</span></div>
    {empty && <div className="fin-chart-empty">Chưa có giao dịch hoàn thành trong 30 ngày qua</div>}
  </div>;
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  useEffect(() => { if (user && user.role !== 'customer') router.replace(homeForRole(user.role)); }, [user, router]);
  const ready = useAuthStore(s => s.ready);
  const token = useAuthStore(s => s.accessToken);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [history, setHistory] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [historyLimited, setHistoryLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState(false);
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready || !token || user?.role !== 'customer') return;
    let active = true;
    setLoading(true);
    Promise.allSettled([api.get<AccountInfo>('/accounts/me'), api.get<HistoryResponse>('/transactions?page=1&limit=100&sort=desc')])
      .then(([accountResult, txResult]) => {
        if (!active) return;
        if (accountResult.status === 'fulfilled') setAccount(accountResult.value.data);
        else setError(errorMessage(accountResult.reason));
        if (txResult.status === 'fulfilled') {
          setHistory(txResult.value.data.data);
          setTotal(txResult.value.data.pagination.total);
          setHistoryLimited(txResult.value.data.pagination.total > 100);
        } else setHistoryError(true);
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, token, user?.role]);

  const stats = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const points: DailyPoint[] = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return { label: `${day.getDate()}/${day.getMonth() + 1}`, incoming: 0, outgoing: 0 };
    });
    for (const tx of history) {
      if (tx.status !== 'COMPLETED') continue;
      const date = new Date(tx.createdAt);
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const index = Math.round((dateOnly.getTime() - start.getTime()) / 86400000);
      if (index < 0 || index >= points.length) continue;
      points[index][tx.direction] += value(tx.amount);
    }
    return { points, income: points.reduce((s,p) => s + p.incoming, 0), expense: points.reduce((s,p) => s + p.outgoing, 0) };
  }, [history]);
  const donutTotal = stats.income + stats.expense;
  const share = donutTotal ? 100 * stats.income / donutTotal : 0;

  async function copyAccount() {
    if (!account) return;
    try { await navigator.clipboard.writeText(account.accountNumber); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* Số tài khoản vẫn hiển thị */ }
  }

  if (user && user.role !== 'customer') return <ProtectedRoute><main className="auth-page"><div className="status-card">Đang mở khu vực làm việc...</div></main></ProtectedRoute>;

  return <ProtectedRoute allowRoles={['customer']}><main className="dashboard-page"><Navigation title="Tổng quan"/>
    <section className="dashboard-content fintech-dashboard">
      {loading && <div className="dashboard-skeleton"><div/><div/></div>}
      {error && <div className="form-error">{error}</div>}
      {!loading && account && <>
        <section className="wallet-upper-grid">
          <div className="wallet-panel wallet-card-panel">
            <div className="wallet-panel-header"><h2>Thẻ tài khoản của tôi</h2><Link href="/account" className="wallet-inline-link">Quản lý tài khoản <AppIcon name="arrow-right" size={16}/></Link></div>
            <div className="wallet-card-line"><div className="wallet-virtual-card">
              <span className="wallet-card-shape wallet-card-shape-1"/><span className="wallet-card-shape wallet-card-shape-2"/>
              <div className="wallet-card-top"><span className="wallet-card-logo"><AppIcon name="layers" size={20}/> SimpleBank</span><span className="wallet-card-tag">MÔ PHỎNG</span></div>
              <div className="wallet-card-center"><span>Số dư khả dụng <button className="wallet-eye" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Ẩn số dư' : 'Hiện số dư'} title={visible ? 'Ẩn số dư' : 'Hiện số dư'}><AppIcon name={visible ? 'eye' : 'eye-off'} size={16}/></button></span><strong>{visible ? formatVnd(account.balance) : '•••••• VND'}</strong></div>
              <div className="wallet-card-footer"><span><small>SỐ TÀI KHOẢN</small><strong>{account.accountNumber}</strong></span><button onClick={() => void copyAccount()} aria-label="Sao chép số tài khoản" title="Sao chép số tài khoản"><AppIcon name={copied ? 'check' : 'copy'} size={18}/></button></div>
            </div><div className="wallet-quick-actions">
              <Link href="/transfer"><span className="quick-icon sea"><AppIcon name="arrow-up-right" size={23}/></span><strong>Chuyển tiền</strong></Link>
              <Link href="/transactions"><span className="quick-icon cloud"><AppIcon name="receipt" size={22}/></span><strong>Lịch sử giao dịch</strong></Link>
              <Link href="/account"><span className="quick-icon warm"><AppIcon name="wallet" size={22}/></span><strong>Tài khoản</strong></Link>
            </div></div>
            <div className="wallet-card-caption"><span><AppIcon name="shield" size={15}/> {accountStatusLabel(account.status)}</span><span>Giao dịch được xử lý trên hệ thống mô phỏng</span></div>
          </div>
          <div className="wallet-panel wallet-chart-panel">
            <div className="wallet-panel-header"><div><h2>Thu chi theo thời gian</h2><p>30 ngày gần nhất</p></div><Link href="/transactions" className="wallet-period"><AppIcon name="calendar" size={15}/> Xem chi tiết</Link></div>
            <div className="chart-legend"><span><i className="legend-dot income"/> Tiền vào</span><span><i className="legend-dot expense"/> Tiền ra</span></div>
            <TrendChart points={stats.points}/>
            <div className="wallet-stats">
              <div className="wallet-stat"><span className="stat-symbol income"><AppIcon name="arrow-down-left" size={21}/></span><span><small>Tổng tiền vào</small><strong>{formatVnd(String(stats.income))}</strong></span></div>
              <div className="wallet-stat"><span className="stat-symbol expense"><AppIcon name="arrow-up-right" size={21}/></span><span><small>Tổng tiền ra</small><strong>{formatVnd(String(stats.expense))}</strong></span></div>
            </div>
            <p className="wallet-chart-note">{historyLimited ? 'Số liệu từ 100 giao dịch mới nhất (chưa bao gồm toàn bộ lịch sử).' : 'Số liệu từ các giao dịch đã hoàn thành.'}{historyError ? ' Chưa tải được lịch sử giao dịch.' : ''}</p>
          </div>
        </section>
        <section className="wallet-lower-grid">
          <div className="wallet-panel wallet-list-panel"><div className="wallet-panel-header"><h2>Giao dịch gần đây</h2><Link href="/transactions" className="wallet-inline-link">Xem tất cả <AppIcon name="arrow-right" size={16}/></Link></div>
            <div className="wallet-transaction-list">{historyError ? <div className="wallet-empty">Không tải được lịch sử giao dịch.</div> : history.length ? history.slice(0,5).map(tx => <div className="wallet-transaction" key={tx.id}>
              <span className={`wallet-tx-icon ${tx.direction}`}><AppIcon name={tx.direction === 'incoming' ? 'arrow-down-left' : 'arrow-up-right'} size={20}/></span>
              <span className="wallet-tx-main"><strong>{tx.description || transactionTypeLabel(tx.type)}</strong><small>{transactionTypeLabel(tx.type)} · {new Date(tx.createdAt).toLocaleDateString('vi-VN')} · {transactionStatusLabel(tx.status)}</small></span>
              <strong className={tx.direction === 'incoming' ? 'incoming' : 'outgoing'}>{tx.direction === 'incoming' ? '+' : '−'}{formatVnd(tx.amount)}</strong>
            </div>) : <div className="wallet-empty">Chưa có giao dịch. Bạn có thể bắt đầu bằng một lần chuyển tiền thử.</div>}</div>
            <div className="wallet-list-footer">{total.toLocaleString('vi-VN')} giao dịch trong lịch sử của bạn</div>
          </div>
          <div className="wallet-panel wallet-goals-panel"><div className="wallet-panel-header"><h2>Mục tiêu tiết kiệm</h2><span className="coming-label">Sắp ra mắt</span></div>
            <div className="goal-deco"><span className="goal-deco-circle goal-deco-one"/><span className="goal-deco-circle goal-deco-two"/><AppIcon name="wallet" size={38}/></div>
            <h3>Lên kế hoạch cho những điều lớn hơn</h3><p>Tính năng đặt mục tiêu và theo dõi khoản tiết kiệm sẽ được phát triển trong phiên bản tiếp theo.</p>
            <div className="goal-benefits"><span><AppIcon name="circle-check" size={16}/> Lập mục tiêu</span><span><AppIcon name="circle-check" size={16}/> Theo dõi tiến độ</span></div>
          </div>
          <div className="wallet-panel wallet-ratio-panel"><div className="wallet-panel-header"><h2>Cơ cấu dòng tiền</h2><span className="wallet-soft-tag">30 ngày</span></div>
            <div className="wallet-donut-shell"><div className="wallet-donut" style={{ background: donutTotal ? `conic-gradient(#059680 0 ${share}%, #efba51 ${share}% 100%)` : 'conic-gradient(#e5eceb 0 100%)' }}><div className="wallet-donut-inner"><small>Tổng thu & chi</small><strong>{shortMoney(donutTotal)} VND</strong></div></div></div>
            <div className="wallet-ratio-legend"><div><span><i className="legend-dot income"/> Tiền vào</span><strong>{shortMoney(stats.income)} VND</strong></div><div><span><i className="legend-dot expense"/> Tiền ra</span><strong>{shortMoney(stats.expense)} VND</strong></div></div>
            <p className="ratio-note">Phân loại theo dòng tiền thực tế, không gán danh mục chi tiêu khi chưa có dữ liệu.</p>
          </div>
        </section>
        <Link href="/ai/spending" className="ai-dashboard-teaser"><span className="ai-teaser-symbol"><AppIcon name="sparkles" size={23}/></span><span><strong>AI phân tích chi tiêu của bạn</strong><small>Tự động nhận diện danh mục từ nội dung giao dịch và tổng hợp theo tháng.</small></span><span className="ai-teaser-action">Khám phá <AppIcon name="arrow-right" size={17}/></span></Link>
        <div className="wallet-banner"><div className="wallet-banner-copy"><span>AN TÂM QUẢN LÝ</span><h2>Mỗi giao dịch nhỏ, một bước tiến lớn.</h2><p>Chuyển tiền và theo dõi tài khoản thuận tiện trong cùng một ứng dụng.</p></div><Link href="/transfer" className="wallet-banner-button">Chuyển tiền ngay <AppIcon name="arrow-right" size={19}/></Link><span className="wallet-banner-art" aria-hidden="true"/></div>
      </>}
    </section>
  </main></ProtectedRoute>;
}
