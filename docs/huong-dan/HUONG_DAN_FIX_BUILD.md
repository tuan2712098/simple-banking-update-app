# Bản vá Next.js build — Simple Banking App

Khắc phục chính xác hai lỗi `@typescript-eslint/no-explicit-any` tại `transfer/page.tsx` và `lib/api.ts`, hai cảnh báo `react-hooks/exhaustive-deps` ở các trang Admin và AI Fraud, cùng cảnh báo `autoprefixer` về flex start/end.

Không sửa backend, database, AI models hoặc khóa mã hóa.

Lưu ý: Bản vá dựa trên mã nguồn bản AI Full và bản RBAC Patch đã giao trước đó. Cài sau các bản này.

PowerShell tại thư mục gốc:

```powershell
cd C:\Downloads\Simple_Banking_App_Security_Integrated
Copy-Item .\frontend\src ".\frontend\src_backup_fix_$(Get-Date -Format yyyyMMdd_HHmmss)" -Recurse -Force
Expand-Archive -LiteralPath "C:\Downloads\Simple_Banking_Fix_Next_Build.zip" -DestinationPath "." -Force
cd frontend
npm run build
```

Nếu Next.js báo `EADDRINUSE :::3001`, kiểm tra tiến trình trên cổng 3001 trước khi dừng hoặc giữ tiến trình cũ nếu đang phục vụ giao diện mới.
