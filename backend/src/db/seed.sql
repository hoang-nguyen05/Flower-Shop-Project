-- ===================================================
-- Cloudflare D1 Seed Data - Flower Shop Catalog
-- ===================================================

-- 1. DANH MỤC HOA
INSERT INTO categories (id, name, slug, description, image_url) VALUES
(1, 'Hoa Hồng', 'hoa-hong', 'Biểu tượng của tình yêu ngọt ngào, đam mê và sự lãng mạn bất tận.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'),
(2, 'Hoa Lan Hồ Điệp', 'hoa-lan-ho-diep', 'Vẻ đẹp quý phái, thanh lịch, vương giả cho ngày khai trương và tân gia.', 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600&auto=format&fit=crop&q=80'),
(3, 'Hoa Cẩm Tú Cầu', 'hoa-cam-tu-cau', 'Những cụm hoa tròn sum suê mang ý nghĩa lòng biết ơn và chân thành.', 'https://images.unsplash.com/photo-1533616688419-b7a585564566?w=600&auto=format&fit=crop&q=80'),
(4, 'Hoa Hướng Dương', 'hoa-huong-duong', 'Ánh sáng rực rỡ, năng lượng tích cực cho lời chúc tốt nghiệp và vươn xa.', 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=600&auto=format&fit=crop&q=80'),
(5, 'Hoa Tulip', 'hoa-tulip', 'Dịu dàng, hiện đại và sang trọng phong cách châu Âu tươi mới.', 'https://images.unsplash.com/photo-1520763185298-1b434c919102?w=600&auto=format&fit=crop&q=80'),
(6, 'Hoa Baby & Cúc Mẫu Đơn', 'hoa-baby-mau-don', 'Những cánh hoa mềm mại, thuần khiết tạo điểm nhấn tinh tế.', 'https://images.unsplash.com/photo-1542526259-465a706f89ce?w=600&auto=format&fit=crop&q=80');

-- 2. SẢN PHẨM HOA TƯƠI
INSERT INTO products (id, category_id, name, slug, image_url, description, price, original_price, stock, is_featured, available) VALUES
(1, 1, 'Bó Hoa Hồng Đỏ Tình Nồng', 'bo-hoa-hong-do-tinh-nong', 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=600&auto=format&fit=crop&q=80', 'Bó hoa gồm 33 đóa hồng Ecuador nhung đỏ thắm phối lá bạc nhập khẩu, tượng trưng cho tình yêu sâu đậm và duy nhất.', 499000, 599000, 20, 1, 1),
(2, 1, 'Hồng Trắng Tinh Khôi Paris', 'hong-trang-tinh-khoi-paris', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80', 'Hồng trắng Đà Lạt tuyển chọn hạng A bọc giấy kraft mộc mạc, mang vẻ đẹp thuần khiết và thanh nhã cho mọi dịp lễ.', 420000, 480000, 15, 0, 1),
(3, 2, 'Chậu Lan Hồ Điệp Hoàng Gia (5 Cành)', 'chau-lan-ho-diep-hoang-gia-5-canh', 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600&auto=format&fit=crop&q=80', 'Chậu sứ trắng tinh tế gồm 5 cành Lan Hồ Điệp tím viền hồng nhập khẩu Đài Loan, bền đẹp trên 6 tuần, tặng kèm nơ trang trí.', 1250000, 1450000, 8, 1, 1),
(4, 3, 'Bó Cẩm Tú Cầu Lam Ngọc', 'bo-cam-tu-cau-lam-ngoc', 'https://images.unsplash.com/photo-1533616688419-b7a585564566?w=600&auto=format&fit=crop&q=80', 'Cẩm tú cầu xanh biển tự nhiên phối cùng baby trắng tạo cảm giác tươi mát, yên bình, thích hợp chúc mừng sinh nhật bạn bè.', 350000, 390000, 12, 0, 1),
(5, 4, 'Bó Hướng Dương Nắng Hạ', 'bo-huong-duong-nang-ha', 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=600&auto=format&fit=crop&q=80', '5 đóa hướng dương bông lớn rực rỡ tượng trưng cho niềm tin, nghị lực và khởi đầu mới thành công rực rỡ.', 299000, 350000, 25, 1, 1),
(6, 5, 'Bó Tulip Hà Lan Pastel', 'bo-tulip-ha-lan-pastel', 'https://images.unsplash.com/photo-1520763185298-1b434c919102?w=600&auto=format&fit=crop&q=80', '10 cành Tulip hồng phấn nhập khẩu trực tiếp Hà Lan, phối giấy lụa mờ kiêu sa dành riêng cho nàng thơ.', 580000, 680000, 10, 1, 1),
(7, 1, 'Giỏ Hoa Khai Trương Phát Tài', 'gio-hoa-khai-truong-phat-tai', 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&auto=format&fit=crop&q=80', 'Giỏ hoa tone đỏ - cam - vàng kết hợp hoa hồng, đồng tiền và cúc mẫu đơn, mang tài lộc và may mắn đến doanh nghiệp.', 850000, 990000, 6, 1, 1),
(8, 6, 'Bó Hoa Baby Trắng Bồng Bềnh', 'bo-hoa-baby-trang-bong-benh', 'https://images.unsplash.com/photo-1557401584-47eca3a93bfe?w=600&auto=format&fit=crop&q=80', 'Bó hoa baby khổng lồ như đám mây bồng bềnh, giữ khô được 1-2 năm, món quà lãng mạn được giới trẻ yêu thích.', 380000, 450000, 14, 0, 1);

-- 3. MÃ GIẢM GIÁ (COUPONS)
INSERT INTO coupons (code, description, discount_percent, discount_amount, min_order_value, max_uses, used_count, is_active) VALUES
('FLOWER10', 'Giảm 10% cho đơn hàng từ 300.000đ', 10, 0, 300000, 500, 12, 1),
('GIAM50K', 'Giảm ngay 50.000đ cho đơn hàng từ 500.000đ', 0, 50000, 500000, 200, 8, 1),
('FREESHIP', 'Miễn phí giao hàng (tối đa 30.000đ)', 0, 30000, 250000, 1000, 35, 1);

-- 4. ĐÁNH GIÁ SẢN PHẨM MẪU (REVIEWS)
INSERT INTO reviews (product_id, customer_name, rating, comment) VALUES
(1, 'Minh Anh', 5, 'Hoa tươi và thơm lắm, giao đến đúng giờ hẹn. Người yêu mình rất thích!'),
(1, 'Hoàng Long', 5, 'Màu đỏ nhung rất sang trọng, shop còn tặng kèm thiệp viết tay rất nắn nót.'),
(3, 'Chị Thu Hà', 5, 'Chậu lan hồ điệp nhìn thực tế còn đẹp hơn ảnh, hoa to và cành vươn rất đẹp.'),
(5, 'Đức Thịnh', 5, 'Hoa hướng dương tươi rói để được cả tuần, giá rất hợp lý.');

