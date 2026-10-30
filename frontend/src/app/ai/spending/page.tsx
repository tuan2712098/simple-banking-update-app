'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navigation from '../../../components/Navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import AppIcon from '../../../components/AppIcon';
import { errorMessage } from '../../../components/ErrorNotice';
import api from '../../../lib/api';
import { formatVnd } from '../../../lib/money';
import { useAuthStore } from '../../../store/authStore';

type Recipient = { key: string; name: string; account: string; total: number; count: number; share: number };
type Recurring = {
  name: string; account: string; period: 'weekly' | 'monthly'; periodDays: number; amount: number;
  occurrences: number; lastAt: string; nextAt: string; daysUntil: number;
};
type Forecast = { projected: number; dailyAverage: number; recurringRemaining: number; daysLeft: number; reliable: boolean };
type Insights = {
  month: string; total: number; count: number; previousTotal: number; averageThreeMonths: number;
  recipients: Recipient[]; recurring: Recurring[]; weekdays: number[]; forecast: Forecast | null;
};

const COLORS = ['#078a76', '#f0b547', '#56b9aa', '#7e94eb', '#df82ae', '#adb8c4', '#7bbaa2', '#c9a27e'];
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const fmt = (num: number) => formatVnd(String(Math.round(num)));

function months() {
  const now = new Date(Date.now() + 7 * 3600000);
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return { value, label: `Tháng ${date.getUTCMonth() + 1}/${date.getUTCFullYear()}` };
  });
}

function dueText(days: number) {
  if (days < 0) return `quá hạn ${-days} ngày`;
  if (days === 0) return 'hôm nay';
  return `sau ${days} ngày`;
}

