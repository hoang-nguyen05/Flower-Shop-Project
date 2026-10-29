# 🌸 FlowerShop - Website Thương Mại Điện Tử Hoa Tươi (Cloudflare Serverless Stack)

> 📌 **BÁO CÁO TOÀN DIỆN VỀ KIẾN TRÚC & HẠ TẦNG CLOUDFLARE:**  
> Xem chi tiết tại: 👉 **[BAO_CAO_DU_AN_CLOUDFLARE.md](./BAO_CAO_DU_AN_CLOUDFLARE.md)** (Trình bày chi tiết toàn bộ cơ chế Cloudflare Workers, D1 SQL, KV Cart, R2 Storage và Gemini AI).

Dự án website thương mại điện tử bán hoa tươi chuyên nghiệp được xây dựng trên nền tảng **Cloudflare Serverless**, đáp ứng đầy đủ yêu cầu tách biệt Frontend & Backend, cơ sở dữ liệu D1, lưu trữ phiên KV, kho lưu trữ đối tượng R2 và trợ lý AI Google Gemini.

- **Đường dẫn Website trực tiếp (Live Demo):** [https://flower-shop-cloudflare.dtc235200306.workers.dev](https://flower-shop-cloudflare.dtc235200306.workers.dev)
- **Mã nguồn GitHub:** [https://github.com/hoang-nguyen05/Flower-Shop-Project.git](https://github.com/hoang-nguyen05/Flower-Shop-Project.git)

---

## 🚀 Công Nghệ Sử Dụng

- **Hạ tầng triển khai**: Cloudflare Workers (Toàn bộ ứng dụng chạy trên mạng lưới Edge toàn cầu)
- **Cơ sở dữ liệu (Database)**: Cloudflare D1 (Serverless SQLite-compatible relational database)
- **Bộ nhớ đệm & Phiên làm việc (Cache & Sessions)**: Cloudflare Key-Value (KV) lưu trữ giỏ hàng Backend
- **Lưu trữ đối tượng (Object Storage)**: Cloudflare R2 lưu trữ hình ảnh sản phẩm & tài liệu
- **Backend API**: Hono Framework (TypeScript) trên Cloudflare Workers
- **Frontend**: HTML5, CSS3 Mobile-First, Bootstrap 5.3, Font Awesome 6, JavaScript Modules
- **Trí tuệ nhân tạo (AI)**: Google Gemini API (Gemini 1.5 Flash) tư vấn hoa tươi thông minh
- **Thanh toán**: VietQR động (Quét mã thanh toán ngân hàng tự động điền tiền và nội dung)

---

## 🎯 Các Tính Năng Nổi Bật

1. **Giao diện Responsive**: Tối ưu hiển thị hoàn hảo trên Điện thoại (Bottom Nav, Cart Drawer) và Máy tính (Desktop).
2. **Backend xử lý Giỏ hàng**: Giỏ hàng được quản lý và tính toán 100% tại máy chủ Cloudflare Workers, lưu trạng thái trong Cloudflare KV.
3. **Thanh toán VietQR**: Tự động sinh mã VietQR với số tiền và mã đơn hàng tương ứng.
4. **Trợ lý Florist AI**: Kết nối Google Gemini API với dữ liệu sản phẩm thực tế từ Cloudflare D1.
5. **Quản trị Admin & R2**: Thống kê doanh thu, quản lý đơn hàng, upload ảnh lên Cloudflare R2.

---

## 💻 Cách Cài Đặt & Chạy Thử Local

1. Cài đặt thư viện:
   ```bash
   npm install
   ```

2. Khởi tạo cơ sở dữ liệu D1 local:
   ```bash
   npm run d1:init:local
   ```

3. Chạy server phát triển:
   ```bash
   npm run dev
   ```
   Truy cập tại: `http://localhost:8787`

---

## 🌐 Triển Khai Lên Cloudflare Workers

Xem hướng dẫn chi tiết từng bước tạo D1, KV, R2 và đẩy dự án lên Cloudflare tại:
👉 **[HUONG_DAN_TRIEN_KHAI_CLOUDFLARE.md](./HUONG_DAN_TRIEN_KHAI_CLOUDFLARE.md)**
