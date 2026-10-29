# BankFlow — Batch Commit PoC, BullMQ và kiểm thử an toàn

Đây là **bản nghiên cứu/PoC**, không phải hệ thống ngân hàng production. Source gốc vẫn giữ API `/transactions/transfer`. Redis/BullMQ và Batch PoC đều **tắt theo mặc định**.

## 1. Cái gì đã có trong code?

- `src/batch-planning/batch-planner.ts`: phân loại yêu cầu theo tài khoản nhận, chia Batch có giới hạn, tính tổng tiền bằng số nguyên cent và phát hiện trùng mã.
- `TransactionsService.commitBatch(...)`: thực thi 1–20 chuyển khoản vào **một tài khoản nhận** trong một PostgreSQL Transaction, khóa tài khoản theo thứ tự cố định, kiểm tra nghiệp vụ, trừ từng người gửi, ghi từng `Transaction` và 2 bút toán Ledger tương ứng, cập nhật số dư người nhận một lần, sau đó COMMIT.
- `IdempotencyService`: giữ mã riêng cho từng yêu cầu; nếu Batch/Job chạy lại sau COMMIT thì trả kết quả cũ, không cộng tiền lần nữa.
- `src/batch-processing/execute-batch.ts`: nếu cả Batch bị từ chối do một lỗi nghiệp vụ, PostgreSQL ROLLBACK cả lô trước, sau đó thử từng yêu cầu riêng qua logic chuyển tiền cũ. Việc này cho phép các giao dịch hợp lệ vẫn thành công. Lỗi hệ thống không bị chuyển thành thông báo thành công.
- `src/batch-processing/batch-queue.service.ts`: một **BullMQ Job chứa một Batch**; Worker gọi `commitBatch`. Đây là nhánh PoC riêng với `/queued-transfers` đang nhận từng Job.
- Admin API PoC: `POST /admin/batch-poc` và `GET /admin/batch-poc/:jobId`, chỉ bật khi có JWT vai trò admin, đúng database `simple_banking_race_test`, `DB_SYNCHRONIZE=false`, `NODE_ENV` khác `production`, và `BANKFLOW_BATCH_QUEUE_ENABLED=true`.

### Chú ý quan trọng

- **Batch Planner không có nghĩa là Database đã COMMIT.** PoC hiện đã bổ sung Executor, nhưng kết quả giao dịch phải được kiểm chứng trên PostgreSQL test trước khi tuyên bố đạt yêu cầu.
- **Batch Commit không mặc nhiên là cộng gộp.** Phiên bản PoC này chủ động thiết kế cộng gộp một lần cập nhật tài khoản nhận cho các yêu cầu mới, hợp lệ trong Batch.
- Một người gửi có thể có nhiều chuyển khoản; tài khoản gửi vẫn cần khóa và ghi giảm đúng từng giao dịch. Receiver Lotte/KFC khác nhau có thể xử lý Batch riêng, nhưng nguồn tiền và các dữ liệu chung vẫn có thể tạo tranh chấp.
- Mỗi giao dịch có thể có số tiền khác nhau; một lần cập nhật số dư người nhận **không làm mất** các dòng `transactions`, `ledger_entries` riêng biệt.
- **Không có Notification Service trong PoC.** Nếu thêm thông báo, chỉ gửi sau COMMIT và nên triển khai Transactional Outbox. Chưa được tuyên bố thông báo tức thời.
- Admin API PoC có khả năng mô phỏng giao dịch từ nhiều user và **chỉ được chạy trên database test**. Tuyệt đối không bật PoC này trong môi trường có tiền thực.

## 2. Tạo môi trường trên Windows (VS Code/PowerShell)

Giữ bản BankFlow gốc. Giải nén ZIP vào thư mục **mới**. Trong `backend`:

```powershell
npm install
npm run build
npm run test:batch-plan
npm run demo:batch-plan
```

Tạo `.env` dựa trên `.env.example`, tự điền `DB_PASSWORD` và `JWT_SECRET` của máy cá nhân. **Không chia sẻ bí mật**.

