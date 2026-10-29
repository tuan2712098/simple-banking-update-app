# BankFlow — Bước 2: Gom Job thành Batch (bản mô phỏng an toàn)

## 1. Đã làm được gì?

Bản này nối tiếp **Bước 1 – BullMQ Queue PoC**, nhưng chỉ thêm phần **Batch Planner**. Chưa xử lý hàng loạt trên PostgreSQL và **không chuyển tiền thật**.

Hình dung đơn giản:

- Job là một phiếu chuyển khoản.
- Batch Planner là nhân viên phân loại phiếu theo tài khoản nhận, chẳng hạn Lotte hoặc KFC.
- Mỗi tập hồ sơ chỉ chứa tối đa `batchSize` phiếu.
- Sau khi phân nhóm, Planner tính tổng số tiền của từng tập bằng `bigint` để tránh sai số số thực.
- PostgreSQL và Ledger **chưa được gọi ở bước này**.

Ví dụ 100 Job, 65 vào Lotte, 35 vào KFC, giới hạn 10 Job/Batch:

| Tài khoản nhận | Job | Batch |
| --- | ---: | ---: |
| Lotte | 65 | 7 (10+10+10+10+10+10+5) |
| KFC | 35 | 4 (10+10+10+5) |
| Tổng | 100 | 11 |

**Không phải 100 Job = 2 Batch**, vì ở đây đã giới hạn mỗi Batch tối đa 10 Job. Nếu về sau mỗi Batch thực hiện một lần cộng gộp vào tài khoản nhận thì *về mặt thiết kế* có 11 lần cập nhật dòng nhận, không phải 2. Nhưng **đó chưa phải cách PostgreSQL hiện đang xử lý**.

## 2. Đã viết thêm file nào?

- `backend/src/batch-planning/batch-planner.ts`: phân nhóm theo tài khoản nhận, chia kích thước lô, tính tổng tiền, nhận diện yêu cầu lặp.
- `backend/scripts/demo-batch-plan.ts`: tự tạo 100 Job giả lập (65 Lotte, 35 KFC) với hai số tiền khác nhau để quan sát kết quả.
- `backend/scripts/test-batch-plan.ts`: kiểm thử tự động nhóm/chia lô/tiền chính xác/trùng Idempotency Key/dữ liệu sai.
- `backend/package.json`: thêm hai lệnh demo và test riêng.

Code không đổi luồng `/transactions/transfer` hiện có. Bản Queue PoC ở bước 1 cũng giữ nguyên.

## 3. Cách chạy trên Windows

Mở VS Code, Terminal → PowerShell. Di chuyển đến `Simple_Banking_App_Final/backend` của **bản ZIP bước 2** và chạy:

```powershell
npm install
npm run test:batch-plan
npm run demo:batch-plan
```

`test:batch-plan` không cần kết nối Redis hay PostgreSQL; nó chỉ chạy logic gom Job. `demo:batch-plan` chỉ in JSON kết quả, không sửa database.

Dấu hiệu đúng: lệnh test in `PASS`, lệnh demo in `totalBatches: 11`, Lotte 7 Batch và KFC 4 Batch.

**Không dùng lệnh `npm run test:e2e` trên database chính**. Một số bài e2e của dự án có lệnh xóa dữ liệu để dọn test.

## 4. Planner khác Batch Commit ở đâu?

Đây là hai bước **khác nhau**:

1. **Planner**: quyết định Job nào được gom với Job nào, tổng tiền lý thuyết của mỗi nhóm là bao nhiêu.
2. **Executor + PostgreSQL**: lấy khóa, kiểm tra số dư thật, kiểm tra hạn mức/gian lận, trừ từng tài khoản gửi, cập nhật tài khoản nhận, ghi Ledger và Idempotency rồi COMMIT/ROLLBACK.

Chỉ hoàn thành (1) **chưa có nghĩa** hệ thống đã làm được Batch Transaction Commit.

**Quan trọng về Idempotency:** Planner chỉ loại bỏ yêu cầu trùng nhau trong cùng danh sách đầu vào để mô phỏng. Việc chống chuyển trùng thực sự vẫn phải được thực hiện trong PostgreSQL Transaction. Không thể chỉ tin vào bộ lọc trong bộ nhớ.

**Quan trọng về số tiền:** Tổng tiền trong Planner chỉ là phép cộng ban đầu. Tổng được phép COMMIT phải được tính lại từ những giao dịch thực sự hợp lệ tại thời điểm thực hiện trên PostgreSQL. Người gửi có thể đã hết tiền hoặc tài khoản bị khóa trong lúc chờ Queue.

**Quan trọng về Ledger:** Nếu gom 10 giao dịch và cập nhật Lotte một lần thì Ledger vẫn phải ghi đủ bút toán của 10 giao dịch. Các giá trị `balanceAfter` của từng bút toán phải khớp với diễn tiến đã COMMIT. Không thể dùng bừa cùng một `balanceAfter` tổng cho tất cả 10 dòng.

**Quan trọng về lỗi:** Muốn 9 giao dịch hợp lệ thành công và 1 giao dịch sai thất bại, phải thiết kế rõ việc tách/kiểm tra giao dịch lỗi. Nếu cả 10 giao dịch nằm trong một Transaction rồi ROLLBACK, tất cả thay đổi chưa COMMIT đều bị hủy.

## 5. Các bước code tiếp theo trước khi bật Batch Commit

1. Cài dependencies và chạy thử **Queue PoC bước 1** trên PostgreSQL `_test` + Redis.
2. Kiểm tra chuyển khoản thường, Ledger, Idempotency khi Worker bị retry; đo TPS/Latency và trạng thái Queue.
3. Thiết kế **Batch Executor** sao cho tái sử dụng đầy đủ kiểm tra/hạn mức/bảo vệ tài khoản của `TransactionsService` hiện tại. Không viết một đường chuyển tiền mới nhưng bỏ sót nghiệp vụ.
4. Quy định cách khóa nhiều tài khoản theo thứ tự để giảm deadlock, cách chia lỗi từng Job và quy tắc Retry sau COMMIT.
5. Kiểm thử ROLLBACK, trùng mã, 65 Lotte / 35 KFC, số tiền khác nhau, thiếu tiền, lỗi Ledger và crash sau COMMIT.
6. Đo thực nghiệm giữa: giao dịch riêng, tăng Worker, Batch với kích thước khác nhau, BullMQ + Batch. Chưa kết luận phương án nào nhanh hơn trước khi có số liệu.

## 6. Chuẩn bị trả lời anh Khánh

“Em đã có bản BullMQ PoC dùng lại nghiệp vụ chuyển khoản cũ. Em làm thêm Batch Planner để chia Job theo tài khoản nhận và giới hạn Batch size. Ví dụ 65 giao dịch vào Lotte và 35 vào KFC, Batch size 10 thì có 11 lô. Phần cộng gộp Row Lock và COMMIT theo lô chưa bật vì phải kiểm tra Idempotency, Ledger và ROLLBACK. Sau khi xác minh trên test database, em sẽ benchmark và so sánh TPS/Latency với cách chuyển riêng từng giao dịch.”
