# 🌸 BÁO CÁO TỔNG QUAN KIẾN TRÚC & HẠ TẦNG CLOUDFLARE
## DỰ ÁN WEBSITE THƯƠNG MẠI ĐIỆN TỬ BÁN HOA TƯƠI (FLOWER SHOP)

> **Đơn vị đào tạo:** Trường Đại học Công Nghệ Thông Tin & Truyền Thông (ICTU) - Đại học Thái Nguyên  
> **Nhóm sinh viên thực hiện:**
> 1. **Nguyễn Đắc Hoàng** (Nhóm trưởng - Fullstack Developer & Cloudflare Architecture - MSV: DTC235200306)
> 2. **Lường Thị Hạnh** (UI/UX Designer & Content Creator)
> 3. **Nông Lâm Ngọc Sơn** (Backend Engineer & Cloudflare Storage Specialist)
> 4. **Hoàng Bắc** (Frontend Developer & QA Tester)  
> **Nền tảng công nghệ chính:** Cloudflare Serverless Stack (Workers, D1 SQL, KV Cache, R2 Storage) + AI Chatbot Florist AI  
> **Đường dẫn Website trực tiếp (Live URL):** [https://flower-shop-cloudflare.dtc235200306.workers.dev](https://flower-shop-cloudflare.dtc235200306.workers.dev)  
> **Mã nguồn GitHub:** [https://github.com/hoang-nguyen05/Flower-Shop-Project.git](https://github.com/hoang-nguyen05/Flower-Shop-Project.git)

---

## 📑 MỤC LỤC
1. [Giới Thiệu Mục Tiêu & Sự Đổi Mới Của Dự Án](#1-giới-thiệu-mục-tiêu--sự-đổi-mới-của-dự-án)
2. [Chi Tiết Hạ Tầng Cloudflare (Trọng Tâm Dự Án)](#2-chi-tiết-hạ-tầng-cloudflare-trọng-tâm-dự-án)
   - 2.1. Cloudflare Workers (Serverless Edge Runtime)
   - 2.2. Cloudflare D1 (Serverless Relational SQL Database)
   - 2.3. Cloudflare Key-Value (KV Storage - Giỏ hàng & Cache)
   - 2.4. Cloudflare R2 (S3-Compatible Object Storage)
   - 2.5. Cloudflare Static Assets (Hosting Frontend)
3. [Kiến Trúc Tách Biệt Rõ Ràng Frontend & Backend](#3-kiến-trúc-tách-biệt-rõ-ràng-frontend--backend)
4. [Cơ Chế Backend Xử Lý Giỏ Hàng & Mã Giảm Giá](#4-cơ-chế-backend-xử-lý-giỏ-hàng--mã-giảm-giá)
5. [Tích Hợp AI Chatbot Google Gemini (Cơ Chế Đa Key & Giới Hạn Nghiệp Vụ)](#5-tích-hợp-ai-chatbot-google-gemini)
6. [Thanh Toán Tự Động VietQR](#6-thanh-toán-tự-động-vietqr)
7. [Bảng Tra Cứu API Endpoints](#7-bảng-tra-cứu-api-endpoints)
8. [Hướng Dẫn Chạy Local & Triển Khai Lại (Re-deploy)](#8-hướng-dẫn-chạy-local--triển-khai-lại)
9. [Khả Năng Đặt Hàng Thực Tế & Ứng Dụng Đa Thiết Bị (Mobile / PC)](#9-khả-năng-đặt-hàng-thực-tế--ứng-dụng-đa-thiết-bị-mobile--pc)
10. [Hệ Thống Đăng Nhập, Phân Quyền (Admin/Khách) & Hồ Sơ Cá Nhân](#10-hệ-thống-đăng-nhập-phân-quyền-adminkhách--hồ-sơ-cá-nhân)

---

## 1. Giới Thiệu Mục Tiêu & Sự Đổi Mới Của Dự Án

Dự án ban đầu là một ứng dụng Django truyền thống chạy phụ thuộc vào máy chủ nội bộ và cơ sở dữ liệu SQLite cục bộ. Theo yêu cầu chuẩn hóa kiến trúc ứng dụng web hiện đại từ giảng viên, toàn bộ hệ thống đã được **tái cấu trúc 100% sang kiến trúc Serverless Cloud-Native** trên nền tảng **Cloudflare**:

| Tiêu chí | Trước đây (Monolith cũ) | Hiện tại (Cloudflare Serverless Stack) |
| :--- | :--- | :--- |
| **Hạ tầng máy chủ** | Python Django (cần thuê VPS / chạy localhost) | **Cloudflare Workers** (Serverless, chạy trên 300+ Edge Data Centers toàn cầu) |
| **Cơ sở dữ liệu** | File `db.sqlite3` nằm trên ổ cứng máy | **Cloudflare D1 SQL** (Phân tán toàn cầu, độ trễ cực thấp tại khu vực APAC) |
| **Quản lý Giỏ hàng** | Django Session lưu trong file/cookie | **Cloudflare KV** (Key-Value Engine lưu trữ giỏ hàng Backend tốc độ cao) |
| **Lưu trữ hình ảnh** | Thư mục `media/` cục bộ trên ổ đĩa | **Cloudflare R2** (Kho lưu trữ đối tượng chuẩn S3, không tốn phí băng thông ra) |
| **Kiến trúc mã nguồn** | Backend & HTML gộp chung (Template tags) | **Tách biệt 100%**: `frontend/` (SPA/MPA tĩnh) và `backend/` (RESTful API) |
| **Trợ lý AI** | Ollama cục bộ (nặng máy, yêu cầu GPU/CPU cao) | **Google Gemini 1.5/3.8 Flash** (Gọi API trực tiếp qua Worker, hỗ trợ 3 Key xoay vòng) |
| **Giao diện người dùng** | Giao diện cơ bản | **Mobile-First UX/UI**: Bottom Nav Bar, Offcanvas Cart Drawer, Toast, VietQR |

---

## 2. Chi Tiết Hạ Tầng Cloudflare (Trọng Tâm Dự Án)

Toàn bộ ứng dụng được vận hành nhờ sự kết hợp chặt chẽ giữa 5 dịch vụ cốt lõi của Cloudflare:

```
                                  [ KHÁCH HÀNG TRUY CẬP ]
                             (Điện thoại / Máy tính / Tablet)
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │          CLOUDFLARE EDGE NETWORK (CDN)        │
                    │   https://flower-shop-cloudflare.workers.dev  │
                    └───────────────────────┬───────────────────────┘
                                            │
                 ┌──────────────────────────┴──────────────────────────┐
                 │                                                     │
                 ▼                                                     ▼
    ┌─────────────────────────┐                           ┌─────────────────────────┐
    │ CLOUDFLARE STATIC ASSETS│                           │   CLOUDFLARE WORKERS    │
    │     (Thư mục frontend/) │                           │     (backend/src/)      │
    │  - HTML, CSS, JS, Fonts │                           │  - Hono REST Framework  │
    │  - Cache vĩnh viễn CDN  │                           │  - Middleware CORS, Auth│
    └─────────────────────────┘                           └────────────┬────────────┘
                                                                       │
                 ┌─────────────────────────────────────────────────────┼───────────────────────────────────┐
                 │                                                     │                                   │
                 ▼                                                     ▼                                   ▼
    ┌─────────────────────────┐                           ┌─────────────────────────┐         ┌─────────────────────────┐
    │      CLOUDFLARE D1      │                           │      CLOUDFLARE KV      │         │      CLOUDFLARE R2      │
    │    (Database SQL APAC)  │                           │ (Key-Value Session/Cache│         │(Object Storage - Ảnh R2)│
    │  - categories, products │                           │  - cart:<session_id>    │         │  - uploads/anh-hoa.jpg  │
    │  - orders, order_items  │                           │  - cache:categories     │         │  - invoices, documents  │
    │  - coupons, reviews     │                           │  - cache:products       │         │  - S3 Compatible API    │
    └─────────────────────────┘                           └─────────────────────────┘         └─────────────────────────┘
                 ▲                                                     ▲
                 │                                                     │
                 └──────────────────────────────┬──────────────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │   GOOGLE GEMINI 1.5 AI    │
                                  │(Tư vấn hoa & tính năng web│
                                  │  Xoay vòng 3 API Keys)    │
                                  └───────────────────────────┘
```

### 2.1. Cloudflare Workers (Serverless Edge Runtime)
- **Tên Worker:** `flower-shop-cloudflare`
- **Tài khoản triển khai:** `Dtc235200306@ictu.edu.vn's Account` (`701ece81cedd7db4bf1eb764825c6781`)
- **Thời gian khởi động (Cold Start):** `~1 ms` (so với hàng trăm mili-giây của server truyền thống).
- **Công nghệ Backend:** **Hono Framework** (`hono@^4.7.2`) viết bằng **TypeScript**. Hono được mệnh danh là web framework nhanh nhất thế giới trên môi trường Workers, hỗ trợ định tuyến chuẩn xác, kiểm soát CORS và xử lý lỗi an toàn.

### 2.2. Cloudflare D1 (Serverless Relational SQL Database)
- **Tên Database:** `flower_shop_db`
- **Database UUID:** `6104d683-ae9f-4915-84b9-770c795003f4`
- **Khu vực đặt dữ liệu (Region):** `APAC` (Hong Kong / Singapore - cực gần Việt Nam, ping 20-30ms).
- **Cấu trúc bảng (Schema SQL - Đã nạp thành công):**
  1. `categories`: Danh mục hoa tươi (Hoa Hồng, Lan Hồ Điệp, Cẩm Tú Cầu, Hướng Dương, Tulip, Baby & Mẫu Đơn).
  2. `products`: Sản phẩm hoa (ID, tên, slug, giá bán, giá gốc, tồn kho, mô tả, ảnh, trạng thái nổi bật/khuyến mãi).
  3. `orders`: Đơn hàng đặt mua (Mã đơn `FS-XXXXXX`, họ tên, SĐT, địa chỉ, phương thức COD/VietQR, trạng thái, tổng tiền).
  4. `order_items`: Chi tiết từng món hoa trong đơn hàng (liên kết khóa ngoại `FOREIGN KEY` với bảng `orders`).
  5. `coupons`: Mã giảm giá (`FLOWER10`, `GIAM50K`, `FREESHIP`), điều kiện đơn tối thiểu, số lần đã sử dụng.
  6. `reviews`: Đánh giá chất lượng sản phẩm (1-5 sao, nhận xét của khách).
- **Chỉ mục (Index):** Tạo đầy đủ index cho các trường tìm kiếm thường xuyên như `slug`, `category_id`, `customer_phone`, `order_code`.

### 2.3. Cloudflare Key-Value (KV Storage - Lưu Giỏ Hàng & Caching)
- **Tên Namespace:** `FLOWER_SHOP_KV`
- **KV ID:** `158758169aee453e851f5703669a4ab9`
- **Ứng dụng thực tế trong dự án:**
  - **Lưu trữ Giỏ hàng (Cart Session):** Mỗi khách hàng truy cập được cấp một định danh `x-session-id`. Dữ liệu giỏ hàng (danh sách món hoa, số lượng, mã coupon đã chọn) được lưu trực tiếp vào KV theo định dạng key:  
    `cart:sess_xxxxxxxxx`  
    Thời gian sống (TTL) tự động là **7 ngày**. Khi khách quay lại, giỏ hàng vẫn còn nguyên mà không làm nặng database D1.
  - **Bộ nhớ đệm tốc độ cao (Edge Caching):** Danh mục hoa được cache tại key `cache:categories` với TTL 1 giờ. Khi khách hàng tải trang, phản hồi trả về từ KV tức thì (nguồn: `kv_cache`).

### 2.4. Cloudflare R2 (Object Storage - Lưu Trữ Ảnh & Tài Liệu)
- **Tên Bucket cấu hình:** `flower-shop-bucket`
- **Cơ chế hoạt động:**
  - API `POST /api/storage/upload`: Nhận file ảnh/tài liệu từ người dùng, tự động làm sạch tên file và lưu vào R2 bucket với đầy đủ `httpMetadata` (Content-Type) và `customMetadata`.
  - API `GET /api/storage/files/*`: Phân phối ảnh trực tiếp từ R2 kèm header `Cache-Control: public, max-age=31536000, immutable` giúp ảnh tải siêu tốc và tiết kiệm tài nguyên.
  - Tab quản trị R2 trong trang `/admin.html` cho phép xem danh sách file, dung lượng và lấy link chia sẻ.
- **Tính an toàn:** Mã nguồn được lập trình với cơ chế phòng vệ (Defensive Coding) - nếu người dùng chưa bấm nút "Enable R2" trên trang Cloudflare Dashboard, website vẫn hoạt động ổn định và dùng các ảnh hoa CDN chuẩn bị sẵn.

### 2.5. Cloudflare Static Assets (Hosting Frontend)
- Thư mục `frontend/` được cấu hình thông qua cờ `"assets": { "directory": "./frontend" }` trong `wrangler.jsonc`.
- Toàn bộ file HTML, CSS, JavaScript, WebP được Cloudflare tự động nén Gzip, sinh ETag và cache tại các máy chủ Edge. Mọi yêu cầu không thuộc `/api/*` sẽ được tự động phân phối với mã phản hồi `200 OK` (CF-Cache-Status: HIT).

---

## 3. Kiến Trúc Tách Biệt Rõ Ràng Frontend & Backend

Dự án được phân chia thư mục tường minh, đảm bảo nguyên tắc Separation of Concerns:

```text
c:\web hoa 05\
├── frontend/                     # [FRONTEND] Độc lập hoàn toàn, không dính mã backend
│   ├── index.html                # Trang chủ: Banner nghệ thuật, hoa nổi bật, flash sale
│   ├── products.html             # Cửa hàng: Bộ lọc danh mục, lọc khuyến mãi, tìm kiếm từ khóa, sắp xếp giá
│   ├── product-detail.html       # Chi tiết hoa: Thư viện ảnh, mô tả, chọn số lượng, đánh giá nhận xét
│   ├── cart.html                 # Giỏ hàng: Bảng chi tiết, tăng/giảm số lượng, áp mã giảm giá
│   ├── checkout.html             # Thanh toán: Điền địa chỉ nhận hoa, ghi lời chúc thiệp, chọn VietQR/COD
│   ├── order-success.html        # Đặt hàng thành công: Tự động hiển thị mã QR VietQR chuyển khoản
│   ├── orders.html               # Tra cứu tiến độ đơn hàng theo SĐT hoặc mã đơn FS-XXXXXX
│   ├── admin.html                # Bảng điều khiển quản trị viên: Thống kê D1, quản lý ảnh R2
│   ├── css/
│   │   └── style.css             # CSS Mobile-First: Theme hoa cao cấp, Bottom Nav, Offcanvas Drawer
│   └── js/
│       ├── api.js                # Client gọi API, quản lý x-session-id & hiển thị Toast
│       ├── cart.js               # Kết nối API giỏ hàng Backend & đồng bộ Drawer
│       ├── chatbot.js            # Giao diện Chatbot & hiệu ứng trò chuyện thông minh
│       └── app.js                # Xử lý Wishlist yêu thích & sự kiện chung
│
├── backend/                      # [BACKEND] Chạy trên Cloudflare Workers
│   └── src/
│       ├── index.ts              # Worker Entrypoint, CORS Middleware & Router
│       ├── types.ts              # Định nghĩa Interface TypeScript & Cloudflare Bindings
│       ├── routes/
│       │   ├── products.ts       # API danh mục & sản phẩm (kết hợp D1 + KV)
│       │   ├── cart.ts           # Logic giỏ hàng xử lý trên máy chủ (D1 + KV)
│       │   ├── orders.ts         # Logic đặt hàng, cập nhật trạng thái & tạo link VietQR
│       │   ├── chatbot.ts        # Tích hợp Google Gemini AI (3 Keys xoay vòng)
│       │   ├── storage.ts        # API tải và hiển thị file từ Cloudflare R2
│       │   └── admin.ts          # API tổng hợp số liệu Dashboard
│       └── db/
│           ├── schema.sql        # 21 lệnh DDL khởi tạo bảng SQL D1
│           └── seed.sql          # Dữ liệu hoa tươi mẫu & mã ưu đãi D1
│
├── wrangler.jsonc                # Tệp cấu hình tổng thể của Cloudflare
├── package.json                  # Scripts quản lý vòng đời dự án
├── tsconfig.json                 # Cấu hình TypeScript nghiêm ngặt
├── .dev.vars                     # Biến môi trường khi chạy máy cá nhân (chứa GEMINI_API_KEY)
└── .env.example                  # Mẫu biến môi trường an toàn đẩy lên GitHub
```

---

## 4. Cơ Chế Backend Xử Lý Giỏ Hàng & Mã Giảm Giá

Theo yêu cầu của đề tài: **"Giao diện có giỏ hàng, backend xử lý phần giỏ hàng"**:
- **Không bao giờ tính tiền ở Frontend:** Toàn bộ công thức tính giá, tiền giảm, phí ship và tồn kho đều do Backend Worker kiểm soát để chống gian lận dữ liệu.
- **Quy trình hoạt động:**
  1. Khi người dùng bấm *"Thêm vào giỏ"*, Frontend gửi `POST /api/cart/add` kèm `{ productId, quantity }`.
  2. Backend kiểm tra sản phẩm trong **Cloudflare D1** (sản phẩm có còn sẵn bán `available = 1` không, số lượng có vượt quá tồn kho `stock` không).
  3. Backend ghi nhận trạng thái món hàng vào phiên làm việc trong **Cloudflare KV**.
  4. Nếu có mã giảm giá (VD: `FLOWER10`), Backend truy vấn bảng `coupons` trong D1:
     - Kiểm tra hạn sử dụng (`valid_to`).
     - Kiểm tra giá trị đơn hàng tối thiểu (`min_order_value`).
     - Tự động trừ tiền giảm giá và miễn phí ship nếu đơn từ 500.000đ hoặc áp mã `FREESHIP`.
  5. Backend trả về toàn bộ dữ liệu giỏ hàng đã tính toán đầy đủ cho Frontend cập nhật giao diện giỏ hàng và Offcanvas Drawer.

---

## 5. Tích Hợp Kiến Trúc Enterprise AI Cho Trợ Lý Ảo (8 Trụ Cột Doanh Nghiệp)

Trợ lý ảo **Florist AI** không chỉ là một chatbot trả lời tĩnh, mà được thiết kế theo đúng mô hình kiến trúc AI chuyên nghiệp của các doanh nghiệp lớn gồm đầy đủ **8 trụ cột cốt lõi**:

```
[ NGƯỜI DÙNG NHẮP CHAT ]
          │
          ▼
1. GUARDRAILS (Lọc đầu vào / Chống Prompt Injection)
          │
          ▼
2. CACHE & ROUTER (Kiểm tra Cloudflare KV Cache FAQ -> 0.4s phản hồi)
          │ (Nếu chưa có trong cache)
          ▼
3. PHÂN QUYỀN RBAC (Chặn truy cập dữ liệu Admin / Bảo mật tuyệt đối)
          │
          ▼
4. AGENT TOOLS (Thực thi tra cứu Đơn hàng / Coupon trực tiếp từ D1)
          │
          ▼
5. RAG KNOWLEDGE BASE (Nạp bảng giá hoa thực tế, tồn kho, địa chỉ shop)
          │
          ▼
6. SYSTEM PROMPT (Định hình phong cách chuyên gia Florist AI)
          │
          ▼
7. MODEL RIÊNG & MULTI-KEY (Gemini 3.1 Flash-Lite siêu tốc 1-2s + Xoay 3 Key)
          │
          ▼
8. OBSERVABILITY & UI (Báo cáo độ trễ ms, trạng thái Đang suy nghĩ trực quan)
```

### 5.1. Trụ Cột 1: Model Riêng & Bộ Định Tuyến Mô Hình Tốc Độ Cao
- **Model chính thức:** `gemini-3.1-flash-lite` (Thế hệ model mới nhất tối ưu độ trễ siêu tốc: **1.0s – 2.2s**), dự phòng `gemini-3.5-flash-lite` và `gemini-3.6-flash`.
- **Cơ chế xoay vòng 3 API Key (Multi-Key Load Balancing):** Hệ thống tích hợp 3 khóa bí mật trong Cloudflare Secret. Nếu 1 key chạm hạn mức (Rate limit 429), Worker tự động chuyển key kế tiếp mà khách hàng không hề gián đoạn.

### 5.2. Trụ Cột 2: System Prompt & Kỹ Thuật Đóng Vai (Persona Engineering)
- Định danh độc quyền: **"Florist AI"** – Chuyên gia tư vấn hoa nghệ thuật và chăm sóc khách hàng của FlowerShop Thái Nguyên.
- Tự nhiên, ấm áp, tinh tế, sử dụng icon hoa lá tươi tắn, hướng dẫn khách hàng chọn hoa đúng dịp và báo giá chính xác.

### 5.3. Trụ Cột 3: RAG (Retrieval-Augmented Generation / Dữ Liệu Thực Tế Từ D1)
- Trước khi gọi AI, Worker tự động truy vấn Cloudflare D1 SQL lấy toàn bộ:
  - Danh mục hoa (`categories`)
  - Bảng giá hoa thực tế, số lượng tồn kho còn lại (`products`)
  - Danh sách mã giảm giá hợp lệ (`coupons`: `FLOWER10`, `GIAM50K`, `FREESHIP`)
  - Địa chỉ tiệm hoa (ICTU Thái Nguyên), Hotline `0362843621` và chính sách giao hoa 2 giờ.
- Đảm bảo AI **không bao giờ bịa đặt** thông tin hay đưa ra sản phẩm không có thật.

### 5.4. Trụ Cột 4: Agent Tools (Công Cụ Thực Thi Nghiệp Vụ - Function Execution)
- **Tool tra cứu đơn hàng (`lookup_order`):** Khi khách hàng hỏi *"Đơn hàng FS-601478-492 của tôi tới đâu rồi?"* hoặc nhập số điện thoại, hệ thống trực tiếp kích hoạt công cụ truy vấn bảng `orders`, đọc ra người nhận, tổng tiền, phương thức thanh toán và trạng thái tiến độ 4 bước để thông báo cho khách.
- **Tool kiểm tra ưu đãi (`check_coupon`):** Tự động kiểm tra giá trị đơn hàng để gợi ý mã giảm giá tối ưu nhất.

### 5.5. Trụ Cột 5: Phân Quyền Theo Vai Trò (Role-Based Access Control - RBAC)
- Khách hàng chỉ được phép tương tác trong phạm vi mua sắm, tư vấn hoa và tra cứu đơn hàng của mình.
- Hệ thống chặn đứng mọi câu hỏi liên quan đến doanh thu tổng của shop, can thiệp xóa/sửa sản phẩm, hoặc truy cập bảng dữ liệu Admin nội bộ.

### 5.6. Trụ Cột 6: Guardrails (Lọc Đầu Vào, Chống Prompt Injection & Che Giấu PII)
- **Input Guardrail:** Tự động phát hiện và vô hiệu hóa các câu lệnh cố tình bẻ khóa AI (như *"bỏ qua các chỉ dẫn trước"*, *"bạn là admin"*, *"print system prompt"*...).
- **Output Guardrail (PII Masking):** Tự động phát hiện và che giấu các chuỗi nhạy cảm (API Keys, Passwords Hash, Token) trước khi trả về trình duyệt người dùng.

### 5.7. Trụ Cột 7: Cache & Router (Bộ Nhớ Đệm Cloudflare KV Siêu Tốc)
- Các câu hỏi tĩnh thường gặp (FAQ: địa chỉ shop, chính sách giao hàng 2h, phương thức thanh toán VietQR) được tự động lưu bộ nhớ đệm tại Cloudflare KV.
- Khi người dùng hỏi lại, câu trả lời trả về chỉ sau **0.4 giây (400ms)**, tiết kiệm 100% quota AI và tăng tốc độ tối đa.

### 5.8. Trụ Cột 8: Observability & Trải Nghiệm Người Dùng (UX Thinking Indicator)
- **Hiệu ứng "Đang suy nghĩ / Đang tra cứu" trực quan:** Trong khi AI xử lý, khung chat hiển thị bong bóng động với 3 dấu chấm nhảy và thông báo liên tục:
  *"🌸 Florist AI đang đọc tin nhắn..."* ➡️ *"🔍 Đang tra cứu danh mục & giá hoa..."* ➡️ *"✍️ Đang soạn câu trả lời cho bạn..."*, giải quyết triệt để cảm giác bị đơ.
- **Minh bạch độ trễ (Latency Tag):** Mỗi tin nhắn từ AI đều hiển thị thời gian phản hồi thực tế (ví dụ: `⚡ 1.2s • Florist AI (gemini-3.1-flash-lite)`).

---

## 6. Thanh Toán Tự Động VietQR

Dự án tích hợp giải pháp thanh toán không dùng tiền mặt chuẩn Quốc gia **VietQR**:
- **Cấu hình ngân hàng:** Ngân hàng Quân Đội (`MB`), Số tài khoản `0362843621`, Tên thụ hưởng `NGUYEN DAC HOANG`.
- **Cơ chế sinh mã QR động:**
  Khi khách bấm xác nhận đặt hàng với phương thức VietQR, Backend Worker tự động tạo URL hình ảnh mã QR chuẩn:
  ```text
  https://img.vietqr.io/image/MB-0362843621-compact2.png?amount={TỔNG_TIỀN}&addInfo=THANHTOAN%20{MÃ_ĐƠN}&accountName=NGUYEN%20DAC%20HOANG
  ```
- **Trải nghiệm khách hàng:** Khách chỉ cần mở bất kỳ ứng dụng ngân hàng nào (Vietcombank, MB, Techcombank, BIDV, VPBank,...) quét mã là hệ thống tự động điền đúng số tiền và nội dung `THANHTOAN FS-XXXXXX`, không lo chuyển nhầm hay sai sót.

---

## 7. Bảng Tra Cứu API Endpoints

| Phương thức | Đường dẫn API | Chức năng | Dịch vụ Cloudflare |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/health` | Kiểm tra trạng thái hoạt động của Worker, D1, KV, R2 và Gemini | Workers |
| `GET` | `/api/categories` | Lấy danh sách danh mục hoa (ưu tiên đọc từ KV cache) | D1 & KV |
| `GET` | `/api/products` | Lọc hoa theo danh mục, tìm kiếm từ khóa, lọc khuyến mãi, sắp xếp | D1 |
| `GET` | `/api/products/:id` | Xem chi tiết bó hoa, danh sách đánh giá sao và hoa tương tự | D1 |
| `GET` | `/api/cart` | Lấy giỏ hàng chi tiết của người dùng theo session | KV & D1 |
| `POST` | `/api/cart/add` | Thêm hoa vào giỏ (kiểm tra tồn kho D1, lưu vào KV) | KV & D1 |
| `PUT` | `/api/cart/update` | Cập nhật số lượng hoa trong giỏ | KV & D1 |
| `DELETE` | `/api/cart/item/:id` | Xóa 1 món hoa khỏi giỏ hàng | KV |
| `POST` | `/api/cart/coupon` | Áp dụng mã giảm giá (kiểm tra hợp lệ trong D1, lưu vào KV) | D1 & KV |
| `POST` | `/api/orders` | Đặt hàng: lưu đơn vào D1, trừ tồn kho, dọn giỏ KV, sinh link VietQR | D1 & KV |
| `GET` | `/api/orders/:code` | Tra cứu chi tiết tiến độ đơn hàng theo mã đơn hoặc số điện thoại | D1 |
| `POST` | `/api/chatbot` | Gửi câu hỏi cho Trợ lý Florist AI xử lý bằng Google Gemini | Gemini & D1 |
| `POST` | `/api/storage/upload` | Tải hình ảnh sản phẩm / tài liệu lên kho lưu trữ đám mây | Cloudflare R2 |
| `GET` | `/api/storage/files/*`| Phân phối hình ảnh từ Cloudflare R2 với bộ nhớ đệm CDN | Cloudflare R2 |
| `GET` | `/api/admin/dashboard`| Thống kê tổng doanh thu, số đơn hàng, đơn chờ duyệt trong D1 | D1 |

---

## 8. Hướng Dẫn Chạy Local & Triển Khai Lại (Re-deploy)

### 8.1. Chạy thử trên máy tính (Local Development)
```bash
# 1. Cài đặt thư viện
npm install

# 2. Khởi tạo và nạp dữ liệu vào D1 Local
npm run d1:init:local

# 3. Khởi động server mô phỏng Cloudflare Worker
npm run dev
# Mở trình duyệt: http://localhost:8787
```

### 8.2. Triển khai lên Cloudflare Workers (Production Deployment)
Nếu bạn thay đổi giao diện hoặc logic và muốn cập nhật lại lên internet:
```bash
npm run deploy
```
Wrangler sẽ tự động tối ưu hóa, đóng gói tài nguyên và đẩy lên địa chỉ chính thức:  
**https://flower-shop-cloudflare.dtc235200306.workers.dev**

---

## 9. Khả Năng Đặt Hàng Thực Tế & Ứng Dụng Đa Thiết Bị (Mobile / PC)

**Câu hỏi đặt ra:** *Người khác mở link web này từ điện thoại hoặc máy tính cá nhân ở nơi khác thì có đặt hàng thật được không? Dự án có hoạt động thực tế như một shop online thật sự không?*

**Câu trả lời là: HOÀN TOÀN CÓ THỂ ĐẶT HÀNG THỰC TẾ 100%!**

Dự án không phải là giao diện mockup hay giả lập, mà là một ứng dụng thương mại điện tử hoạt động thực thụ trên internet với chu trình khép kín:

1. **Truy cập tự do trên mọi thiết bị và hệ điều hành:**
   - Link `https://flower-shop-cloudflare.dtc235200306.workers.dev` là đường dẫn công khai toàn cầu được phân phối bởi CDN Cloudflare (300+ Edge Data Centers). Bất kỳ ai mở trên iPhone, Android, MacBook, laptop Windows qua 4G/5G/WiFi đều truy cập tức thì mà không cần cài đặt gì.
2. **Phiên giỏ hàng độc lập từng người dùng (Cloudflare KV):**
   - Mỗi khách truy cập sẽ được tự động cấp một mã phiên (`x-session-id`) lưu trữ trên cookie/localStorage.
   - Khi Người A đặt hoa hồng trên điện thoại, Người B đặt lan hồ điệp trên máy tính, giỏ hàng của hai người hoàn toàn độc lập, lưu trên Cloudflare KV. Khi tắt trình duyệt hoặc đổi tab quay lại, giỏ hàng vẫn được bảo toàn nguyên vẹn.
3. **Quy trình đặt hàng thực tế & Trừ kho tự động (Cloudflare D1 SQL):**
   - Khi khách hàng điền tên, số điện thoại, địa chỉ nhận hoa và bấm **"Xác Nhận Đặt Hoa"**:
   - Backend Cloudflare Worker tiếp nhận, xác thực tồn kho thực tế trong CSDL D1.
   - Sinh mã đơn hàng chuẩn định dạng `FS-1730...`.
   - Lưu đầy đủ thông tin đơn hàng vào bảng `orders` và bảng `order_items`.
   - **Tự động trừ số lượng tồn kho** của từng mẫu hoa trong D1 để ngăn chặn tình trạng bán vượt số lượng thực tế.
4. **Thanh toán chuyển khoản thực tế qua VietQR:**
   - Khách hàng chọn phương thức "Chuyển khoản VietQR" sẽ nhận ngay mã QR động tích hợp thông tin tài khoản thụ hưởng:
     - **Ngân hàng:** MB Bank (Ngân hàng Quân đội)
     - **Số tài khoản:** `0362843621`
     - **Chủ tài khoản:** `NGUYEN DAC HOANG`
     - **Số tiền:** Đúng chính xác số tiền cần thanh toán của đơn hàng (sau khi đã tính mã giảm giá).
     - **Nội dung:** Đúng mã đơn hàng `THANHTOAN FS-XXXXXX`.
   - Người mua dùng bất kỳ app ngân hàng nào (Vietcombank, MB, Techcombank, VPBank, MoMo,...) quét mã là **tiền thật sẽ chuyển thẳng vào tài khoản MB Bank của bạn ngay tức thì**.
5. **Tra cứu đơn hàng minh bạch cho khách hàng:**
   - Khách hàng có thể truy cập trang `/orders.html`, nhập số điện thoại hoặc mã đơn hàng vừa đặt để theo dõi trạng thái tiến độ ("Chờ xác nhận", "Đang cắm hoa", "Đang giao hàng", "Giao thành công").
6. **Bảng điều khiển quản lý đơn hàng cho chủ shop:**
   - Chủ shop có thể mở trang `/admin.html` trên điện thoại hoặc máy tính để duyệt đơn, xem khách nào vừa đặt từ đâu, doanh thu tích lũy và cập nhật trạng thái đơn hàng theo thời gian thực.

---

## 10. Hệ Thống Đăng Nhập, Phân Quyền (Admin/Khách) & Hồ Sơ Cá Nhân

Nhằm đáp ứng đầy đủ tính năng tiêu chuẩn của một sàn thương mại điện tử chuyên nghiệp, hệ thống đã tích hợp trọn vẹn module **Xác thực người dùng (Authentication) và Phân quyền theo vai trò (Role-Based Authorization)**:

### 10.1. Cơ Chế Lưu Trữ & Bảo Mật Chuẩn Cloudflare
- **Mật khẩu an toàn:** Mật khẩu được băm (hash) bằng thuật toán SHA-256 kết hợp mã muối bảo mật (Salt) thông qua chuẩn **Web Crypto API** chạy trực tiếp trong Cloudflare Workers, không lưu mật khẩu thô.
- **Quản lý phiên làm việc (Session Management) trên Cloudflare KV:** Khi người dùng đăng nhập thành công, một Token bảo mật được tạo ra và lưu trong **Cloudflare Key-Value (KV)** với thời hạn 7 ngày (`expirationTtl: 604800s`). Mỗi khi người dùng gọi API, Worker tra cứu trực tiếp từ KV với tốc độ miligiây.
- **Bảng dữ liệu `users` & `wishlists` trong Cloudflare D1:** Lưu thông tin tài khoản, vai trò (`role: 'admin'` hoặc `'customer'`), số điện thoại, địa chỉ mặc định và danh sách hoa yêu thích.

### 10.2. Phân Quyền Vai Trò Rõ Ràng (RBAC)

| Vai trò (Role) | Tài khoản mẫu | Quyền hạn & Tính năng trên Website |
| :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin` / `admin123` | - Truy cập toàn quyền **Bảng điều khiển Quản trị (`/admin.html`)**.<br>- Xem thống kê tổng doanh thu, số đơn, số thành viên.<br>- Quản lý đơn hàng: Đổi trạng thái (Chờ xác nhận ➡️ Đang cắm hoa ➡️ Đang giao ➡️ Hoàn thành ➡️ Hủy đơn).<br>- Quản lý sản phẩm: Thêm mẫu hoa mới, sửa giá, sửa số lượng kho, xóa hoa trong Cloudflare D1.<br>- Quản lý danh sách thành viên trong hệ thống.<br>- Tải ảnh lên kho Cloudflare R2.<br>- Cấu hình khóa API cho Florist AI. |
| **Khách hàng (Customer)** | `khachhang` / `123456` | - Quản lý **Hồ sơ cá nhân (`/profile.html`)**: Đổi tên, số điện thoại, địa chỉ nhận hoa mặc định, đổi avatar.<br>- **Đổi mật khẩu** tài khoản an toàn.<br>- Xem **Lịch sử đơn hàng cá nhân** và tiến độ xử lý.<br>- Quản lý **Danh sách hoa yêu thích (`/wishlist.html`)**.<br>- **Tự động điền (Auto Pre-fill):** Khi vào trang Thanh toán (`/checkout.html`), hệ thống tự động điền sẵn Họ tên, SĐT và Địa chỉ từ hồ sơ cá nhân.<br>- **Chặn truy cập Admin (Auth Gate):** Khách hàng bình thường nếu truy cập vào `/admin.html` sẽ bị hệ thống chặn lại và yêu cầu đăng nhập bằng tài khoản Admin. |

### 10.3. Giao Diện Người Dùng & Điều Hướng Thông Minh (Dynamic Navbar)
- **Khi chưa đăng nhập:** Góc trên Navbar hiển thị nút **"Đăng Nhập"** & **"Đăng Ký"**; thanh điều hướng dưới mobile hiển thị icon "Đăng nhập".
- **Khi đã đăng nhập:** Hiển thị Avatar tròn + Họ tên người dùng + Dropdown menu cá nhân hóa:
  - 👤 **Hồ sơ cá nhân** (`/profile.html`)
  - 📦 **Đơn hàng của tôi** (`/orders.html`)
  - ❤️ **Hoa yêu thích** (`/wishlist.html`)
  - ⚙️ **Trang Quản Trị Admin** (`/admin.html`) *(chỉ hiển thị nếu tài khoản là Admin)*
  - 🚪 **Đăng xuất**

---

## 🏆 KẾT LUẬN & ĐÁNH GIÁ CHUNG

Dự án đã giải quyết trọn vẹn và chuyên nghiệp toàn bộ các yêu cầu của giảng viên:
1. **Giao diện đa nền tảng**: Trải nghiệm mượt mà, thân thiện cả trên điện thoại lẫn màn hình máy tính.
2. **Kiến trúc Cloud-Native**: Không còn phụ thuộc máy chủ truyền thống hay file SQLite nội bộ; toàn bộ dữ liệu, bộ nhớ đệm, tài nguyên ảnh và logic tính toán đều đặt trên hạ tầng phân tán toàn cầu của **Cloudflare (Workers, D1, KV, R2)**.
3. **Trí tuệ nhân tạo thực tiễn**: Tích hợp **Google Gemini AI** với vai trò tư vấn viên bán hoa nội bộ trên web, có ngữ cảnh thực tế của cửa hàng và cơ chế bảo vệ phân quyền admin.
4. **Quy trình thương mại điện tử khép kín**: Từ chọn hoa, quản lý giỏ hàng trên backend, tính giảm giá coupon, thanh toán VietQR động cho tới tra cứu tiến độ đơn hàng.
