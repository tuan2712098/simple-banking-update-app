'use client';

import { useState } from 'react';
import AppIcon from './AppIcon';

interface PasswordFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password' | 'off';
  placeholder?: string;
  shell?: boolean;
  minLength?: number;
}

export default function PasswordField({ id, name, label, value, onChange, autoComplete, placeholder, shell = false, minLength }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return <>
    <label htmlFor={id}>{label}</label>
    <div className={shell ? 'field-shell secure-password-input' : 'secure-password-input standalone-password'}>
      {shell && <AppIcon name="lock" size={19} />}
      <input id={id} name={name || id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete} minLength={minLength} placeholder={placeholder} required spellCheck={false} autoCapitalize="none" autoCorrect="off" />
      <button type="button" className="password-toggle" onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} aria-pressed={visible}
        title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
        <AppIcon name={visible ? 'eye-off' : 'eye'} size={19} />
      </button>
    </div>
  </>;
}