```dotenv
DB_DATABASE=simple_banking_race_test
DB_SYNCHRONIZE=false
BANKFLOW_QUEUE_ENABLED=false
BANKFLOW_BATCH_QUEUE_ENABLED=false
NODE_ENV=development
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Cần PostgreSQL đã có bảng BankFlow, và Memurai/Redis lắng nghe ở `127.0.0.1:6379`. Bạn đã tự kiểm tra trên máy: `Redis PING: PONG` và `/health` báo database test đang kết nối ở phiên trước. Cần kiểm tra lại sau khi đổi project.

## 3. Demo thực tế có thay đổi dữ liệu — CHỈ DATABASE TEST

**Lưu ý:** Các lệnh sau tạo 102 user/tài khoản demo trong `simple_banking_race_test`, khởi tạo 100 tài khoản gửi có 1 triệu VND và tạo Ledger opening cho số dư khởi tạo. Chúng **không** được chạy trên database chính. Seed có kiểm tra tên DB, không tự xóa hoặc reset tài khoản đã tồn tại.

```powershell
npm run seed:batch-poc
npm run test:batch-safety
npm run demo:batch-queue
```

- `seed:batch-poc`: tạo 100 tài khoản gửi + 2 tài khoản nhận test, dùng mã bắt đầu bằng `98...` tránh trùng bộ demo cũ `90...`.
- `test:batch-safety`: kiểm tra lỗi mô phỏng gây ROLLBACK không làm thay đổi tiền/Ledger/Idempotency; chạy lại cùng mã không cộng tiền lần hai; Batch có lỗi không ghi dở; mã cũ thay số tiền bị từ chối.
- `demo:batch-queue`: tạo 100 yêu cầu, 65 vào Lotte và 35 vào KFC; Batch Size 10 → 11 Batch, gửi **11 BullMQ Jobs** qua Redis rồi Worker commit vào PostgreSQL test. Có đối chiếu số dư hai tài khoản nhận. Lần chạy sau dùng cùng Idempotency Keys để chứng minh không cộng lại.

**Mức hoàn thành trên máy người dùng:** Chỉ báo `PASS` khi script thực sự báo PASS. Việc biên dịch và chạy demo với database thực tế chưa được xác nhận trong môi trường tạo ZIP này.

### Ranh giới của demo

Bản **Batch Queue PoC** tạo một BullMQ Job cho *cả lô*. Nó **không tự động hút 10 Job đã có sẵn trong Queue lẻ**. Muốn gom động các Job từ nhiều request độc lập phải xây dựng thêm một cơ chế Batch Assembler bền vững, bảo đảm không mất Job sau crash. `addBulk()` của BullMQ chỉ là thêm nhiều Job, không tạo PostgreSQL Batch Commit.

## 4. Các câu hỏi người học đã thắc mắc

**Row Lock thuộc về Job à?** Không. PostgreSQL khóa Row trong Database Transaction. Nếu gom 10 yêu cầu vào một Transaction, có thể cập nhật Lotte một lần nhưng vẫn phải khóa và ghi giảm 10 tài khoản gửi.

**65 Lotte và 35 KFC thế nào?** Nếu tối đa 10 yêu cầu mỗi Batch thì Lotte 7 Batch, KFC 4 Batch. Không phải tự động chỉ có 2 COMMIT trừ khi chủ động dùng 2 Batch rất lớn, điều này có thể giữ khóa lâu và tăng rủi ro ROLLBACK.

**Số tiền khác nhau có gom được không?** Có; cộng tổng bằng số nguyên cent, Ledger và transaction vẫn ghi riêng từng giao dịch.

**Có cần BullMQ để Batch Commit?** Không; nó chỉ quản lý Queue, Retry và Backpressure. Batch Commit là thao tác trong PostgreSQL; có thể gọi trực tiếp.

**BullMQ + Batch có chắc nhanh hơn Batch trực tiếp?** Không. Redis/Queue có overhead nhưng giúp chịu tải có kiểm soát; phải đo TPS, P95/P99 latency, thời gian chờ lock, số lỗi, số Job chờ trước khi kết luận.

**Một Job lỗi làm sao?** Ở Batch Executor, nếu có lỗi nghiệp vụ thì cả Transaction chưa COMMIT bị ROLLBACK. Lớp fallback sau đó thử lại từng yêu cầu bằng `TransactionsService.transfer` cũ để những yêu cầu hợp lệ vẫn có thể thành công. Nếu lỗi hạ tầng, Job để retry thay vì tự tuyên bố thành công.

**Đã COMMIT nhưng Worker crash?** Khi xử lý lại, Idempotency Key đã ghi cùng Transaction sẽ trả kết quả cũ. Tuy nhiên, không được xóa khóa idempotency tùy tiện nếu vẫn còn khả năng nhận retry cũ.

**Thông báo cho A, B, C?** Ledger Service ghi sổ, không phải gửi thông báo. Nếu có Notification Service, phải tạo thông báo riêng cho từng giao dịch thành công sau COMMIT; xử lý Outbox để tránh mất thông báo.

## 5. Các việc cần xác nhận trước khi báo cáo đây là giải pháp đã kiểm chứng

1. `npm run build` trong máy người dùng chạy PASS trên ZIP mới.
2. `npm run test:batch-safety` PASS trên `simple_banking_race_test`.
3. `npm run demo:batch-queue` ghi đủ 100 transaction, 200 ledger entries, không có mismatch trong đối soát.
4. Kiểm thử crash-after-COMMIT, retry và đồng thời nhiều Worker tranh chấp Lotte. Kiểm thử transaction timeout/deadlock và lỗi PostgreSQL.
5. Đo benchmark cùng tải đầu vào bằng những bộ dữ liệu tách biệt cho `transfer` cũ / Batch / BullMQ + Batch. PoC **chưa có số liệu TPS thật**.
6. Rà soát bảng `ledger_entries` có cơ chế immutable cấp database; kết quả kiểm thử trước từng báo có lỗi, chưa tuyên bố khắc phục.
7. Rà soát lại ép kiểu `response as any` trong Idempotency: đây là sửa lỗi build tạm thời, không phải cải tiến model dữ liệu.

**Câu nói với anh Khánh:** “Em đã có bản thiết kế, Queue PoC và Batch Executor PoC dùng Transaction/Row Lock/Ledger/Idempotency. Các phép kiểm thử và benchmark thực tế vẫn phải chạy trên database test; kết quả demo Planner không thay thế cho phép đo giao dịch thực.”
