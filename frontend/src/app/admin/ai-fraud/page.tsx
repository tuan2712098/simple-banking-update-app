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
  anomaly: boolean; status: string; anomalyScore: number; reasons: string[]; historyCount: number; reviewStatus: string;
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
  const [acting,setActing] = useState('');
  const [message,setMessage] = useState('');
  const load = useCallback(async () => {
    if (user?.role !== 'admin' || !token) return;
    setBusy(true); setError('');
    try { const response = await api.get<FraudOverview>('/ai/fraud/overview'); setData(response.data); }
    catch (err) { setData(null); setError(errorMessage(err)); }
    finally { setBusy(false); }
  }, [user?.role, token]);
  useEffect(() => { void load(); }, [load]);
  async function act(id: string, action: 'flag' | 'approve' | 'reject') {
    setActing(id); setError(''); setMessage('');
    try {
      if (action === 'flag') await api.post(`/admin/transactions/${id}/flag`);
      else await api.patch(`/admin/flagged-transactions/${id}/${action}`);
      setMessage(action === 'flag' ? 'Đã đưa giao dịch vào danh sách cần kiểm tra.' : action === 'approve' ? 'Đã xác nhận giao dịch bình thường.' : 'Đã xác nhận giao dịch đáng ngờ.');
      const status = action === 'flag' ? 'flagged' : action === 'approve' ? 'approved' : 'rejected';
      setData(current => current && { ...current, transactions: current.transactions.map(row => row.id === id ? { ...row, reviewStatus: status } : row) });
    } catch (err) { setError(errorMessage(err)); }
    finally { setActing(''); }
  }
  const shown = data?.transactions.filter(row => !onlyAnomaly || row.anomaly) || [];
  return <ProtectedRoute allowRoles={['admin']}><main className="dashboard-page"><Navigation title="AI giám sát giao dịch"/>
    <section className="dashboard-content ai-page">
      <div className="ai-heading"><div><span className="ai-eyebrow"><AppIcon name="shield" size={16}/> GIÁM SÁT GIAO DỊCH BẰNG AI</span>
        <h2>Phát hiện giao dịch bất thường</h2><p>Mô hình nhận diện các giao dịch khác biệt để quản trị viên chủ động xem xét.</p></div>
        <button className="ai-refresh" disabled={busy} onClick={() => void load()}><AppIcon name="refresh" size={16}/>{busy ? 'Đang phân tích...' : 'Phân tích lại'}</button>
      </div>
      {message && <p className="form-success">{message}</p>}
      {error && <div className="form-error">{error} <span>Hãy chạy AI service ở cổng 8008 và kiểm tra Backend.</span></div>}
      {busy && !data && <div className="ai-loading">Hệ thống đang phân tích dữ liệu giao dịch...</div>}
      {data && <>
        <div className="ai-summary-grid"><article className="ai-kpi"><div className="ai-kpi-icon mint"><AppIcon name="activity" size={23}/></div><span>Giao dịch đã phân tích</span><strong>{data.scanned}</strong><small>Giao dịch chuyển khoản hoàn thành</small></article>
          <article className="ai-kpi"><div className="ai-kpi-icon amber"><AppIcon name="shield" size={23}/></div><span>Có dấu hiệu bất thường</span><strong>{data.suspicious}</strong><small>Chỉ cảnh báo, không tự động khóa</small></article>
          <article className="ai-kpi ai-kpi-highlight"><div className="ai-kpi-icon"><AppIcon name="layers" size={23}/></div><span>Mô hình AI</span><strong className="ai-model-title">Baseline cá nhân</strong><small>Tài khoản ít lịch sử dùng Isolation Forest</small></article>
        </div>
        <div className="ai-panel ai-table-panel"><div className="ai-panel-top"><div><h3>Danh sách đánh giá</h3><p>Chỉ số bất thường không phải xác suất gian lận.</p></div><label className="ai-switch"><input type="checkbox" checked={onlyAnomaly} onChange={e=>setOnlyAnomaly(e.target.checked)}/> Chỉ hiện bất thường</label></div>
          {shown.length ? <div className="ai-table-wrap"><table className="ai-table"><thead><tr><th>Thời gian / Giao dịch</th><th>Tài khoản</th><th>Số tiền</th><th>Kết quả AI</th><th>Dấu hiệu cần xem xét</th><th>Xử lý</th></tr></thead><tbody>
            {shown.map(tx => <tr key={tx.id}><td><strong>{new Date(tx.createdAt).toLocaleString('vi-VN')}</strong><small className="ai-secondary-line">{tx.id.slice(0,8)}...</small></td><td>{tx.fromAccount} → {tx.toAccount}</td><td className="ai-money">{formatVnd(String(tx.amount))}</td><td><span className={`ai-flag ${tx.anomaly ? 'ai-flag-warning':'ai-flag-good'}`}>{tx.status}</span></td><td className="ai-reasons">{tx.reasons.join('; ')}{tx.historyCount < 5 ? <small className="ai-secondary-line">Dữ liệu lịch sử hạn chế</small> : null}</td>
              <td className="ai-actions">{!tx.anomaly ? '—' : <>
                {tx.reviewStatus === 'none' && <button type="button" disabled={acting === tx.id} onClick={() => void act(tx.id, 'flag')}>Đánh dấu cần kiểm tra</button>}
                {tx.reviewStatus === 'flagged' && <><span className="ai-flag ai-flag-warning">Đang chờ kiểm tra</span><button type="button" disabled={acting === tx.id} onClick={() => void act(tx.id, 'approve')}>Bình thường</button><button type="button" disabled={acting === tx.id} onClick={() => void act(tx.id, 'reject')}>Đáng ngờ</button></>}
                {tx.reviewStatus === 'approved' && <span className="ai-flag ai-flag-good">Đã xác nhận bình thường</span>}
                {tx.reviewStatus === 'rejected' && <span className="ai-flag ai-flag-warning">Đã xác nhận đáng ngờ</span>}
                <Link href={`/admin/transactions?search=${tx.id}`}>Xem / hoàn trả</Link>
              </>}</td></tr>)}
          </tbody></table></div> : <div className="ai-empty">{data.scanned ? 'Không có giao dịch phù hợp với bộ lọc.' : 'Chưa có giao dịch chuyển khoản hoàn thành để phân tích.'}</div>}
          <p className="ai-table-foot">Đánh giá tối đa 80 giao dịch gần nhất, mỗi giao dịch được so với toàn bộ lịch sử của tài khoản gửi. Tài khoản có dưới 5 giao dịch dùng mô hình tham chiếu chung nên dễ bị gắn cờ hơn. {data.sampled ? 'Lịch sử đã bị giới hạn do quá lớn.' : ''}</p>
        </div>
        <div className="ai-insight ai-panel"><div className="ai-panel-top"><h3>Nguyên tắc an toàn</h3><AppIcon name="info" size={19}/></div>
          <p>{data.notice} Không nên thay thế quy trình duyệt giao dịch và các biện pháp kiểm soát đang có bằng kết quả từ mô hình này.</p>
          <Link href="/admin" className="ai-outline-link">Quay lại quản trị <AppIcon name="arrow-right" size={16}/></Link>
        </div>
      </>}
    </section>
  </main></ProtectedRoute>;
}
