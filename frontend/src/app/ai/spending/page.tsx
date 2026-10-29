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

type Category = { category: string; label: string; total: number; count: number };
type SpendingTransaction = {
  id: string; amount: number; description: string; createdAt: string;
  category: string; categoryLabel: string; confidence: number; needsReview: boolean;
};
type SpendingOverview = {
  month: string; total: number; analyzed: number; limited: boolean;
  categories: Category[]; transactions: SpendingTransaction[];
  model: string; trainingData: string; notice: string;
};
const COLORS = ['#078a76', '#f0b547', '#56b9aa', '#7e94eb', '#df82ae', '#adb8c4', '#7bbaa2'];
const fmt = (num: number) => formatVnd(String(Math.round(num)));

function months() {
  const now = new Date(Date.now() + 7 * 3600000);
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return { value, label: `Tháng ${date.getUTCMonth() + 1}/${date.getUTCFullYear()}` };
  });
}

export default function AiSpendingPage() {
  const ready = useAuthStore(s => s.ready);
  const token = useAuthStore(s => s.accessToken);
  const choices = useMemo(months, []);
  const [month, setMonth] = useState(choices[0].value);
  const [data, setData] = useState<SpendingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!ready || !token) return;
    let current = true;
    setLoading(true); setError('');
    api.get<SpendingOverview>(`/ai/spending/overview?month=${month}`)
      .then(response => { if (current) setData(response.data); })
      .catch(err => { if (current) { setData(null); setError(errorMessage(err)); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [month, ready, token]);

  const gradient = useMemo(() => {
    if (!data?.categories.length || !data.total) return '#edf4f1';
    let running = 0;
    return `conic-gradient(${data.categories.map((item, index) => {
      const start = running;
      running += (item.total / data.total) * 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${running}%`;
    }).join(',')})`;
  }, [data]);

  return <ProtectedRoute allowRoles={['customer']}><main className="dashboard-page"><Navigation title="Phân tích chi tiêu AI"/>
    <section className="dashboard-content ai-page">
      <div className="ai-heading"><div><span className="ai-eyebrow"><AppIcon name="sparkles" size={16}/> TRỢ LÝ TÀI CHÍNH THÔNG MINH</span>
        <h2>Hiểu chi tiêu, quản lý tốt hơn</h2>
        <p>AI tự phân loại nội dung giao dịch và tổng hợp những khoản đã chi trong tháng.</p></div>
        <label className="ai-month-picker">Khoảng thời gian<select value={month} onChange={event => setMonth(event.target.value)}>{choices.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      {loading && <div className="ai-loading">Đang phân tích giao dịch bằng mô hình AI...</div>}
      {error && <div className="form-error">{error} <span>Kiểm tra AI service ở cổng 8008 và Backend ở cổng 3000.</span></div>}
      {data && !loading && <>
        <div className="ai-summary-grid">
          <article className="ai-kpi ai-kpi-highlight"><div className="ai-kpi-icon"><AppIcon name="wallet" size={24}/></div><span>Tổng tiền ra đã phân tích</span><strong>{fmt(data.total)}</strong><small>Trong {data.month}</small></article>
          <article className="ai-kpi"><div className="ai-kpi-icon mint"><AppIcon name="receipt" size={24}/></div><span>Giao dịch được phân tích</span><strong>{data.analyzed}</strong><small>{data.limited ? 'Chỉ hiển thị tối đa 200 giao dịch gần nhất' : 'Giao dịch hoàn thành trong tháng'}</small></article>
          <article className="ai-kpi"><div className="ai-kpi-icon amber"><AppIcon name="layers" size={24}/></div><span>Nhóm chi tiêu</span><strong>{data.categories.length}</strong><small>Dự đoán bằng mô hình NLP</small></article>
        </div>
        <div className="ai-content-grid">
          <section className="ai-panel"><div className="ai-panel-top"><h3>Chi tiêu theo danh mục</h3><span className="ai-flag ai-flag-info">AI phân loại</span></div>
            {!data.categories.length ? <div className="ai-empty">Chưa có giao dịch tiền ra hoàn thành trong tháng này. <Link href="/transfer">Đến trang chuyển tiền</Link></div> : <div className="ai-chart-row"><div className="ai-donut" style={{background:gradient}}><div className="ai-donut-hole"><small>Tổng chi</small><strong>{fmt(data.total)}</strong></div></div><div className="ai-category-list">
              {data.categories.map((item, index) => <div className="ai-category" key={item.category}><span className="ai-color-dot" style={{background:COLORS[index % COLORS.length]}}/><span className="ai-category-name">{item.label}</span><strong>{fmt(item.total)}</strong><small>{data.total ? Math.round(item.total / data.total * 100) : 0}%</small></div>)}
            </div></div>}
          </section>
          <section className="ai-panel ai-insight"><div className="ai-panel-top"><h3>Gợi ý từ dữ liệu</h3><AppIcon name="sparkles" size={20}/></div>
            {data.categories.length ? <><p>Danh mục cao nhất trong tháng là <strong>{data.categories[0].label}</strong>, chiếm <strong>{Math.round(data.categories[0].total / Math.max(1,data.total) * 100)}%</strong> số tiền ra được phân tích.</p>
              <div className="ai-insight-feature"><AppIcon name="info" size={19}/><span>Đây là thống kê tự động từ nhãn AI dự đoán, không phải tư vấn tài chính cá nhân.</span></div>
              <Link className="ai-outline-link" href="/transactions">Xem toàn bộ giao dịch <AppIcon name="arrow-right" size={17}/></Link>
            </> : <p>Khi bạn có giao dịch phù hợp, kết quả phân tích sẽ xuất hiện ở đây.</p>}
            <div className="ai-model-label">Mô hình: {data.model}<br/>Dữ liệu huấn luyện minh họa (không dùng dữ liệu ngân hàng thực).</div>
          </section>
        </div>
        <section className="ai-panel ai-table-panel"><div className="ai-panel-top"><h3>Phân loại từng giao dịch</h3><span className="ai-table-count">{data.transactions.length} giao dịch</span></div>
          {data.transactions.length ? <div className="ai-table-wrap"><table className="ai-table"><thead><tr><th>Nội dung</th><th>Ngày</th><th>AI dự đoán</th><th>Số tiền</th><th>Độ tin cậy</th></tr></thead><tbody>
            {data.transactions.map(tx => <tr key={tx.id}><td><strong>{tx.description}</strong></td><td>{new Date(tx.createdAt).toLocaleDateString('vi-VN')}</td><td><span className={`ai-category-chip ${tx.needsReview ? 'needs-review' : ''}`}>{tx.categoryLabel}</span></td><td className="ai-money">{fmt(tx.amount)}</td><td>{tx.category === 'rut_tien' ? 'Theo loại giao dịch' : `${Math.round(tx.confidence * 100)}%${tx.needsReview ? ' · cần xem lại' : ''}`}</td></tr>)}
          </tbody></table></div> : <p className="ai-empty">Không có dữ liệu cho khoảng thời gian đã chọn.</p>}
        </section>
        <p className="ai-caveat"><AppIcon name="info" size={17}/>{data.notice} Mô hình mới ở mức thử nghiệm và cần dữ liệu gán nhãn thực tế để đánh giá độ chính xác.</p>
      </>}
    </section>
  </main></ProtectedRoute>;
}
