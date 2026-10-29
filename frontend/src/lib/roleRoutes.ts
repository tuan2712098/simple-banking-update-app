import type { AuthUser } from '../store/authStore';

export function homeForRole(role?: AuthUser['role'] | null): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'teller') return '/teller/dashboard';
  return '/dashboard';
}
