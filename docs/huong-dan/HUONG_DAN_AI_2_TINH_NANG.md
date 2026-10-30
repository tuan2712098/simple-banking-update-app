# Simple Banking App – Hai tính năng AI cho dự án thực tập JITS Lab

Tài liệu dành cho dự án **Simple_Banking_App_Security_Integrated**, với giao diện **Digital Wallet xanh ngọc** đã chọn. Giữ nguyên NestJS, Next.js, PostgreSQL, bảo mật Hash/Sign/Encrypt và logic chuyển tiền hiện có.

## 1. Đã bổ sung những gì?

| Tính năng | Kỹ thuật | Đầu vào | Đầu ra | Vị trí |
|---|---|---|---|---|
| Phân tích chi tiêu | Thống kê theo người nhận, phát hiện chu kỳ, dự báo tuyến tính (không cần mô hình học máy) | Số tiền, thời điểm, người nhận của chuyển khoản đã hoàn thành | Top người nhận, so sánh tháng, khoản định kỳ, dự báo cuối tháng, ngày trong tuần | `http://localhost:3001/ai/spending` |
| Cảnh báo khi chuyển tiền | Quy tắc dựa trên lịch sử 90 ngày của người gửi | Số tài khoản nhận, số tiền | Danh sách gợi ý, chỉ tham khảo | `http://localhost:3001/transfer` |
| Phát hiện giao dịch bất thường | Baseline riêng từng tài khoản (z-score) từ 5 giao dịch; Isolation Forest khi ít lịch sử | Đặc trưng hành vi tính từ toàn bộ lịch sử của người gửi | Mức bất thường, dấu hiệu, trạng thái xử lý | `http://localhost:3001/admin/ai-fraud` (Admin) |

> **Cập nhật 30/10/2026:** trang chi tiêu không còn phân loại theo nội dung chuyển khoản (TF-IDF + Logistic Regression) vì người dùng thường ghi nội dung qua loa. Mô hình đó và endpoint `/ai/spending/overview` vẫn còn trong mã nguồn nhưng giao diện không dùng.

Mô hình Isolation Forest được **huấn luyện trong Python khi AI service khởi động**, sau đó thực hiện suy luận trên dữ liệu giao dịch lấy từ PostgreSQL thông qua Backend. **Không chỉ là `if/else`**. Các câu mô tả dấu hiệu được tạo từ đặc trưng dữ liệu nhằm giúp giải thích kết quả; chúng không thay thế việc dự đoán bằng mô hình ML.

**Giới hạn:** dữ liệu huấn luyện là *giả lập hoặc câu ví dụ do người viết tập hợp*. Chưa đánh giá trên bộ dữ liệu gian lận/ngân hàng thực tế, chưa đo precision/recall, không nên gọi đây là hệ thống phát hiện gian lận đạt chuẩn ngân hàng. Điểm `anomaly_score` KHÔNG phải xác suất gian lận. Kết quả AI chỉ dùng để tham khảo, không tự từ chối, đóng băng hay tự động thay đổi trạng thái giao dịch.

## 2. Cập nhật vào dự án đang chạy

Tải `Simple_Banking_AI_Both_Features_Patch.zip` rồi đóng các Terminal đang chạy trước khi chép đè. Trong PowerShell:

```powershell
cd C:\Downloads\Simple_Banking_App_Security_Integrated
Copy-Item .\frontend\src ".\frontend\src_backup_$(Get-Date -Format yyyyMMdd_HHmmss)" -Recurse -Force
Expand-Archive -LiteralPath "C:\Downloads\Simple_Banking_AI_Both_Features_Patch.zip" -DestinationPath "." -Force
```

**Không xóa, không ghi đè** `backend/.env`, `backend/.env.crypto.generated`, dữ liệu PostgreSQL hoặc khóa ký số. Bản ZIP không chứa các file khóa cá nhân của bạn.

## 3. Chạy trong VS Code – Ba Terminal

**Terminal A – Python AI service** (yêu cầu Python 3.11+ và pip):

```powershell
cd C:\Downloads\Simple_Banking_App_Security_Integrated\ai-service
py -3 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8008
```

Hoặc nếu PowerShell cho phép script: `.\chay-ai.ps1`. Không mở `0.0.0.0` hay port 8008 ra Internet. Kiểm tra AI service bằng Terminal mới:

```powershell
Invoke-RestMethod http://127.0.0.1:8008/health
```

**Terminal B – Backend** (PostgreSQL 17 phải ở trạng thái Running):

```powershell
cd C:\Downloads\Simple_Banking_App_Security_Integrated\backend
npm run build
npm run start:dev
```

Nếu chưa có `backend/.env`, hãy cấu hình theo `.env.example`; trên máy bạn đang có `.env` và các khóa bảo mật từ lần cài trước, **giữ nguyên file đó**. Biến `AI_SERVICE_URL=http://127.0.0.1:8008` là tùy chọn (đã có giá trị mặc định trong code).

**Terminal C – Frontend:**

```powershell
cd C:\Downloads\Simple_Banking_App_Security_Integrated\frontend
npm run dev
```

Nếu đã có Next.js chạy ở cổng 3001 thì chỉ cần tải lại trình duyệt; không chạy hai phiên Next.js trùng cổng.

## 4. Truy cập và kiểm thử qua giao diện

