-- Tạo bảng policies lưu trữ chính sách cho RAG
CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Nạp các chính sách cửa hàng
INSERT OR REPLACE INTO policies (id, title, slug, content) VALUES
(1, 'Chính Sách Vận Chuyển & Giao Hàng', 'shipping', 'FlowerShop hỗ trợ giao hoa hỏa tốc trong 2 giờ nội thành TP. Thái Nguyên, miễn phí giao hàng cho đơn từ 500.000đ. Đối với các tỉnh thành lân cận và toàn quốc (Điện Biên, Hà Nội, Bắc Kạn, Cao Bằng, Lạng Sơn...), shop đóng gói chuyên dụng trong thùng carton đứng có ống nước giữ ẩm cuống hoa, gửi xe khách liên tỉnh chất lượng cao nhận hoa tươi rói 100% ngay trong ngày.'),
(2, 'Chính Sách Đổi Trả & Bảo Hành Hoa Tươi', 'returns', 'Cam kết 100% hoa tươi mới cắt mỗi sớm mai. Quý khách được đổi bó hoa mới hoàn toàn miễn phí hoặc nhận lại 100% tiền nếu hoa bị dập nát, héo úa hoặc cắm sai mẫu yêu cầu khi nhận hàng trong vòng 24 giờ. Vui lòng chụp ảnh và gọi hotline 0362843621.'),
(3, 'Phương Thức Thanh Toán Linh Hoạt', 'payment', 'FlowerShop chấp nhận thanh toán quét mã VietQR tự động liên kết mọi ngân hàng (MB Bank 0362843621 - NGUYEN DAC HOANG), chuyển tiền Ví điện tử MoMo, hoặc thanh toán tiền mặt khi nhận hoa (COD) sau khi kiểm tra hoa ưng ý.'),
(4, 'Bí Quyết Chăm Sóc & Bảo Quản Hoa Tươi', 'care_guide', 'Để hoa tươi lâu 5-7 ngày: Cắt vát chéo gốc 45 độ dưới vòi nước trước khi cắm bình, thay nước sạch mỗi ngày, hòa thêm 1 gói dưỡng hoa hoặc vài giọt chanh. Đặt bình hoa nơi thoáng mát, tránh quạt gió thổi trực tiếp và ánh nắng gắt. Đối với hoa baby trắng, có thể phơi ngược nơi râm mát làm hoa khô lưu giữ 1-2 năm.'),
(5, 'Đặc Quyền Quà Tặng Thiệp & Banner Miễn Phí', 'gifts', 'Mọi đơn hàng tại FlowerShop đều được tặng kèm thiệp thiết kế cao cấp và Florist viết tay lời chúc nắn nót chân thành. Các mẫu kệ hoa khai trương, bó hoa tốt nghiệp cử nhân được tặng kèm dải ruy băng in tên và biểu ngữ chúc mừng miễn phí 100%.'),
(6, 'Nguồn Gốc & Xuất Xứ Hoa Tươi (Đà Lạt & Nhập Khẩu Châu Âu)', 'origin', 'FlowerShop cam kết 100% hoa tươi cao cấp tuyển chọn từ 2 nguồn cung ứng: 1. Nguồn nội địa: Cắt mới mỗi sớm mai từ các nhà vườn công nghệ cao tại Đà Lạt (Hoa Hồng Nhung, Hoa Hướng Dương, Cẩm Tú Cầu, Hoa Baby Trắng). 2. Nguồn nhập khẩu Châu Âu: Nhập khẩu chính ngạch đường hàng không bảo quản lạnh từ Hà Lan (Hoa Tulip Hà Lan Pastel), Ecuador (Hoa Hồng Ecuador cành dài 80-100cm bông to cánh dày), New Zealand và Đài Loan (Lan Hồ Điệp vương giả loại 1). Mỗi cành hoa đều qua tuyển chọn khắt khe và dưỡng nước dinh dưỡng chuyên dụng để giữ độ tươi bền 5-7 ngày.');

