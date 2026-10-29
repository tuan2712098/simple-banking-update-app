# SIMPLE BANKING – NÂNG CẤP GIAO DIỆN THEO VAI TRÒ

Đây là **bản vá** dành cho phiên bản Simple Banking App đã cài 2 chức năng AI và bản sửa đăng nhập không tự điền (không phải dự án cài mới).

## Chức năng đã cập nhật

- CUSTOMER: `/dashboard` – giữ giao diện ví điện tử, chuyển tiền và AI phân tích chi tiêu.
- ADMIN: `/admin/dashboard` – tổng quan số người dùng, giao dịch gần nhất, các yêu cầu cần duyệt; `/admin/transactions` tra cứu trong phạm vi 100 giao dịch gần nhất; `/admin` quản lý và phê duyệt; `/admin/ai-fraud` AI bất thường.
- TELLER: `/teller/dashboard` – trang công việc tại quầy; `/teller/operations` – nạp tiền/chuyển khoản hộ; kiểm tra chủ tài khoản theo số tài khoản qua API mới `/teller/accounts/:accountNumber`, có kiểm tra quyền Teller/Admin và ghi Audit.
- Ô tìm kiếm trên thanh trên: Customer tìm mã giao dịch/số tài khoản trong lịch sử của chính mình; Admin lọc trong 100 giao dịch mới nhất (không phải tìm toàn bộ DB); Teller điền số tài khoản vào biểu mẫu và bấm Kiểm tra tài khoản.
- Biểu tượng chuông: mở **bảng thông báo độc lập**, dựa trên giao dịch gần đây của Customer và việc cần xử lý của Admin. Teller chưa có dữ liệu thông báo riêng nên hiển thị trạng thái trống (không tạo dữ liệu giả). Chưa có lưu đã đọc/chưa đọc hoặc thông báo đẩy.
- Đăng nhập chuyển hướng theo vai trò. Có chặn truy cập giao diện và Backend bảo vệ các API tra cứu tài khoản.

## Cài bằng PowerShell (từ thư mục dự án hiện tại)

**Sao lưu mã nguồn trước khi cài**:

```powershell
cd C:\Downloads\Simple_Banking_App_Security_Integrated
Copy-Item .\frontend\src ".\frontend\src_backup_role_$(Get-Date -Format yyyyMMdd_HHmmss)" -Recurse -Force
Copy-Item .\backend\src ".\backend\src_backup_role_$(Get-Date -Format yyyyMMdd_HHmmss)" -Recurse -Force
```

Sau khi tải `Simple_Banking_RBAC_Dashboard_Search_Notifications_PATCH.zip` vào Downloads, **giải nén từ thư mục gốc**:

```powershell
Expand-Archive -LiteralPath "C:\Downloads\Simple_Banking_RBAC_Dashboard_Search_Notifications_PATCH.zip" -DestinationPath "." -Force
```

**Khởi động lại Backend** (bản này có thêm API và mở rộng truy vấn lịch sử):

```powershell
cd backend
npm run build
npm run start:dev
```

**Kiểm tra Frontend** (Terminal khác):

```powershell
cd C:\Downloads\Simple_Banking_App_Security_Integrated\frontend
npm run build
npm run dev
```

Nếu Frontend đang chạy cổng 3001, hãy dừng phiên cũ bằng Ctrl+C trước khi chạy phiên mới. AI Service cổng 8008 và PostgreSQL cổng 5432 phải hoạt động như trước.

## Giới hạn và bảo mật

- Không có migration, không có thay đổi `.env`, JWT, khóa ký số, mã hóa hoặc AI Service.
- Giao diện mới dùng API và cơ sở dữ liệu **thật của ứng dụng mô phỏng**, không tạo số liệu giả.
- Tìm kiếm của Customer chỉ tìm theo **mã giao dịch hoặc số tài khoản**; mô tả được mã hóa AES-GCM không hỗ trợ tìm kiếm toàn văn trực tiếp.
- Admin tra cứu tối đa 100 giao dịch gần nhất do API `/admin/transactions` hiện có giới hạn 100.
- Tra cứu Teller chỉ trả về mã tài khoản, mã chủ sở hữu, tên chủ tài khoản, trạng thái và tiền tệ; không trả số dư hay mật khẩu.
- Thông báo hiện lấy từ dữ liệu giao dịch hiện tại khi mở popup, **chưa phải hệ thống thông báo lưu trữ/push**.
- Phân quyền hiển thị Frontend **không thay thế phân quyền Backend**; endpoint `/teller/accounts/:accountNumber` có guard riêng.
- Bản vá được kiểm tra cú pháp TypeScript/TSX và parse CSS, **chưa build end-to-end với PostgreSQL/Next.js** trên máy của bạn. Nếu build có lỗi, gửi output để sửa tiếp.
- Nếu bạn đã sửa các file Frontend/Backend sau khi tải bản AI trước đó, cần so sánh/merge trước khi chép đè. Bản vá không chứa dữ liệu sản xuất hay file bí mật.