export default function AiSpendingPage() {
  const ready = useAuthStore(s => s.ready);
  const token = useAuthStore(s => s.accessToken);
  const choices = useMemo(months, []);
  const [month, setMonth] = useState(choices[0].value);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Tên gợi nhớ lưu cục bộ trên trình duyệt, không gửi lên máy chủ.
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try { setNicknames(JSON.parse(localStorage.getItem('recipient-nicknames') || '{}')); } catch { setNicknames({}); }
  }, []);
  useEffect(() => {
    if (!ready || !token) return;
    let current = true;
    setLoading(true); setError('');
    api.get<Insights>(`/ai/insights?month=${month}`)
      .then(response => { if (current) setData(response.data); })
      .catch(err => { if (current) { setData(null); setError(errorMessage(err)); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [month, ready, token]);

  function saveNickname(account: string) {
    const next = { ...nicknames };
    if (draft.trim()) next[account] = draft.trim().slice(0, 40); else delete next[account];
    setNicknames(next);
    localStorage.setItem('recipient-nicknames', JSON.stringify(next));
    setEditing('');
  }
  const nameOf = (item: { name: string; account: string }) => nicknames[item.account] || item.name;

  const gradient = useMemo(() => {
    if (!data?.recipients.length || !data.total) return '#edf4f1';
    let running = 0;
    return `conic-gradient(${data.recipients.map((item, index) => {
      const start = running;
      running += item.share * 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${running}%`;
    }).join(',')}${running < 99.5 ? `,#e3ebe8 ${running}% 100%` : ''})`;
  }, [data]);

  const change = data && data.previousTotal > 0 ? (data.total - data.previousTotal) / data.previousTotal : null;
  const maxDay = data ? Math.max(1, ...data.weekdays) : 1;
  const busiestDay = data && data.total ? data.weekdays.indexOf(Math.max(...data.weekdays)) : -1;

  return <ProtectedRoute allowRoles={['customer']}><main className="dashboard-page"><Navigation title="Phân tích chi tiêu AI"/>
    <section className="dashboard-content ai-page">
      <div className="ai-heading"><div><span className="ai-eyebrow"><AppIcon name="sparkles" size={16}/> TRỢ LÝ TÀI CHÍNH THÔNG MINH</span>
        <h2>Tiền của bạn đang đi đâu?</h2>
        <p>Phân tích dựa trên người nhận, số tiền và thời điểm giao dịch, không cần bạn ghi nội dung chuyển khoản.</p></div>
        <label className="ai-month-picker">Khoảng thời gian<select value={month} onChange={event => setMonth(event.target.value)}>{choices.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      {loading && <div className="ai-loading">Đang phân tích thói quen chi tiêu...</div>}
      {error && <div className="form-error">{error} <span>Kiểm tra Backend ở cổng 3000.</span></div>}
      {data && !loading && <>
        <div className="ai-summary-grid">
          <article className="ai-kpi ai-kpi-highlight"><div className="ai-kpi-icon"><AppIcon name="wallet" size={24}/></div><span>Tổng tiền ra trong tháng</span><strong>{fmt(data.total)}</strong>
            <small>{change === null ? `${data.count} giao dịch` : `${change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(change * 100))}% so với tháng trước (${fmt(data.previousTotal)})`}</small></article>
          <article className="ai-kpi"><div className="ai-kpi-icon mint"><AppIcon name="receipt" size={24}/></div><span>Số giao dịch</span><strong>{data.count}</strong><small>Trung bình 3 tháng trước: {fmt(data.averageThreeMonths)}</small></article>
          <article className="ai-kpi"><div className="ai-kpi-icon amber"><AppIcon name="activity" size={24}/></div><span>Dự báo cuối tháng</span>
            <strong>{data.forecast ? fmt(data.forecast.projected) : '—'}</strong>
            <small>{data.forecast ? (data.forecast.reliable ? `Còn ${data.forecast.daysLeft} ngày, gồm ${fmt(data.forecast.recurringRemaining)} khoản định kỳ` : 'Ước tính sơ bộ, chưa đủ dữ liệu trong tháng') : 'Chỉ dự báo cho tháng hiện tại'}</small></article>
        </div>

        <div className="ai-content-grid">
          <section className="ai-panel"><div className="ai-panel-top"><h3>Tiền chuyển cho ai nhiều nhất</h3><span className="ai-flag ai-flag-info">Theo người nhận</span></div>
            {!data.recipients.length ? <div className="ai-empty">Chưa có giao dịch tiền ra hoàn thành trong tháng này. <Link href="/transfer">Đến trang chuyển tiền</Link></div> :
              <div className="ai-chart-row"><div className="ai-donut" style={{background:gradient}}><div className="ai-donut-hole"><small>Tổng chi</small><strong>{fmt(data.total)}</strong></div></div>
                <div className="ai-category-list">{data.recipients.map((item, index) => <div className="ai-category" key={item.key}>
                  <span className="ai-color-dot" style={{background:COLORS[index % COLORS.length]}}/>
                  <span className="ai-category-name">
                    {editing === item.account && item.account ? <input className="ai-nick-input" autoFocus maxLength={40} value={draft} placeholder="Tên gợi nhớ" onChange={e => setDraft(e.target.value)} onBlur={() => saveNickname(item.account)} onKeyDown={e => { if (e.key === 'Enter') saveNickname(item.account); if (e.key === 'Escape') setEditing(''); }}/> : <>
                      {nameOf(item)} <small className="ai-secondary-line">{item.account} · {item.count} lần</small>
                      {item.account && <button type="button" className="ai-nick-btn" title="Đặt tên gợi nhớ" onClick={() => { setEditing(item.account); setDraft(nicknames[item.account] || ''); }}>✎</button>}</>}
                  </span>
                  <strong>{fmt(item.total)}</strong><small>{Math.round(item.share * 100)}%</small></div>)}</div></div>}
          </section>
          <section className="ai-panel ai-insight"><div className="ai-panel-top"><h3>Nhận xét từ dữ liệu</h3><AppIcon name="sparkles" size={20}/></div>
            {data.recipients.length ? <>
              <p>Người nhận lớn nhất là <strong>{nameOf(data.recipients[0])}</strong>, chiếm <strong>{Math.round(data.recipients[0].share * 100)}%</strong> số tiền ra trong tháng.</p>
              {busiestDay >= 0 && <p>Bạn chi nhiều nhất vào <strong>{WEEKDAYS[busiestDay]}</strong>.</p>}
              {data.forecast && data.averageThreeMonths > 0 && data.forecast.reliable && <p>Theo tốc độ hiện tại, cuối tháng bạn sẽ chi khoảng <strong>{fmt(data.forecast.projected)}</strong>, {data.forecast.projected > data.averageThreeMonths ? 'cao hơn' : 'thấp hơn hoặc bằng'} mức trung bình 3 tháng trước.</p>}
              <div className="ai-insight-feature"><AppIcon name="info" size={19}/><span>Tên gợi nhớ chỉ lưu trên trình duyệt này. Số liệu là thống kê tự động, không phải tư vấn tài chính.</span></div>
              <Link className="ai-outline-link" href="/transactions">Xem toàn bộ giao dịch <AppIcon name="arrow-right" size={17}/></Link>
            </> : <p>Khi bạn có giao dịch, nhận xét sẽ xuất hiện ở đây.</p>}
          </section>
        </div>

        <div className="ai-content-grid">
          <section className="ai-panel"><div className="ai-panel-top"><h3>Khoản chi định kỳ</h3><span className="ai-flag ai-flag-good">Tự phát hiện</span></div>
            {data.recurring.length ? <div className="ai-recurring-list">{data.recurring.map(item => <div className="ai-recurring" key={item.account + item.period}>
              <div><strong>{nameOf(item)}</strong><small className="ai-secondary-line">{item.account} · {item.period === 'monthly' ? 'Hàng tháng' : 'Hàng tuần'} · đã lặp {item.occurrences} lần</small></div>
              <div className="ai-recurring-right"><strong>~{fmt(item.amount)}</strong><small className={`ai-secondary-line ${item.daysUntil <= 3 ? 'ai-due-soon' : ''}`}>Kỳ tới: {new Date(item.nextAt).toLocaleDateString('vi-VN')} ({dueText(item.daysUntil)})</small></div>
            </div>)}</div> : <p className="ai-empty">Chưa phát hiện khoản nào lặp đều. Cần ít nhất 3 lần chuyển cho cùng người nhận, cùng số tiền, cách đều nhau theo tuần hoặc tháng.</p>}
          </section>
          <section className="ai-panel"><div className="ai-panel-top"><h3>Chi tiêu theo ngày trong tuần</h3><AppIcon name="activity" size={20}/></div>
            <div className="ai-weekday-chart">{data.weekdays.map((value, index) => <div className="ai-weekday" key={index}>
              <div className="ai-weekday-bar-wrap"><div className={`ai-weekday-bar ${index === busiestDay ? 'peak' : ''}`} style={{height: `${Math.max(value ? 6 : 0, Math.round(value / maxDay * 100))}%`}} title={fmt(value)}/></div>
              <small>{WEEKDAYS[index]}</small></div>)}</div>
          </section>
        </div>
        <p className="ai-caveat"><AppIcon name="info" size={17}/>Chuyển khoản giữa các tài khoản của chính bạn không được tính là chi tiêu. Khoản định kỳ và dự báo là ước tính từ lịch sử, có thể sai khi thói quen thay đổi.</p>
      </>}
    </section>
  </main></ProtectedRoute>;
}
