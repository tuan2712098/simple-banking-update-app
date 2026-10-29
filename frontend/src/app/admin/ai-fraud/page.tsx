'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Navigation from '../../../components/Navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import AppIcon from '../../../components/AppIcon';
import { errorMessage } from '../../../components/ErrorNotice';
import { formatVnd } from '../../../lib/money';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

type RiskTx = {
  id: string; createdAt: string; amount: number; fromAccount: string; toAccount: string;
  anomaly: boolean; status: string; anomalyScore: number; reasons: string[]; historyCount: number;
};
type FraudOverview = {
  scanned: number; sourceCount: number; sampled: boolean; suspicious: number;
  transactions: RiskTx[]; model: string; trainingData: string; notice: string;
};

export default function AiFraudPage() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.accessToken);
  const [data,setData] = useState<FraudOverview | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [onlyAnomaly,setOnlyAnomaly] = useState(false);
  const load = useCallback(async () => {
    if (user?.role !== 'admin' || !token) return;
    setBusy(true); setError('');
    try { const response = await api.get<FraudOverview>('/ai/fraud/overview'); setData(response.data); }
    catch (err) { setData(null); setError(errorMessage(err)); }
    finally { setBusy(false); }
  }, [user?.role, token]);
  useEffect(() => { void load(); }, [load]);
  const shown = data?.transactions.filter(row => !onlyAnomaly || row.anomaly) || [];
  return <ProtectedRoute allowRoles={['admin']}><main className="dashboard-page"><Navigation title="AI giám sát giao dịch"/>
    <section className="dashboard-content ai-page">
      <div className="ai-heading"><div><span className="ai-eyebrow"><AppIcon name="shield" size={16}/> GIÁM SÁT GIAO DỊCH BẰNG AI</span>
        <h2>Phát hiện giao dịch bất thường</h2><p>Mô hình nhận diện các giao dịch khác biệt để quản trị viên chủ động xem xét.</p></div>
        <button className="ai-refresh" disabled={busy} onClick={() => void load()}><AppIcon name="refresh" size={16}/>{busy ? 'Đang phân tích...' : 'Phân tích lại'}</button>
      </div>
      {error && <div className="form-error">{error} <span>Hãy chạy AI service ở cổng 8008 và kiểm tra Backend.</span></div>}
      {busy && !data && <div className="ai-loading">Mô hình Isolation Forest đang phân tích dữ liệu giao dịch...</div>}
      {data && <>
        <div className="ai-summary-grid"><article className="ai-kpi"><div className="ai-kpi-icon mint"><AppIcon name="activity" size={23}/></div><span>Giao dịch đã phân tích</span><strong>{data.scanned}</strong><small>Giao dịch chuyển khoản hoàn thành</small></article>
          <article className="ai-kpi"><div className="ai-kpi-icon amber"><AppIcon name="shield" size={23}/></div><span>Có dấu hiệu bất thường</span><strong>{data.suspicious}</strong><small>Chỉ cảnh báo, không tự động khóa</small></article>
          <article className="ai-kpi ai-kpi-highlight"><div className="ai-kpi-icon"><AppIcon name="layers" size={23}/></div><span>Mô hình AI</span><strong className="ai-model-title">Isolation Forest</strong><small>Dữ liệu huấn luyện giả lập</small></article>
        </div>
        <div className="ai-panel ai-table-panel"><div className="ai-panel-top"><div><h3>Danh sách đánh giá</h3><p>Chỉ số bất thường không phải xác suất gian lận.</p></div><label className="ai-switch"><input type="checkbox" checked={onlyAnomaly} onChange={e=>setOnlyAnomaly(e.target.checked)}/> Chỉ hiện bất thường</label></div>
          {shown.length ? <div className="ai-table-wrap"><table className="ai-table"><thead><tr><th>Thời gian / Giao dịch</th><th>Tài khoản</th><th>Số tiền</th><th>Kết quả AI</th><th>Dấu hiệu cần xem xét</th></tr></thead><tbody>
            {shown.map(tx => <tr key={tx.id}><td><strong>{new Date(tx.createdAt).toLocaleString('vi-VN')}</strong><small className="ai-secondary-line">{tx.id.slice(0,8)}...</small></td><td>{tx.fromAccount} → {tx.toAccount}</td><td className="ai-money">{formatVnd(String(tx.amount))}</td><td><span className={`ai-flag ${tx.anomaly ? 'ai-flag-warning':'ai-flag-good'}`}>{tx.status}</span></td><td className="ai-reasons">{tx.reasons.join('; ')}{tx.historyCount < 5 ? <small className="ai-secondary-line">Dữ liệu lịch sử hạn chế</small> : null}</td></tr>)}
          </tbody></table></div> : <div className="ai-empty">{data.scanned ? 'Không có giao dịch phù hợp với bộ lọc.' : 'Chưa có giao dịch chuyển khoản hoàn thành để phân tích.'}</div>}
          <p className="ai-table-foot">Đang sử dụng tối đa 500 giao dịch gần nhất làm lịch sử để đánh giá tối đa 80 giao dịch. {data.sampled ? 'Lịch sử đã bị giới hạn 500 giao dịch.' : ''}</p>
        </div>
        <div className="ai-insight ai-panel"><div className="ai-panel-top"><h3>Nguyên tắc an toàn</h3><AppIcon name="info" size={19}/></div>
          <p>{data.notice} Không nên thay thế quy trình duyệt giao dịch và các biện pháp kiểm soát đang có bằng kết quả từ mô hình này.</p>
          <Link href="/admin" className="ai-outline-link">Quay lại quản trị <AppIcon name="arrow-right" size={16}/></Link>
        </div>
      </>}
    </section>
  </main></ProtectedRoute>;
}
