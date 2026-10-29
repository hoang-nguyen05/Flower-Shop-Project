# 🌸 HƯỚNG DẪN CÀI ĐẶT & TRIỂN KHAI WEBSITE BÁN HOA TƯƠI LÊN CLOUDFLARE WORKERS

Dự án đã được thiết kế và tái cấu trúc hoàn chỉnh theo chuẩn kiến trúc Serverless hiện đại nhất của **Cloudflare**, đáp ứng 100% tất cả yêu cầu của giảng viên:
1. **Giao diện thương mại điện tử**: Tương thích hoàn hảo trên cả **Điện thoại (Mobile-First)** và **Máy tính (Desktop)**, chuẩn UX/UI cao cấp.
2. **Tách biệt rõ ràng Frontend & Backend**:
   - `frontend/`: Toàn bộ giao diện người dùng (HTML5, CSS3 Responsive, JavaScript Modules, Cart Drawer, VietQR).
   - `backend/`: API Serverless chạy trên **Cloudflare Workers** (sử dụng Hono Framework chuẩn Worker, tốc độ cực nhanh, không phụ thuộc server truyền thống).
3. **Cơ sở dữ liệu Cloudflare D1**: SQL Database lưu trữ Danh mục, Sản phẩm, Đơn hàng, Chi tiết đơn hàng, Mã giảm giá (Coupons) và Đánh giá (Reviews).
4. **Bộ nhớ đệm Cloudflare Key-Value (KV)**: Xử lý và lưu trữ phiên **Giỏ hàng (Cart Session)** trực tiếp trên Backend, bộ nhớ đệm danh mục sản phẩm (Cache).
5. **Lưu trữ Cloudflare R2 (Object Storage)**: Lưu trữ và phân phối hình ảnh sản phẩm, tài liệu tải lên.
6. **Chatbot tích hợp Google Gemini API**: Tư vấn hoa tươi thông minh theo ngữ cảnh thực tế của cửa hàng.
7. **Thanh toán VietQR**: Tự động sinh mã QR chuyển khoản ngân hàng chính xác số tiền và mã đơn hàng.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```text
c:\web hoa 05\
├── frontend/                     # [FRONTEND] Tách biệt giao diện
│   ├── index.html                # Trang chủ (Banner, Ưu đãi, Danh mục, Hoa bán chạy)
│   ├── products.html             # Cửa hàng hoa (Bộ lọc danh mục, tìm kiếm, sắp xếp)
│   ├── product-detail.html       # Chi tiết sản phẩm, đánh giá sao, đặt hoa
│   ├── cart.html                 # Giỏ hàng (Backend quản lý, áp mã coupon)
│   ├── checkout.html             # Đặt hàng, điền địa chỉ, chọn VietQR / COD
│   ├── order-success.html        # Xác nhận đơn hàng, hiển thị mã QR VietQR
│   ├── orders.html               # Tra cứu lịch sử & trạng thái đơn hàng
│   ├── admin.html                # Bảng điều khiển Admin & Quản lý Cloudflare R2
│   ├── css/
│   │   └── style.css             # CSS Mobile-First, Responsive, Theme hoa tươi
│   └── js/
│       ├── api.js                # API Client giao tiếp với Cloudflare Worker
│       ├── cart.js               # Quản lý giỏ hàng gọi Backend
│       ├── chatbot.js            # Trợ lý AI tư vấn hoa kết nối Gemini API
│       └── app.js                # Quản lý Wishlist & chức năng chung
│
├── backend/                      # [BACKEND] Cloudflare Workers API
│   └── src/
│       ├── index.ts              # Entrypoint Worker & Router chính
│       ├── types.ts              # Định nghĩa Types & Cloudflare Env Bindings
│       ├── routes/
│       │   ├── products.ts       # API sản phẩm, danh mục (D1 + KV Cache)
│       │   ├── cart.ts           # API giỏ hàng Backend (Cloudflare KV + D1)
│       │   ├── orders.ts         # API đặt hàng, đơn hàng, VietQR (D1)
│       │   ├── chatbot.ts        # API AI Chatbot Google Gemini 1.5 Flash
│       │   ├── storage.ts        # API tải và hiển thị ảnh Cloudflare R2
│       │   └── admin.ts          # API thống kê số liệu Dashboard
│       └── db/
│           ├── schema.sql        # Cấu trúc bảng cơ sở dữ liệu Cloudflare D1
│           └── seed.sql          # Dữ liệu hoa tươi mẫu & mã giảm giá
│
├── wrangler.jsonc                # File cấu hình Cloudflare Worker, D1, KV, R2 & Assets
├── package.json                  # Quản lý thư viện npm và các lệnh chạy
├── tsconfig.json                 # Cấu hình TypeScript
├── .dev.vars                     # Biến môi trường local (chứa GEMINI_API_KEY)
└── .dev.vars.example             # File mẫu biến môi trường
```

