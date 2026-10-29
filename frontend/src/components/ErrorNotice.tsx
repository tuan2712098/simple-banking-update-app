'use client';

import axios from 'axios';

/** Hiển thị lỗi bằng tiếng Việt; không hiển thị trực tiếp lỗi kỹ thuật từ máy chủ. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại.';
    const status = error.response.status;
    const raw = error.response.data?.message;
    const text = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '';
    const known: Array<[RegExp, string]> = [
      [/insufficient (funds|balance)/i, 'Số dư không đủ để thực hiện giao dịch.'],
      [/invalid credentials|incorrect password|wrong password/i, 'Email hoặc mật khẩu không chính xác.'],
      [/account not found|recipient not found/i, 'Không tìm thấy tài khoản nhận.'],
      [/account (is )?(locked|frozen)/i, 'Tài khoản đã bị tạm khóa.'],
      [/otp (is )?(invalid|expired)|invalid otp/i, 'Mã OTP không đúng hoặc đã hết hạn.'],
      [/already exists|already registered/i, 'Thông tin này đã được đăng ký trước đó.'],
      [/too many requests/i, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'],
    ];
    for (const [pattern, message] of known) {
      if (pattern.test(text)) return message;
    }
    if (status === 401) return 'Phiên đăng nhập đã hết hạn hoặc thông tin xác thực không đúng.';
    if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (status === 404) return 'Không tìm thấy thông tin yêu cầu.';
    if (status === 409) return 'Thao tác bị trùng hoặc dữ liệu có xung đột. Vui lòng kiểm tra lại.';
    if (status === 429) return 'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.';
    if (status >= 500) return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
    return 'Không thể thực hiện yêu cầu. Vui lòng kiểm tra thông tin và thử lại.';
  }
  if (error instanceof Error && error.message.startsWith('Không')) return error.message;
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}
