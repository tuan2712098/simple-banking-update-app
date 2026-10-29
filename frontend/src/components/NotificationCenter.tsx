'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import type { AuthUser } from '../store/authStore';
import { transactionStatusLabel } from '../lib/labels';
import AppIcon from './AppIcon';

type Notice = { id: string; title: string; detail: string; href: string; time?: string; kind: 'warning' | 'info' };
type Transaction = { id: string; status: string; amount: string; createdAt: string; reviewStatus?: string; tellerInitiated?: boolean; approvedById?: string | null };

function dateText(date?: string) {
  if (!date) return '';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString('vi-VN');
}

export default function NotificationCenter({ role }: { role?: AuthUser['role'] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, []);

  async function refresh() {
    if (role === 'teller') { setItems([]); return; }
    setLoading(true); setError('');
    try {
      if (role === 'admin') {
        const [flaggedResult, txResult] = await Promise.all([
          api.get<Transaction[]>('/admin/flagged-transactions'),
          api.get<Transaction[]>('/admin/transactions'),
        ]);
        const pending = txResult.data.filter(tx => tx.tellerInitiated && tx.status === 'PENDING_OTP' && !tx.approvedById);
        const notices: Notice[] = [
          ...flaggedResult.data.map(tx => ({ id: `flagged-${tx.id}`, title: 'Giao dịch cần xem xét', detail: `Mã ${tx.id.slice(0, 8)}… · ${Number(tx.amount).toLocaleString('vi-VN')} VND`, href: '/admin', time: tx.createdAt, kind: 'warning' as const })),
          ...pending.map(tx => ({ id: `pending-${tx.id}`, title: 'Chờ phê duyệt giao dịch', detail: `Mã ${tx.id.slice(0, 8)}… · ${Number(tx.amount).toLocaleString('vi-VN')} VND`, href: '/admin', time: tx.createdAt, kind: 'warning' as const })),
        ];
        setItems(notices.sort((a, b) => (b.time || '').localeCompare(a.time || '')).slice(0, 8));
      } else {
        const response = await api.get<{ data: Transaction[] }>('/transactions?page=1&limit=6&sort=desc');
        setItems(response.data.data.map(tx => ({
          id: `tx-${tx.id}`,
          title: `Giao dịch: ${transactionStatusLabel(tx.status)}`,
          detail: `${Number(tx.amount).toLocaleString('vi-VN')} VND · Mã ${tx.id.slice(0, 8)}…`,
          href: `/transactions?search=${encodeURIComponent(tx.id)}`,
          time: tx.createdAt,
          kind: tx.status === 'FAILED' ? 'warning' : 'info',
        })));
      }
    } catch {
      setError('Chưa tải được thông tin. Hãy thử lại.');
      setItems([]);
    } finally { setLoading(false); }
  }

  function toggle() {
    if (!open) void refresh();
    setOpen(value => !value);
  }

  return <div className="notification-anchor" ref={wrapper}>
    <button className="header-icon-button notification-trigger" type="button" aria-label="Mở thông báo" aria-expanded={open} aria-haspopup="dialog" onClick={toggle} title="Thông báo">
      <AppIcon name="bell" size={19}/>
    </button>
    {open && <section className="notification-panel" role="dialog" aria-label="Thông báo từ hệ thống">
      <div className="notification-panel-top"><div><strong>Thông báo</strong><small>{role === 'admin' ? 'Các mục nghiệp vụ cần xử lý' : role === 'teller' ? 'Thông tin nghiệp vụ' : 'Giao dịch mới nhất của bạn'}</small></div><button type="button" aria-label="Làm mới thông báo" title="Làm mới" disabled={loading} onClick={() => void refresh()}><AppIcon name="refresh" size={17}/></button></div>
      <div className="notification-items">
        {loading && <p className="notification-empty">Đang cập nhật thông báo...</p>}
        {error && <p className="notification-error">{error}</p>}
        {!loading && !error && items.length === 0 && <div className="notification-empty"><AppIcon name="bell" size={23}/><span>Hiện chưa có thông báo nào.</span>{role === 'teller' && <small>Tác vụ tại quầy được quản lý trong trang Nghiệp vụ.</small>}</div>}
        {!loading && items.map(item => <Link key={item.id} href={item.href} className="notification-entry" onClick={() => setOpen(false)}><span className={`notice-mark ${item.kind}`}><AppIcon name={item.kind === 'warning' ? 'shield' : 'receipt'} size={18}/></span><span><strong>{item.title}</strong><small>{item.detail}</small>{item.time && <em>{dateText(item.time)}</em>}</span></Link>)}
      </div>
      <div className="notification-panel-bottom">Thông tin lấy từ dữ liệu hiện có · Chưa hỗ trợ đánh dấu đã đọc</div>
    </section>}
  </div>;
}
