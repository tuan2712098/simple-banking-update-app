# SimpleBank UI Pro — cập nhật giao diện hiện đại

## Những phần được thay đổi

- Sidebar bên trái trên desktop, menu mở/đóng trên mobile.
- Dashboard: thẻ số dư hiện đại, thao tác nhanh, 4 giao dịch gần nhất lấy từ API.
- Chuyển tiền: form rõ ràng và khung tóm tắt dữ liệu đang nhập, giữ nguyên xử lý OTP và Idempotency Key.
- Lịch sử: danh sách giao dịch, bộ lọc và trạng thái tiếng Việt.
- Đăng nhập / đăng ký: bố cục 2 cột, dùng chung bảng màu và biểu tượng.
- Tài khoản: khu vực hồ sơ, thay đổi email/mật khẩu, lịch sử thay đổi.
- Admin: nhận style dùng chung; không thay đổi nghiệp vụ.
- Hiệu ứng hover (nổi nhẹ), trạng thái focus, giao diện responsive, hỗ trợ reduced motion.

Không có thư viện mới, không thay đổi API, Backend, khóa crypto, file `.env` hoặc database.

## Cách cập nhật an toàn bằng PowerShell

Mở terminal tại thư mục gốc dự án: `C:\Downloads\Simple_Banking_App_Security_Integrated`.

```powershell
# Bước 1: Sao lưu Frontend đang chạy
Copy-Item .\frontend\src ".\frontend\src_backup_$(Get-Date -Format yyyyMMdd_HHmmss)" -Recurse -Force

# Bước 2: Giải nén gói UI mới vào gốc dự án
Expand-Archive -LiteralPath "C:\Downloads\Simple_Banking_UI_Hien_Dai.zip" -DestinationPath "." -Force
```

Nếu `npm run dev` cho frontend đã chạy trên cổng 3001, chỉ cần tải lại `http://localhost:3001` bằng `Ctrl + Shift + R`. **Không cần mở thêm một phiên frontend**, tránh lỗi `EADDRINUSE`.

Nếu cần khởi động lại:

```powershell
cd frontend
npm run dev
```

## Kiểm thử tại máy

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

Thử mở lần lượt `/login`, `/dashboard`, `/transfer`, `/transactions`, `/account`, và `/admin` với tài khoản có quyền phù hợp.

## Ghi chú

- Dữ liệu số dư và giao dịch mới nhất được gọi từ API cũ; không có số liệu minh họa được hardcode trong dự án.
- Không thay đổi tên mã nghiệp vụ của Backend; chỉ đổi nhãn tiếng Việt trên giao diện.
- Nếu API lịch sử giao dịch tạm thời lỗi, Dashboard vẫn hiển thị số dư tài khoản như trước.
- Không thể chạy kiểm thử Next.js đầy đủ trong môi trường tạo bản cập nhật (thiếu gói npm); đã kiểm tra cú pháp TS/TSX và CSS. Hãy chạy lệnh build ở trên trên máy của bạn.
