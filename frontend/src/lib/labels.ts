/** Nhãn tiếng Việt cho các mã nghiệp vụ nhận từ API. Không thay đổi giá trị gửi về Backend. */
const TRANSACTION_TYPES: Record<string, string> = {
  transfer: 'Chuyển khoản',
  deposit: 'Nạp tiền',
  withdrawal: 'Rút tiền',
  reversal: 'Hoàn trả',
};

const TRANSACTION_STATUSES: Record<string, string> = {
  COMPLETED: 'Thành công',
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang xử lý',
  PENDING_OTP: 'Chờ xác nhận OTP',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  FAILED: 'Thất bại',
  REVERSED: 'Đã hoàn trả',
  CANCELLED: 'Đã hủy',
  CANCELED: 'Đã hủy',
  FLAGGED: 'Cần kiểm tra',
  REJECTED: 'Đã từ chối',
  APPROVED: 'Đã phê duyệt',
};

const ACCOUNT_STATUSES: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  FROZEN: 'Tạm khóa',
  CLOSED: 'Đã đóng',
  active: 'Đang hoạt động',
  locked: 'Đã khóa',
  inactive: 'Ngừng hoạt động',
};

const ACCOUNT_TIERS: Record<string, string> = {
  STANDARD: 'Tiêu chuẩn',
  VIP: 'Ưu tiên',
  PREMIUM: 'Cao cấp',
};

const USER_ROLES: Record<string, string> = {
  customer: 'Khách hàng',
  teller: 'Giao dịch viên',
  admin: 'Quản trị viên',
  CUSTOMER: 'Khách hàng',
  TELLER: 'Giao dịch viên',
  ADMIN: 'Quản trị viên',
};

/** Khi nhận mã không xác định, dùng nhãn an toàn thay vì phơi bày từ tiếng Anh lên UI. */
export function transactionTypeLabel(value: string): string {
  return TRANSACTION_TYPES[value] ?? 'Giao dịch khác';
}

export function transactionStatusLabel(value: string): string {
  return TRANSACTION_STATUSES[value] ?? 'Chưa xác định';
}

export function accountStatusLabel(value: string): string {
  return ACCOUNT_STATUSES[value] ?? 'Chưa xác định';
}

export function accountTierLabel(value: string): string {
  return ACCOUNT_TIERS[value] ?? 'Khác';
}

export function userRoleLabel(value: string): string {
  return USER_ROLES[value] ?? 'Người dùng';
}

export function transactionStatusTone(value: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === 'COMPLETED' || value === 'APPROVED') return 'success';
  if (value === 'FAILED' || value === 'REJECTED' || value === 'CANCELLED') return 'danger';
  if (value === 'PENDING_OTP' || value === 'PROCESSING' || value === 'PENDING' || value === 'PENDING_APPROVAL' || value === 'FLAGGED') return 'warning';
  return 'neutral';
}

const AUDIT_ACTIONS: Record<string, string> = {
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  TRANSFER: 'Chuyển khoản',
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  REVERSAL: 'Hoàn trả',
};

export function auditActionLabel(value: string): string {
  return AUDIT_ACTIONS[value] ?? 'Hoạt động hệ thống';
}

const AUDIT_ENTITIES: Record<string, string> = {
  User: 'Người dùng', UserEntity: 'Người dùng', user: 'Người dùng', users: 'Người dùng',
  Account: 'Tài khoản', AccountEntity: 'Tài khoản', account: 'Tài khoản', accounts: 'Tài khoản',
  Transaction: 'Giao dịch', TransactionEntity: 'Giao dịch', transaction: 'Giao dịch', transactions: 'Giao dịch',
  AuditLog: 'Nhật ký', Ledger: 'Sổ cái', RefreshSession: 'Phiên đăng nhập',
};

export function auditEntityLabel(value: string): string {
  return AUDIT_ENTITIES[value] ?? 'Dữ liệu hệ thống';
}
