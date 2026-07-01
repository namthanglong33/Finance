# Finance

Công cụ tính và tối ưu hóa thuế cho doanh nghiệp Việt Nam — hỗ trợ thuế thu nhập cá nhân (TNCN) lũy tiến, thuế thu nhập doanh nghiệp (TNDN), và tối ưu chi phí nhân sự theo loại hợp đồng.

## Yêu cầu

- Node.js 24
- pnpm
- PostgreSQL (qua biến môi trường `DATABASE_URL`)

## Bắt đầu

```bash
pnpm install
```

Tạo file `.env` với chuỗi kết nối Postgres:

```
DATABASE_URL=postgres://user:password@localhost:5432/finance
```

Đẩy schema và chạy API server:

```bash
pnpm --filter @workspace/db run push        # đẩy schema DB (dev)
pnpm --filter @workspace/api-server run dev  # chạy API server (cổng 5000)
```

Trên Windows có thể dùng `start.bat`; trên macOS/Linux dùng `./start.sh`.

## Các lệnh thường dùng

| Lệnh | Mô tả |
|------|-------|
| `pnpm run typecheck` | Typecheck toàn bộ packages |
| `pnpm run build` | Typecheck + build tất cả packages |
| `pnpm --filter @workspace/api-spec run codegen` | Sinh lại API hooks & Zod schema từ OpenAPI spec |
| `pnpm --filter @workspace/db run push` | Đẩy thay đổi schema DB (chỉ dùng cho dev) |

## Công nghệ

- **Monorepo:** pnpm workspaces
- **Backend:** Node.js 24, Express 5, TypeScript 5.9
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API codegen:** Orval (sinh từ OpenAPI spec)
- **Build:** esbuild

## Cấu trúc

| Thư mục | Nội dung |
|---------|----------|
| `finance/lib/api-spec` | Đặc tả OpenAPI — nguồn chân lý cho API |
| `finance/lib/api-zod` | Zod schema sinh từ spec |
| `finance/lib/api-client-react` | API client cho React |
| `finance/lib/db` | Schema database (Drizzle) |
| `finance/scripts` | Script tiện ích |
# Finance
