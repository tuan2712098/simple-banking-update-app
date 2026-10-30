'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { homeForRole } from '../lib/roleRoutes';
import NotificationCenter from './NotificationCenter';
import AppIcon from './AppIcon';

type NavLink = { href: string; label: string; icon: 'grid' | 'arrow-up-right' | 'history' | 'sparkles' | 'user' | 'settings' | 'shield' | 'receipt' | 'search' };
const customerLinks: NavLink[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: 'grid' },
  { href: '/transfer', label: 'Chuyển tiền', icon: 'arrow-up-right' },
  { href: '/transactions', label: 'Lịch sử giao dịch', icon: 'history' },
  { href: '/ai/spending', label: 'AI phân tích chi tiêu', icon: 'sparkles' },
  { href: '/account', label: 'Tài khoản của tôi', icon: 'user' },
];
const tellerLinks: NavLink[] = [
  { href: '/teller/dashboard', label: 'Tổng quan quầy', icon: 'grid' },
  { href: '/teller/operations', label: 'Nghiệp vụ tại quầy', icon: 'receipt' },
  { href: '/account', label: 'Hồ sơ của tôi', icon: 'user' },
];
const adminLinks: NavLink[] = [
  { href: '/admin/dashboard', label: 'Tổng quan hệ thống', icon: 'grid' },
  { href: '/admin/transactions', label: 'Tra cứu giao dịch', icon: 'search' },
  { href: '/admin', label: 'Quản lý & phê duyệt', icon: 'settings' },
  { href: '/admin/ai-fraud', label: 'AI phát hiện bất thường', icon: 'shield' },
  { href: '/account', label: 'Hồ sơ của tôi', icon: 'user' },
];

export default function Navigation({ title }: { title: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const name = user?.fullName || 'Người dùng';
  const firstName = name.trim().split(/\s+/).slice(-1)[0];
  const initials = name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'SB';
  const role = user?.role === 'admin' ? 'Quản trị viên' : user?.role === 'teller' ? 'Giao dịch viên' : 'Khách hàng';
  const links = user?.role === 'admin' ? adminLinks : user?.role === 'teller' ? tellerLinks : customerLinks;
  const home = homeForRole(user?.role);
  const isHome = pathname === home;
  const searchHint = user?.role === 'admin' ? 'Mã giao dịch, trạng thái...' : user?.role === 'teller' ? 'Số tài khoản nạp tiền...' : 'Mã giao dịch, số tài khoản...';

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    if (!term) return;
    const page = user?.role === 'admin' ? '/admin/transactions' : user?.role === 'teller' ? '/teller/operations' : '/transactions';
    const param = user?.role === 'teller' ? 'account' : 'search';
    router.push(`${page}?${new URLSearchParams({ [param]: term }).toString()}`);
    setMenuOpen(false);
  }
  async function handleLogout() {
    setMenuOpen(false);
    try { await logout(); } finally { router.replace('/login'); }
  }
  const isSelected = (href: string) => pathname === href;

  return <>
    <aside className={`app-sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Thanh điều hướng">
      <Link href={home} className="sidebar-brand" onClick={() => setMenuOpen(false)}><span className="brand-emblem"><AppIcon name="layers" size={23}/></span><span><strong>Lumi<span>Bank</span></strong><small>NGÂN HÀNG SỐ MÔ PHỎNG</small></span></Link>
      <div className="sidebar-navigation"><span className="sidebar-group-label">{user?.role === 'admin' ? 'QUẢN TRỊ HỆ THỐNG' : user?.role === 'teller' ? 'GIAO DỊCH TẠI QUẦY' : 'DÀNH CHO BẠN'}</span>
        {links.map(item => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="sidebar-link" aria-current={isSelected(item.href) ? 'page' : undefined}><AppIcon name={item.icon} size={19}/><span>{item.label}</span></Link>)}
      </div>
      <div className="sidebar-bottom"><div className="sidebar-security"><span className="sidebar-security-icon"><AppIcon name="shield" size={20}/></span><div><strong>{user?.role === 'admin' ? 'Khu vực quản trị' : user?.role === 'teller' ? 'Tác nghiệp có kiểm soát' : 'An tâm giao dịch'}</strong><span>Hệ thống ngân hàng mô phỏng</span></div></div><button className="sidebar-user" type="button" onClick={() => void handleLogout()} title="Đăng xuất"><span className="sidebar-avatar">{initials}</span><span className="sidebar-user-info"><strong>{name}</strong><span>{role} · Đăng xuất</span></span><AppIcon name="logout" size={17}/></button></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}/>}
    <header className="dashboard-header"><div className="header-start"><button className="mobile-menu" type="button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} onClick={() => setMenuOpen(!menuOpen)}><AppIcon name={menuOpen ? 'x' : 'menu'}/></button><div className="header-title"><span className="header-breadcrumb">{user?.role === 'admin' ? 'Quản trị' : user?.role === 'teller' ? 'Giao dịch viên' : 'Ngân hàng của bạn'} <AppIcon name="chevron-right" size={13}/> {title}</span><h1>{isHome ? <>Xin chào, {firstName} <span aria-hidden="true">👋</span></> : title}</h1>{isHome && <p className="header-subtitle">{user?.role === 'admin' ? 'Tổng hợp hoạt động và các công việc cần xem xét.' : user?.role === 'teller' ? 'Hỗ trợ khách hàng nhanh chóng và chính xác.' : 'Chúc bạn một ngày tốt lành và nhiều niềm vui!'}</p>}</div></div>
      <div className="header-tools"><form role="search" className="header-search-form" onSubmit={submitSearch}><button type="button" className="header-search-open" aria-label="Mở tìm kiếm" onClick={() => searchInputRef.current?.focus()}><AppIcon name="search" size={18}/></button><input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchHint} aria-label={searchHint} maxLength={80}/><button type="submit" title="Tìm kiếm" aria-label="Tìm kiếm"><AppIcon name="arrow-right" size={17}/></button></form><NotificationCenter role={user?.role}/><Link href="/account" className="header-profile" title="Hồ sơ của tôi"><span className="header-avatar">{initials}</span><span><strong>{name}</strong><small>{role}</small></span><AppIcon name="chevron-right" size={14}/></Link></div>
    </header>
  </>;
}
