# Cải tiến giao diện Simple Banking App

## Nội dung

- Việt hóa menu loại giao dịch (`transfer`, `deposit`, `withdrawal`, `reversal`), trạng thái giao dịch, trạng thái tài khoản, loại tài khoản, vai trò người dùng và một số nhãn tại trang quản trị.
- **Không đổi các mã nghiệp vụ** gửi tới Backend. Ví dụ dropdown hiển thị “Chuyển khoản”, nhưng giá trị `value="transfer"` được giữ nguyên để API lọc chính xác.
- Hiệu ứng nổi nhẹ khi di chuột tới thẻ giao dịch, thẻ hành động, nút bấm, trường chọn và số dư; có phản hồi cho bàn phím và hỗ trợ `prefers-reduced-motion`.
- Tinh chỉnh khoảng cách, bóng đổ, màu nền, trạng thái giao dịch và bố cục responsive cho màn hình nhỏ.
- Bỏ nút kiểm tra chữ ký/chuỗi hash khỏi trang lịch sử dành cho khách hàng. Phần kiểm thử crypto ở Backend giữ nguyên.

## Áp dụng vào dự án đang chạy trên máy

1. Sao lưu thư mục `frontend/src` hiện có nếu bạn đã thay đổi code từ bản ZIP trước.
2. Chép thư mục `src` trong gói này vào `frontend/src` (chọn ghi đè các file giao diện). Không cần thay đổi Backend, Database, `.env` hoặc khóa bảo mật.
3. Tại `frontend`, chạy `npm install` (nếu chưa cài), rồi `npm run dev`. Next.js thường tự tải lại giao diện khi lưu file.
4. Mở `http://localhost:3001/transactions`, xem bộ lọc Loại, rồi rê chuột qua giao dịch để thấy hiệu ứng nổi.

Lưu ý: các thông báo tiếng Anh hiếm gặp do Backend trả về sẽ được thay bằng thông báo tiếng Việt dễ hiểu trên UI. Muốn hiển thị nội dung lỗi chính xác theo từng tình huống, cần xây dựng thêm bộ mã lỗi và bản dịch tương ứng.
