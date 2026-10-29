# Cập nhật: Thiết lập PIN ngay từ đầu

Phiên bản này sửa đúng luồng đăng ký và kích hoạt tài khoản của Simple Banking App.

## Luồng mới

1. **Khách hàng đăng ký mới:** phải nhập mật khẩu đăng nhập, PIN giao dịch 6 số và xác nhận PIN trong form đăng ký. Backend băm cả hai bằng bcrypt và lưu PIN **trong cùng transaction tạo user/account**. Đăng ký thiếu PIN bị từ chối.
2. **Khách hàng cũ chưa có PIN:** khi đăng nhập/khôi phục phiên, được chuyển ngay sang `/setup-pin` trước Dashboard. Xác minh mật khẩu, tạo PIN một lần rồi mới vào app. Không đợi đến khi chuyển khoản.
3. **Khách hàng đã có PIN:** vào Dashboard bình thường. Trong Tài khoản của tôi, chỉ hiển thị trạng thái PIN và nút Đổi PIN.
4. **Giao dịch:** nhập PIN đã có và OTP mỗi giao dịch; không thay đổi logic xác thực OTP hiện tại.
5. **Admin/Teller:** không bắt thiết lập PIN cá nhân như Customer. Nghiệp vụ nhân viên vẫn dùng quy trình OTP theo phân quyền trước đó.

## Cài đặt

1. Dừng Frontend và Backend đang chạy.
2. Sao lưu `backend/src` và `frontend/src` như các lần cập nhật trước.
3. Giải nén ZIP này tại thư mục gốc `Simple_Banking_App_Security_Integrated`, không ghi đè `.env`.
4. Tại `backend`: `npm run build`; tại `frontend`: `npm run build`.
5. Khởi động lại hai dịch vụ. Không cần migration mới, vì cột `users.transaction_pin_hash` đã có từ bản PIN/OTP trước.

### Kiểm thử

- Đăng ký người dùng mới không nhập PIN: nút tạo tài khoản bị khóa, backend cũng từ chối nếu gọi API trực tiếp.
- Đăng ký với PIN hợp lệ: vào Dashboard ngay và có `pinConfigured=true`.
- Đăng nhập khách hàng cũ chưa PIN: vào trang `/setup-pin` trước Dashboard.
- Tự nhập URL `/dashboard` khi chưa PIN: được chuyển về `/setup-pin`.
- Đăng nhập khách hàng đã PIN: không hiện lại form thiết lập.
- Vào Tài khoản của tôi, đổi PIN: bắt buộc nhập PIN hiện tại.
- Giao dịch chuyển tiền: vẫn cần PIN và OTP như bản trước.

### Lưu ý an toàn

Mã PIN 6 số có không gian đoán nhỏ. Bản demo hiện dùng bcrypt và giới hạn thử sai; hệ thống ngân hàng thực tế cần kiểm soát đoán PIN mạnh hơn, chống tấn công trực tuyến/phân tán, thiết bị tin cậy và cơ chế đặt lại PIN đã xác minh danh tính. OTP demo không được dùng cho tiền thật.

## Rút tiền mặt không còn được thực hiện từ ứng dụng

- Đã bỏ mục **Rút tiền** trên thanh điều hướng dành cho Customer.
- `/withdraw` chỉ hiển thị hướng dẫn đến ATM/quầy; không có form nhập số tiền.
- Backend không còn đăng ký route `POST /transactions/withdraw` và không cho tạo challenge OTP với action `withdraw`.
- Không xoá dữ liệu hay bút toán rút tiền trước đây. Các dòng lịch sử mang loại `withdrawal` vẫn hiển thị bình thường.
- Nạp tiền tại quầy cho Teller/Admin giữ nguyên. Nếu cần mô phỏng rút tiền tại ATM, phải làm riêng một tích hợp ATM/QR hoặc mô hình nghiệp vụ chi tiền mặt có kiểm soát.

## Cách kiểm tra sau cập nhật

1. Sao lưu source, giải nén ZIP tại thư mục gốc, chạy `npm run build` ở **backend** và **frontend**.
2. Customer mới: ở trang đăng ký bắt buộc nhập PIN 6 chữ số; không nhập PIN thì Backend từ chối.
3. Customer cũ chưa PIN: đăng nhập và được điều hướng tới `/setup-pin` trước `/dashboard`.
4. Customer đã có PIN: vào Dashboard trực tiếp, `Tài khoản` chỉ hiện tình trạng và nút đổi PIN.
5. Không thấy `Rút tiền` ở sidebar Customer. Mở trực tiếp URL `/withdraw` chỉ thấy thông báo, không thay đổi số dư.
6. Thử gọi `POST /transactions/withdraw` với token hợp lệ: phải là HTTP 404; request OTP action `withdraw`: HTTP 400.
7. Kiểm tra giao dịch chuyển khoản và PIN + OTP vẫn hoạt động như trước. Lịch sử cũ vẫn được giữ.

**Không cần migration mới** nếu migration PIN/OTP lần trước (`20261028_transaction_pin_otp.sql`) đã chạy thành công. Tài khoản cũ được hỗ trợ bước kích hoạt PIN một lần.
