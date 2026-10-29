// Gợi ý UX chỉ dành cho màn hình; Backend kiểm tra quy tắc mật khẩu chính thức.
export const NEW_PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_MAX_BYTES = 72;

export function passwordFeedback(password: string, email?: string) {
  const length = Array.from(password).length;
  const bytes = new TextEncoder().encode(password).length;
  const emailPrefix = email?.split('@')[0]?.toLowerCase() || '';
  const hasEmail = emailPrefix.length >= 5 && password.toLowerCase().includes(emailPrefix);
  const blocked = new Set(['123456789012345', '1234567890123456', 'password123456789', 'passwordpassword', 'admin123456789012', 'qwertyuiop123456', 'demo@123456', 'demo@1234567890', 'matkhau123456789']);
  const weak = blocked.has(password.trim().toLowerCase()) || /^(.)\1{14,}$/u.test(password);
  const valid = length >= NEW_PASSWORD_MIN_LENGTH && bytes <= BCRYPT_MAX_BYTES && !hasEmail && !weak;
  let level = 0;
  if (length >= 8) level = 1;
  if (length >= NEW_PASSWORD_MIN_LENGTH) level = 2;
  if (length >= 20) level = 3;
  if (length >= 24) level = 4;
  if (weak || hasEmail) level = Math.min(level, 1);
  const title = ['', 'Còn yếu', 'Đủ độ dài', 'Khá tốt', 'Dài và tốt'][level];
  const hint = bytes > BCRYPT_MAX_BYTES ? 'Mật khẩu vượt 72 byte (giới hạn của bcrypt).' :
    length < NEW_PASSWORD_MIN_LENGTH ? `Cần ít nhất ${NEW_PASSWORD_MIN_LENGTH} ký tự; ưu tiên cụm từ dài, dễ nhớ nhưng khó đoán.` :
    weak ? 'Mật khẩu này quá phổ biến hoặc dễ đoán.' :
    hasEmail ? 'Không dùng tên email trong mật khẩu.' :
    'Đạt yêu cầu về độ dài. Hãy dùng mật khẩu riêng, chưa sử dụng ở nơi khác.';
  return { valid, level, title, hint };
}
