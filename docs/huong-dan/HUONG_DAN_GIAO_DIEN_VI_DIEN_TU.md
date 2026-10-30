# Simple Banking App – giao diện ví điện tử xanh ngọc

Bản này là **mã Frontend Next.js/React** đã cập nhật theo mẫu dashboard ví điện tử mà bạn gửi, không phải ảnh thiết kế.

## Những phần thay đổi

- Sidebar trắng, điểm nhấn xanh ngọc và menu hoàn toàn bằng tiếng Việt.
- Header chào người dùng và liên kết đến lịch sử, tài khoản.
- Dashboard có thẻ tài khoản mô phỏng, hiện/ẩn số dư, sao chép số tài khoản, nút chuyển tiền.
- Biểu đồ thu–chi 30 ngày dựa trên các giao dịch có trạng thái COMPLETED từ API `/transactions`; thống kê dựa trên tối đa 100 giao dịch gần nhất, **có ghi chú khi dữ liệu bị giới hạn**.
- Giao dịch gần nhất hiển thị từ Backend.
- Biểu đồ tỷ trọng tiền vào/ra từ dữ liệu thực. Không tạo danh mục chi tiêu giả.
- Khối "Mục tiêu tiết kiệm" mang trạng thái **Sắp ra mắt**, không có API hoặc số liệu tự tạo.
- Giao diện chuyển tiền, lịch sử, hồ sơ, quản trị và đăng nhập cùng bảng màu xanh ngọc; có hiệu ứng hover và responsive.

Không thay Backend, PostgreSQL, Hash, Sign, Encrypt/Decrypt hay các biến môi trường.

## Cập nhật qua Terminal PowerShell

1. Tải file ZIP vào `C:\Downloads\Simple_Banking_Frontend_Wallet_Style.zip`.
2. Mở terminal tại thư mục gốc **Simple_Banking_App_Security_Integrated** (không phải thư mục frontend).
3. Sao lưu giao diện đang chạy:

```powershell
Copy-Item .\frontend\src ".\frontend\src_backup_$(Get-Date -Format yyyyMMdd_HHmmss)" -Recurse -Force
```

4. Giải nén đè các file Frontend:

```powershell
Expand-Archive -LiteralPath "C:\Downloads\Simple_Banking_Frontend_Wallet_Style.zip" -DestinationPath "." -Force
```

5. Nếu Frontend đang chạy tại cổng 3001, mở `http://localhost:3001/dashboard` và nhấn `Ctrl+Shift+R`. Nếu không chạy, mở terminal tại `frontend` và thực hiện `npm run dev`.
6. Có thể chạy kiểm tra trên máy:

```powershell
cd frontend
npm run build
```

**Lưu ý:** Không khởi động thêm Frontend nếu đã có phiên chạy cổng 3001; sẽ gặp `EADDRINUSE`. Không cần sửa `.env`, Postgres hoặc migration.

## Hạn chế và kiểm thử

Mã TypeScript/TSX đã được kiểm tra cú pháp (18 file, 0 lỗi cú pháp). Vì môi trường làm việc ở đây chưa tải được đầy đủ npm packages, bản này **chưa được xác nhận qua `next build` hay kiểm thử trên máy của bạn**. Hãy chạy `npm run build` ở máy đã cài dependencies. Nếu có lỗi, gửi phần log để xử lý.