**Tài khoản người dùng:** đăng nhập demo, mở **AI phân tích chi tiêu** trên sidebar hoặc `http://localhost:3001/ai/spending`. Chọn tháng để xem người nhận nhiều nhất, so sánh với tháng trước, khoản chi định kỳ, dự báo cuối tháng. Bấm ✎ cạnh người nhận để đặt tên gợi nhớ (lưu trên trình duyệt). Ở trang **Chuyển tiền**, nhập tài khoản nhận và số tiền để xem khung "Trợ lý AI lưu ý".

**Tài khoản Admin:** đăng nhập với vai trò Admin, mở **AI phát hiện bất thường** trên sidebar hoặc `http://localhost:3001/admin/ai-fraud`. Bấm **Phân tích lại** sau khi có giao dịch mới. Mã tài khoản bị che bớt. Với giao dịch bị gắn cờ, cột **Xử lý** cho phép đánh dấu cần kiểm tra, xác nhận bình thường/đáng ngờ, hoặc mở trang tra cứu để hoàn trả (cần OTP). Nhãn chỉ để phân loại, không tự khóa tài khoản hay đảo tiền.

- Backend `GET /ai/insights?month=2026-10` (khách hàng) và `GET /ai/transfer-check` dùng dữ liệu hành vi, không gọi AI service. `GET /ai/spending/overview?month=2026-10` (phân loại theo nội dung) giữ lại nhưng giao diện không dùng: chỉ đọc giao dịch **đã hoàn thành, tiền ra** của tài khoản thuộc user đang đăng nhập. Loại trừ chuyển khoản giữa các tài khoản cùng chủ. Giới hạn 200 giao dịch/tháng, hiển thị cảnh báo khi vượt giới hạn.
- Backend `GET /ai/fraud/overview`: chỉ Admin, lấy 80 chuyển khoản hoàn thành mới nhất, tính đặc trưng trên toàn bộ lịch sử của từng người gửi (tối đa 5.000 giao dịch). **Không tự ý chuyển trạng thái sang FLAGGED**; chỉ khi admin bấm đánh dấu (`POST /admin/transactions/:id/flag`) mới vào luồng duyệt có sẵn.
- Các API cần AI service chỉ gọi Python AI ở `127.0.0.1:8008` qua loopback. Nếu Python AI không chạy, API trả 503, **không ảnh hưởng thao tác chuyển khoản chính**.
- Thông tin giao dịch đã mã hóa được Backend giải mã theo cơ chế hiện có trước khi suy luận; AI service chỉ chạy cục bộ.

## 5. Chạy demo và kiểm thử AI hoàn toàn bằng Terminal

Ở thư mục `ai-service`, dùng Python trong `.venv`:

```powershell
& .\.venv\Scripts\python.exe demo_ai.py
& .\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Ví dụ kết quả demo đã kiểm chứng trong môi trường phát triển:

```text
Cafe Highlands               => Ăn uống
thanh toán tiền điện          => Hóa đơn & tiện ích
mua giày trên shopee          => Mua sắm
250,000 VND                  => Bình thường
18,000,000 VND               => Cần xem xét
```

Các điểm này chỉ minh họa cho mô hình demo. Nếu dữ liệu giao dịch trong database khác, dashboard của bạn có thể cho kết quả khác.

## 6. Mã nguồn quan trọng

| File | Nhiệm vụ |
|---|---|
| `ai-service/models.py` | Xây dựng, huấn luyện và chạy hai mô hình ML |
| `ai-service/main.py` | REST API nội bộ FastAPI |
| `ai-service/demo_ai.py` | Demo kết quả AI không cần database |
| `ai-service/tests/` | Test Python cho thuật toán và API |
| `backend/src/ai/ai.controller.ts` | API NestJS có JWT và kiểm tra ADMIN |
| `backend/src/ai/ai.service.ts` | Giám sát bất thường: lấy giao dịch PostgreSQL, trích xuất đặc trưng, gọi AI service |
| `backend/src/ai/ai-insights.service.ts` | Phân tích chi tiêu theo người nhận và cảnh báo khi chuyển tiền |
| `frontend/src/app/ai/spending/page.tsx` | Dashboard phân tích chi tiêu |
| `frontend/src/app/transfer/page.tsx` | Trang chuyển tiền có khung cảnh báo AI |
| `frontend/src/app/admin/ai-fraud/page.tsx` | Dashboard AI bất thường cho Admin |
| `frontend/src/components/Navigation.tsx` | Menu điều hướng mới |

Không cần tạo thêm bảng database hoặc migration để chạy hai phân tích đọc dữ liệu này. Nếu muốn lưu lịch sử kết quả để đánh giá mô hình sau này, hãy mở rộng bằng migration riêng.

## 7. Lưu ý trước khi báo cáo mentor

Bạn có thể trình bày đây là **bản PoC tích hợp hai mô hình AI** trên dữ liệu của ứng dụng ngân hàng mô phỏng. Trong báo cáo, phân biệt: code tích hợp đã viết, kiểm thử thuật toán Python đã chạy, còn kiểm thử end-to-end trên PostgreSQL + Backend + Next.js cần thực hiện trên máy bạn. Không dùng dữ liệu khách hàng thật để demo khi chưa có quyền và biện pháp an toàn phù hợp.
