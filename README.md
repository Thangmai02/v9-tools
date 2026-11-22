# Đăng Page

Tool web đăng bài công khai hàng loạt lên nhiều Page Facebook. Mỗi người tự tạo tài khoản. Admin nâng Pro thì server gắn mã khóa vào tài khoản đó. Có mã đang hiệu lực mới kết nối được Facebook và đăng bài.

## Chạy trên máy

1. Copy `.env.example` thành `.env` nếu chưa có.
2. Điền `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`. Muốn Đăng nhập bằng Gmail thì điền thêm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Redirect URI: `/api/auth/google/callback`).
3. Tạo `SESSION_SECRET` (ít nhất 16 ký tự) và `TOKEN_ENCRYPTION_KEY` (64 ký tự hex, hoặc một chuỗi bất kỳ).
4. Trên app Facebook, thêm Redirect URI trùng `FACEBOOK_REDIRECT_URI`. Máy local dùng `http://localhost:3000/api/facebook/callback`.
5. Cài và chạy:

```bash
npm install
npx prisma migrate deploy
npm run dev:all
```

Mở http://localhost:3000. `npm run dev:all` chạy cả web và worker đăng bài. Thiếu worker thì bài chỉ nằm trong hàng đợi.

Admin vào http://localhost:3000/admin bằng `ADMIN_PASSWORD`, hoặc đăng nhập tài khoản có email trong `ADMIN_EMAIL` rồi mở **Admin control** trong menu tên. Thành viên đăng ký ở trang chủ, rồi chờ bạn nâng Pro.

App Facebook cần quyền `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`. Người đăng phải là admin hoặc editor của Page. Bài gửi với `published: true`, không gắn targeting.

## Cập nhật cho cả nhóm

Chạy một server. Sửa code, build lại, khởi động lại web và worker. Ai đang mở trình duyệt sẽ dùng bản mới, không cần cài lại file.

```bash
npm run build
npm run start
npm run worker
```
