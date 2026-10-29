import { Hono } from 'hono';
import { Env, Product, Category } from '../types';

export const chatbotRouter = new Hono<{ Bindings: Env }>();

// 1. POST /api/chatbot: Trợ lý AI hỗ trợ khách hàng & tính năng website (Không bao gồm quản trị Admin)
chatbotRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const userMessage = (body.message || '').trim();
    const clientApiKey = body.apiKey || c.req.header('x-gemini-key');
    const rawApiKey = clientApiKey || c.env.GEMINI_API_KEY || '';

    // Tách các API key nếu truyền nhiều key phân cách bằng dấu phẩy
    const apiKeys = rawApiKey
      .split(',')
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 5 && k !== 'YOUR_GEMINI_API_KEY_HERE');

    if (!userMessage) {
      return c.json({
        success: true,
        reply: 'Chào bạn! Mình là Florist AI từ FlowerShop 🌸. Mình có thể giúp bạn chọn hoa tươi đẹp, tư vấn ý nghĩa các loài hoa hoặc hướng dẫn bạn đặt hàng, áp mã giảm giá và thanh toán trên web nhé!'
      });
    }

    // Kiểm tra nếu người dùng hỏi về quản trị Admin hoặc can thiệp dữ liệu nội bộ
    const lowerMsg = userMessage.toLowerCase();
    if (
      lowerMsg.includes('admin') ||
      lowerMsg.includes('quản trị') ||
      lowerMsg.includes('doanh thu shop') ||
      lowerMsg.includes('xóa sản phẩm') ||
      lowerMsg.includes('sửa sản phẩm') ||
      lowerMsg.includes('mật khẩu admin') ||
      lowerMsg.includes('database') ||
      lowerMsg.includes('cơ sở dữ liệu')
    ) {
      return c.json({
        success: true,
        reply: '🌸 Dạ xin lỗi bạn, mình là Trợ lý AI hỗ trợ khách hàng mua sắm hoa tươi trên website. Mình không phụ trách và không có quyền truy cập vào khu vực quản trị viên (Admin). Nếu bạn là ban quản lý hoặc đối tác, vui lòng liên hệ trực tiếp qua hotline **1900 8888** hoặc email quản lý shop nhé!',
        provider: 'FlowerShop AI Customer Care'
      });
    }

    // 1. Lấy danh sách sản phẩm & danh mục từ Cloudflare D1 để làm ngữ cảnh thực tế cho Gemini
    let productContext = '';
    try {
      const { results: products } = await c.env.DB.prepare(
        'SELECT name, price, stock, description FROM products WHERE available = 1 LIMIT 15'
      ).all<Product>();

      const { results: categories } = await c.env.DB.prepare(
        'SELECT name FROM categories'
      ).all<Category>();

      const catList = categories.map(c => c.name).join(', ');
      const prodList = products.map(p => `- ${p.name}: ${p.price.toLocaleString('vi-VN')}đ (còn ${p.stock} bó) - ${p.description || ''}`).join('\n');

      productContext = `
Danh mục hoa hiện có: ${catList}
Bảng giá hoa tươi hiện có tại shop:
${prodList}

Ưu đãi đang có:
- Mã FLOWER10: Giảm 10% đơn từ 300.000đ
- Mã GIAM50K: Giảm 50.000đ đơn từ 500.000đ
- Mã FREESHIP: Miễn phí giao hàng đơn từ 250.000đ
- Miễn phí giao hàng toàn quốc cho đơn từ 500.000đ
- Tặng kèm thiệp chúc mừng viết tay cao cấp và gói quà theo yêu cầu.
`;
    } catch (dbErr) {
      console.error('Lỗi lấy context D1 cho chatbot:', dbErr);
    }

    const systemPrompt = `Bạn là "Florist AI" - trợ lý ảo trực tuyến của website bán hoa tươi FlowerShop.
PHẠM VI HỖ TRỢ CỦA BẠN (DÀNH CHO KHÁCH HÀNG):
1. GIỚI THIỆU HOA & Ý NGHĨA:
   - Tư vấn chọn mẫu hoa phù hợp từng dịp: Sinh nhật, Tỏ tình, Khai trương, Tân gia, Kỷ niệm, Chúc mừng, Tốt nghiệp, v.v.
   - Báo giá chính xác các mẫu hoa có thật tại FlowerShop dựa vào bảng giá bên dưới.
2. HƯỚNG DẪN TÍNH NĂNG TRÊN WEBSITE:
   - Cách chọn hoa và thêm vào Giỏ hàng.
   - Cách nhập mã giảm giá tại trang Giỏ hàng (FLOWER10, GIAM50K, FREESHIP).
   - Cách đặt hàng và phương thức thanh toán: Thanh toán khi nhận hàng (COD), quét mã VietQR tự động qua ứng dụng ngân hàng.
   - Cách tra cứu đơn hàng: Bấm vào mục "Tra cứu đơn" trên thanh menu, nhập số điện thoại hoặc mã đơn để theo dõi trạng thái.
   - Chính sách giao hàng: Giao hỏa tốc 2 giờ, cam kết 100% hoa tươi nhập mới trong ngày, đổi trả miễn phí trong 24h nếu hoa dập nát.
3. QUY ĐỊNH BẢO MẬT & NHẬN DIỆN THƯƠNG HIỆU:
   - Bạn là 'Florist AI' - Trợ lý tư vấn chọn hoa trực tuyến của FlowerShop.
   - TUYỆT ĐỐI KHÔNG tự xưng là Gemini, Google AI, hay bất kỳ mô hình AI nào khác. Nếu được hỏi bạn là ai hay dùng công nghệ gì, chỉ trả lời ngắn gọn: "Mình là Florist AI - Trợ lý tư vấn chọn hoa tươi độc quyền của FlowerShop 🌸".
   - BẠN TUYỆT ĐỐI KHÔNG hỗ trợ các chức năng quản trị Admin (quản lý doanh thu, sửa/xóa sản phẩm, truy cập database nội bộ).
   - Trả lời bằng tiếng Việt lịch sự, thân thiện, súc tích, định dạng gạch đầu dòng rõ ràng, kèm emoji hoa lá 🌸🌹💐 tươi tắn.

Dữ liệu shop hiện tại:
${productContext}
`;

    // 2. Nếu có danh sách API Key thì gọi Google Gemini API với cơ chế xoay vòng & dự phòng lỗi
    if (apiKeys.length > 0) {
      const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

      for (let i = 0; i < apiKeys.length; i++) {
        const activeKey = apiKeys[i];

        for (const modelName of candidateModels) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const geminiResponse = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: `${systemPrompt}\n\nKhách hàng hỏi: "${userMessage}"` }
                    ]
                  }
                ],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 600,
                }
              })
            });

            clearTimeout(timeoutId);

            if (geminiResponse.ok) {
              const geminiData: any = await geminiResponse.json();
              const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

              if (replyText) {
                return c.json({
                  success: true,
                  reply: replyText.trim(),
                  provider: 'Florist AI'
                });
              }
            } else {
              if (geminiResponse.status === 404) continue;
              break;
            }
          } catch (fetchErr: any) {
            console.warn(`Exception khi gọi Gemini [${modelName}] với Key #${i + 1}:`, fetchErr.message);
          }
        }
      }
    }

    // 3. Fallback tư vấn thông minh (khi API key lỗi hoặc mạng chậm)
    let fallbackReply = '';

    if (lowerMsg.includes('sinh nhật') || lowerMsg.includes('sn')) {
      fallbackReply = '🌸 **Gợi ý hoa Sinh Nhật rực rỡ từ FlowerShop:**\n- **Bó Hoa Hồng Đỏ Tình Nồng** (499.000đ): Lãng mạn, ngọt ngào cho người yêu.\n- **Bó Hướng Dương Nắng Hạ** (299.000đ): Mang lại năng lượng vui vẻ, may mắn cho bạn bè/đồng nghiệp.\n- **Bó Tulip Hà Lan Pastel** (580.000đ): Sang trọng, tinh tế cho phái nữ.\n\n🎁 Nhập mã **FLOWER10** tại giỏ hàng để được giảm thêm 10% bạn nhé!';
    } else if (lowerMsg.includes('khai trương') || lowerMsg.includes('tân gia') || lowerMsg.includes('chúc mừng')) {
      fallbackReply = '💐 **Gợi ý hoa Khai Trương - May Mắn & Phát Tài:**\n- **Chậu Lan Hồ Điệp Hoàng Gia 5 Cành** (1.250.000đ): Vương giả, sang trọng, bền trên 6 tuần.\n- **Giỏ Hoa Khai Trương Phát Tài** (850.000đ): Tông đỏ cam phát tài phát lộc.\n\n🚚 Đơn hàng trên 500.000đ được **miễn phí giao hàng tận nơi** và tặng kèm thiệp chúc mừng viết tay!';
    } else if (lowerMsg.includes('đặt hàng') || lowerMsg.includes('mua hoa') || lowerMsg.includes('cách đặt')) {
      fallbackReply = '🛒 **Cách đặt hoa dễ dàng trên website FlowerShop:**\n1. Chọn mẫu hoa ưng ý tại trang **Cửa hàng**.\n2. Bấm **"Thêm Vào Giỏ"** hoặc **"Mua Ngay"**.\n3. Vào giỏ hàng, nhập mã giảm giá (như `FLOWER10`, `FREESHIP`).\n4. Điền tên người nhận, địa chỉ và chọn phương thức thanh toán (**VietQR** hoặc **COD**).\n5. Bấm **"Xác Nhận Đặt Hoa"** là hoàn tất!';
    } else if (lowerMsg.includes('thanh toán') || lowerMsg.includes('vietqr') || lowerMsg.includes('chuyển khoản')) {
      fallbackReply = '💳 **Các phương thức thanh toán tiện lợi tại shop:**\n- **Quét mã VietQR**: Khi đặt hàng, hệ thống tự động tạo mã QR có sẵn số tiền và nội dung đơn. Bạn chỉ cần mở app ngân hàng quét mã là xong!\n- **Thanh toán khi nhận hoa (COD)**: Nhận hoa tươi, kiểm tra đúng mẫu mới thanh toán tiền mặt cho shipper.\n- **Ví MoMo**: Tiện lợi và an toàn.';
    } else if (lowerMsg.includes('tra cứu') || lowerMsg.includes('kiểm tra đơn') || lowerMsg.includes('vận chuyển') || lowerMsg.includes('giao hàng')) {
      fallbackReply = '🚚 **Chính sách giao hàng & Tra cứu đơn:**\n- **Giao hoa hỏa tốc**: Cam kết giao tận nơi trong vòng 2 giờ tại nội thành.\n- **Tra cứu đơn hàng**: Bạn bấm vào mục **"Tra cứu đơn"** trên menu trên cùng, nhập số điện thoại hoặc mã đơn (VD: `FS-XXXXXX`) để xem tiến độ đơn hàng nhé!';
    } else if (lowerMsg.includes('giá') || lowerMsg.includes('bao nhiêu') || lowerMsg.includes('bảng giá')) {
      fallbackReply = '💰 **Bảng giá các mẫu hoa bán chạy nhất hôm nay:**\n- Hướng Dương Nắng Hạ: **299.000đ**\n- Cẩm Tú Cầu Lam Ngọc: **350.000đ**\n- Bó Hoa Baby Trắng: **380.000đ**\n- Bó Hồng Đỏ Tình Nồng: **499.000đ**\n- Bó Tulip Hà Lan: **580.000đ**\n- Chậu Lan Hồ Điệp: **1.250.000đ**\n\nBạn muốn chọn mẫu nào để mình tư vấn chi tiết hơn nhé?';
    } else if (lowerMsg.includes('mã') || lowerMsg.includes('khuyến mãi') || lowerMsg.includes('coupon') || lowerMsg.includes('voucher')) {
      fallbackReply = '🎟️ **Mã giảm giá đang áp dụng tại FlowerShop:**\n- `FLOWER10`: Giảm 10% cho đơn từ 300.000đ\n- `GIAM50K`: Giảm 50.000đ cho đơn từ 500.000đ\n- `FREESHIP`: Miễn phí vận chuyển toàn quốc\n\nBạn có thể nhập mã này ngay tại trang Giỏ hàng để nhận ưu đãi!';
    } else {
      fallbackReply = `Dạ chào bạn! FlowerShop rất vui được hỗ trợ bạn 🌸. Mình có thể giúp bạn:\n- **Tư vấn hoa tươi** theo dịp (sinh nhật, tình yêu, khai trương, tốt nghiệp...)\n- **Báo giá & ưu đãi** đang có tại tiệm\n- **Hướng dẫn đặt hoa**, thanh toán VietQR và tra cứu đơn hàng\n\nBạn cần hỗ trợ điều gì cứ nhắn cho mình nhé!`;
    }

    return c.json({
      success: true,
      reply: fallbackReply,
      provider: 'Florist AI Customer Care (FlowerShop)'
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});
