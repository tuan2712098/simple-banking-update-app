# NÂNG CẤP PIN GIAO DỊCH 6 SỐ + OTP CHO MỌI NGHIỆP VỤ TIỀN

## Phạm vi

- **Khách hàng**: mỗi lần chuyển tiền hoặc rút tiền mô phỏng đều phải nhập mã PIN 6 số do họ tự thiết lập và nhập OTP 6 số. Không chuyển tiền/trừ số dư trước khi xác thực đúng. Mã PIN lưu dạng bcrypt hash, không phải mật khẩu đăng nhập.
- **Giao dịch viên / Admin**: nạp tiền và chuyển khoản hộ phải xác thực OTP của **nhân viên đang đăng nhập** (không biết PIN khách hàng); Admin hoàn trả chuyển khoản cũng cần OTP. Giao dịch lớn qua giao dịch viên giữ nguyên phê duyệt Admin + OTP khách hàng sẵn có.
- OTP hiệu lực 5 phút, tối đa 3 lần sai. Sau xác minh OTP, Backend cấp token giao dịch tồn tại 2 phút và chỉ dùng đúng 1 lần. Token ràng buộc loại nghiệp vụ, số tiền, người nhận, nội dung và danh tính nhân viên/người dùng.
- Các API chuyển tiền trực tiếp, rút tiền, nạp tiền và hoàn trả đều có kiểm tra xác thực **phía Backend** trong cùng transaction CSDL với xử lý tiền, không chỉ kiểm tra trên giao diện.
- Queue/Batch proof of concept **bị khóa mặc định** vì chưa xác thực OTP cho từng giao dịch. Chỉ mở PoC trong CSDL dành riêng `_test` với biến `BANKFLOW_ALLOW_INSECURE_BATCH_POC=true` khi nghiên cứu và không sử dụng dữ liệu thật.

## Cài đặt vào dự án hiện có trên Windows PowerShell

**1.** Sao lưu mã nguồn. Tại `C:\Downloads\Simple_Banking_App_Security_Integrated`:

```powershell
$stamp = Get-Date -Format yyyyMMdd_HHmmss
Copy-Item .\frontend\src ".\frontend\src_before_pin_$stamp" -Recurse -Force
Copy-Item .\backend\src ".\backend\src_before_pin_$stamp" -Recurse -Force
```

**2.** Tải file Patch ZIP về Downloads và giải nén vào thư mục dự án:

```powershell
Expand-Archive -LiteralPath "C:\Downloads\Simple_Banking_PIN6_OTP_Moi_Giao_Dich_PATCH.zip" -DestinationPath "." -Force
```

**3.** Sao lưu database trước khi thay đổi:

```powershell
cd backend
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h 127.0.0.1 -U postgres -d simple_banking_app_final -F c -f ".\backup_before_pin_otp.dump"
```

**4.** Chạy migration (PostgreSQL 17; thay thông tin kết nối nếu khác):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U postgres -d simple_banking_app_final -v ON_ERROR_STOP=1 -f ".\migrations\20261028_transaction_pin_otp.sql"
```

**5.** Mở `backend/.env` và chỉ dùng chế độ thử nghiệm ở máy cá nhân:

```dotenv
NODE_ENV=development
BANKFLOW_DEMO_OTP_ENABLED=true
```

Trong môi trường demo, mã OTP sẽ hiện ở màn hình xác nhận. **Đây là OTP mô phỏng, không phải OTP SMS/email thực tế và KHÔNG cung cấp xác thực hai yếu tố thực chất khi mã xuất hiện trên cùng phiên đăng nhập.** Trong môi trường thật phải xây kênh OTP độc lập (SMS/email/TOTP/push), bỏ hẳn `demoOtp`, bảo vệ thiết bị và chống phát lại.

**6.** Kiểm tra build/test:

```powershell
npm install
npm run build
npx jest src/transaction-security/transaction-security.service.spec.ts --runInBand
cd ..\frontend
npm install
npm run build
```

**7.** Chạy lại hai tiến trình NestJS (cổng 3000) và Next.js (cổng 3001). Không chạy trùng cổng đang dùng.

## Dùng tính năng

1. Đăng nhập CUSTOMER, vào **Tài khoản của tôi → PIN giao dịch 6 chữ số**, nhập mật khẩu đăng nhập hiện tại và chọn PIN không quá dễ đoán.
2. Vào **Chuyển tiền** hoặc **Rút tiền**, nhập thông tin rồi chọn Tiếp tục. Hệ thống yêu cầu PIN 6 số trước, tiếp theo OTP 6 số (nếu bật demo sẽ hiện rõ chữ **OTP DEMO**).
3. Nhập đúng OTP, Backend mới thực hiện giao dịch. Nhập sai, hết hạn hoặc dùng token đã sử dụng thì không thay đổi số dư. Sửa số tiền/người nhận phải xác thực lại.
4. TELLER/ADMIN: trang Nghiệp vụ tại quầy / Quản trị: nạp tiền, chuyển khoản hộ cần OTP riêng của người thực hiện. Admin hoàn trả giao dịch từ trang tra cứu có nút **Hoàn trả (OTP)**.

## Kiểm thử thêm nên thực hiện

- Đăng nhập bình thường và PIN giao dịch là 2 bí mật khác nhau.
- Gọi trực tiếp `POST /transactions/transfer`, `/transactions/withdraw`, `/transactions/deposit` mà thiếu `X-Transaction-Authorization` phải trả 403; DB không thay đổi.
- Đổi số tiền hoặc người nhận sau khi OTP được cấp phải trả 403.
- Dùng OTP sai 3 lần, dùng lại token hoặc OTP quá hạn đều không làm thay đổi số dư.
- Chạy giao dịch với `BANKFLOW_CRYPTO_ENABLED=true` sau migration để kiểm tra không làm mất SHA-256/Ed25519/AES-GCM.

## Ghi chú kỹ thuật

API được bổ sung:

- `GET /transaction-security/pin-status`
- `POST /transaction-security/pin` — `{currentPassword,pin}`
- `POST /transaction-security/request` — `{action,payload,pin?}`
- `POST /transaction-security/verify` — `{challengeId,otp}` => `{authorizationToken,expiresAt}`

API chuyển tiền, rút tiền, nạp tiền, chuyển hộ, hoàn trả yêu cầu thêm header `X-Transaction-Authorization` từ bước Verify, token này không lưu vào localStorage. Idempotency của chuyển tiền vẫn được giữ nguyên.

**Hạn chế:** Chưa có hệ thống gửi OTP SMS/email thật, chưa tích hợp push notification, chưa chứng minh đạt tiêu chuẩn ứng dụng ngân hàng thương mại. Không dùng mã nguồn này với tiền thật.