---

## 🛠️ PHẦN 1: HƯỚNG DẪN CÀI ĐẶT & CHẠY THỬ LOCAL TRÊN MÁY TÍNH

### Yêu cầu trước khi chạy:
- Đã cài đặt **Node.js** (Khuyến nghị bản LTS v18 trở lên). Kiểm tra bằng cách mở terminal gõ: `node -v` và `npm -v`.

### Bước 1: Mở Terminal tại thư mục dự án và cài đặt thư viện
```bash
cd "c:\web hoa 05"
npm install
```
*(Lệnh này sẽ tự động cài đặt `hono`, `wrangler`, `@cloudflare/workers-types` và `typescript`)*.

### Bước 2: Khởi tạo Cơ sở dữ liệu Cloudflare D1 Local và nạp dữ liệu mẫu
Chạy lệnh sau để tạo các bảng SQL trong D1 trên máy tính:
```bash
npm run d1:migrate:local
```
Tiếp tục chạy lệnh nạp dữ liệu hoa tươi mẫu:
```bash
npm run d1:seed:local
```
*(Hoặc chạy gộp cả 2 bước bằng lệnh: `npm run d1:init:local`)*.

### Bước 3: Cấu hình API Key cho Chatbot Gemini (Tuỳ chọn)
Mở file `.dev.vars` và điền khóa API của bạn:
```env
GEMINI_API_KEY=AIzaSy...your-actual-api-key
VIETQR_BANK_ID=MB
VIETQR_ACCOUNT_NO=0362843621
VIETQR_ACCOUNT_NAME=NGUYEN DAC HOANG
```
> **Mẹo:** Bạn có thể tạo khóa Gemini API hoàn toàn miễn phí tại [Google AI Studio](https://aistudio.google.com/app/apikey).
> Nếu chưa điền key, hệ thống tự động sử dụng bộ máy tư vấn Florist AI thông minh tích hợp sẵn mà không bị lỗi.

### Bước 4: Khởi chạy Server phát triển
```bash
npm run dev
```
Terminal sẽ hiển thị:
```text
Ready on http://127.0.0.1:8787
```
Bây giờ bạn mở trình duyệt và truy cập: **`http://localhost:8787`** để trải nghiệm website!

---

## 🚀 PHẦN 2: HƯỚNG DẪN ĐẨY DỰ ÁN LÊN CLOUDFLARE WORKERS (DEPLOY)

Để đưa website lên internet hoạt động với tên miền miễn phí `*.workers.dev`, bạn thực hiện theo các bước sau:

### Bước 1: Đăng nhập tài khoản Cloudflare trên Terminal
```bash
npx wrangler login
```
Trình duyệt sẽ tự động mở trang xác thực của Cloudflare. Bạn bấm **Allow / Authorize** để cấp quyền cho Wrangler.

---

### Bước 2: Tạo Cơ sở dữ liệu Cloudflare D1 trên tài khoản Cloud
Chạy lệnh:
```bash
npx wrangler d1 create flower_shop_db
```
Kết quả hiển thị trên màn hình sẽ có dạng:
```text
[[d1_databases]]
binding = "DB"
database_name = "flower_shop_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
👉 **LƯU Ý:** Bạn copy chuỗi `database_id` vừa nhận được và mở file `wrangler.jsonc`, dán thay thế vào dòng:
```jsonc
"database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

### Bước 3: Tạo Cloudflare KV Namespace trên tài khoản Cloud
Chạy lệnh:
```bash
npx wrangler kv namespace create FLOWER_SHOP_KV
```
Kết quả hiển thị:
```text
[[kv_namespaces]]
binding = "KV"
id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```
👉 **LƯU Ý:** Bạn copy chuỗi `id` và dán vào phần `kv_namespaces` trong `wrangler.jsonc`:
```jsonc
"id": "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

---

### Bước 4: Tạo Cloudflare R2 Bucket (Lưu trữ ảnh & tài liệu)
Chạy lệnh:
```bash
npx wrangler r2 bucket create flower-shop-bucket
```

---

### Bước 5: Cài đặt Biến bí mật Gemini API Key lên Cloudflare
Chạy lệnh:
```bash
npx wrangler secret put GEMINI_API_KEY
```
Nhập API Key Google Gemini của bạn rồi ấn **Enter**.

---

### Bước 6: Chạy Migration và Seed dữ liệu lên Cloudflare D1 Remote
Chạy 2 lệnh sau để khởi tạo bảng và dữ liệu hoa trên máy chủ Cloudflare:
```bash
npx wrangler d1 execute flower_shop_db --remote --file=./backend/src/db/schema.sql
npx wrangler d1 execute flower_shop_db --remote --file=./backend/src/db/seed.sql
```

---

### Bước 7: Đẩy toàn bộ Website lên Cloudflare Workers!
Chạy lệnh triển khai chính thức:
```bash
npm run deploy
```
*(hoặc `npx wrangler deploy`)*.

Sau khoảng 10-20 giây, Wrangler sẽ báo thành công và cung cấp đường dẫn truy cập công khai của website, ví dụ:
```text
Total Upload: 98.89 KiB / gzip: 24.36 KiB
Uploaded flower-shop-cloudflare
Deployed flower-shop-cloudflare to:
https://flower-shop-cloudflare.<ten-tai-khoan-cua-ban>.workers.dev
```

🎉 **Chúc mừng bạn!** Bạn chỉ cần gửi đường link `https://flower-shop-cloudflare.<subdomain>.workers.dev` cho giảng viên để nghiệm thu dự án.

---

## 🌟 CÁC TÍNH NĂNG ĐẶC SẮC ĐỂ THUYẾT TRÌNH VỚI THẦY

1. **Giao diện đa nền tảng (Responsive)**:
   - Trên Điện thoại: Có thanh điều hướng ngón tay cái dưới đáy màn hình (Bottom Navigation Bar), giỏ hàng Drawer trượt mượt mà.
   - Trên Máy tính: Banner phong cách nghệ thuật, danh mục dạng chip cuộn ngang, lưới sản phẩm 4 cột chuẩn e-commerce.
2. **Backend xử lý giỏ hàng**:
   - Khi khách hàng nhấn "Thêm vào giỏ", frontend gọi API `POST /api/cart/add`.
   - Backend Cloudflare Worker kiểm tra tồn kho trong **Cloudflare D1**, sau đó lưu trữ phiên giỏ hàng vào **Cloudflare KV**.
   - Phí vận chuyển, giảm giá coupon (`FLOWER10`, `GIAM50K`, `FREESHIP`), tổng tiền thanh toán được máy chủ tính toán chính xác 100%.
3. **Thanh toán VietQR động**:
   - Khách đặt hàng chọn VietQR -> Backend sinh đường link mã QR từ VietQR API chuẩn ngân hàng Việt Nam.
   - Khi quét mã bằng ứng dụng ngân hàng, số tiền và nội dung chuyển khoản `THANHTOAN FS-XXXXXX` được điền tự động.
4. **Trợ lý AI Gemini**:
   - Tích hợp trực tiếp mô hình **Google Gemini 1.5 Flash**.
   - Backend tự động trích xuất bảng giá và danh sách hoa tươi có sẵn trong database D1 để làm kiến thức cho Gemini, giúp AI tư vấn chính xác giá và loài hoa hiện có tại shop.
5. **Quản trị Cloudflare R2**:
   - Truy cập trang `/admin.html` -> Tab **Cloudflare R2 Storage**.
   - Cho phép tải trực tiếp tệp ảnh và tài liệu lên R2 bucket, xem trước ảnh và nhận link chia sẻ trực tiếp.

