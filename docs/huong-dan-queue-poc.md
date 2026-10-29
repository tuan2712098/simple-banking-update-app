# Bước 1 – BullMQ Queue PoC trong BankFlow

Đây là bản thử nghiệm chỉ dành cho **database test**, không làm thay đổi API chuyển khoản cũ. Chưa triển khai Batch Commit.

## Chuẩn bị trên Windows

1. Sao lưu dự án gốc và giải nén ZIP này vào thư mục riêng.
2. Cài Node.js, PostgreSQL, Redis. Tạo database test riêng với tên kết thúc bằng `_test`; không dùng dữ liệu chính.
3. Trong `backend`, chạy `npm install`. Bản source này thêm thư viện `bullmq` vào dependencies.
4. Đặt biến môi trường `DB_DATABASE=<tên_db>_test`, `BANKFLOW_QUEUE_ENABLED=true`, `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6379`, `BANKFLOW_WORKER_CONCURRENCY=1`. Cấu hình PostgreSQL theo `.env.example` hiện có.
5. Chạy `npm run start:dev` khi Redis và database test đã sẵn sàng.

## Hai API thử nghiệm

**POST `/queued-transfers`**: yêu cầu JWT customer, header `Idempotency-Key` là UUID, body cùng định dạng với `/transactions/transfer`. Trả `{jobId,status:"ACCEPTED", transferStatus:"PENDING"}` khi Job mới được ghi vào Redis (Job cũ đã hoàn thành có thể trả `ALREADY_PROCESSED`); **không phải thông báo tiền đã COMMIT**.

**GET `/queued-transfers/:jobId`**: yêu cầu JWT của đúng người đã tạo Job. Sau khi Worker hoàn thành, `queueState` là `completed` và `transferResult.status` mới cho biết kết quả nghiệp vụ.

## Giới hạn có chủ ý

- Mặc định `BANKFLOW_QUEUE_ENABLED=false`; bật trên database không kết thúc `_test` sẽ từ chối khởi động.
- Chỉ thử chuyển khoản dưới ngưỡng OTP 10.000.000đ; chưa áp dụng approval/teller/reversal ở API queue.
- Không tự gom 10 Job thành Batch, không cộng gộp Lotte, không thiết kế Notification Service; giai đoạn này chỉ thử Queue/Worker và reuse `TransactionsService.transfer` hiện có.
- Worker chạy cùng tiến trình NestJS trong PoC; triển khai thật nên tách worker service, quản lý kết nối và độ bền nhận Job.
- BullMQ có thể xử lý lại Job; việc tránh chuyển trùng phụ thuộc vào Idempotency ở PostgreSQL. Cần củng cố chiến lược idempotency dài hạn trước khi vận hành tiền thật.
- PoC giữ Job đã hoàn thành để tra cứu, chưa có chiến lược dọn Redis. Không dùng môi trường production.
- Chưa chạy `npm install`, build, test hoặc benchmark trong môi trường đóng gói này; phải xác minh trên máy có Node, Redis, PostgreSQL và dependencies.
- Không chạy `npm run test:e2e` vào database chính. Một số bài e2e có thao tác `TRUNCATE ... CASCADE` trên database được cấu hình.

## Kế hoạch test trước Batch

1. Chuyển tiền nhỏ, polling đến completed, so số dư và hai ledger entries.
2. Gửi lặp cùng Idempotency Key và cùng payload; không được trừ/cộng hai lần.
3. Gửi hai key khác nhau với cùng số tiền; phải ghi hai giao dịch.
4. Burst 20/100 Job chuyển vào cùng một recipient trên DB test, đo thời gian và xác minh tổng tiền.
5. Tắt Worker đúng lúc giao dịch đang chạy trong môi trường test và xác minh replay không làm chuyển trùng.

Sau khi đạt các test trên, mới bàn thêm Batch Coordinator với **tách giao dịch lỗi, tính `balanceAfter` chính xác và khóa tài khoản gửi/nhận theo thứ tự**.

## Bước 2 tiếp theo

Đã thêm module thuần `batch-planning/batch-planner.ts` để mô phỏng chia Job vào Batch theo tài khoản nhận. Xem `docs/huong-dan-batch-planner.md`. Module này **chưa kết nối với BullMQ Worker và chưa gọi PostgreSQL**, nên không thể coi là đã triển khai Batch Commit.
