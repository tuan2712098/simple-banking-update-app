import type { ReactNode, SVGProps } from 'react';

type IconName = 'grid' | 'arrow-up-right' | 'arrow-down-left' | 'history' | 'wallet' | 'user' | 'shield' | 'logout' | 'chevron-right' | 'chevron-left' | 'bell' | 'sparkles' | 'check' | 'copy' | 'eye' | 'eye-off' | 'lock' | 'clock' | 'activity' | 'credit-card' | 'filter' | 'search' | 'menu' | 'x' | 'mail' | 'refresh' | 'settings' | 'info' | 'building' | 'more' | 'arrow-right' | 'calendar' | 'layers' | 'receipt' | 'help' | 'circle-check' | 'plus' | 'fingerprint';

export default function AppIcon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const p: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>,
    'arrow-up-right': <><path d="M7 17 17 7M8 7h9v9"/></>,
    'arrow-down-left': <><path d="M17 7 7 17M16 17H7V8"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M16 13h5M3 8V5a2 2 0 0 1 2-2h12"/><circle cx="16.8" cy="13" r=".7" fill="currentColor" stroke="none"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
    'chevron-right': <path d="m9 18 6-6-6-6"/>,
    'chevron-left': <path d="m15 18-6-6 6-6"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    sparkles: <><path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3ZM20 18l.6 1.4L22 20l-1.4.6L20 22l-.6-1.4L18 20l1.4-.6L20 18Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    'eye-off': <><path d="M3 3 21 21M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a13 13 0 0 1-3.1 3.8M6.2 6.2C3.5 8.1 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.2-1"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4"/>,
    'credit-card': <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h5"/></>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    x: <path d="M5 5 19 19M19 5 5 19"/>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/></>,
    building: <><path d="M3 21V5l9-3 9 3v16M1 21h22M9 21v-5h6v5M7 8h1M16 8h1M7 12h1M16 12h1"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    receipt: <><path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3ZM8 8h8M8 12h8"/></>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 1 1 5 2c-1.5 1-2 1.6-2 3M12 17h.01"/></>,
    'circle-check': <><circle cx="12" cy="12" r="10"/><path d="m7 12 3.5 3.5L17 9"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    fingerprint: <><path d="M4 12V9a8 8 0 0 1 16 0v2M8 20c2-3 2-6 2-9a2 2 0 0 1 4 0v6M6 15c0 2-.5 3.5-1.5 5M17 20c1.5-3 2-6 2-9M13 21c1.1-1.9 2-5 2-9"/></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{p[name]}</svg>;
}
