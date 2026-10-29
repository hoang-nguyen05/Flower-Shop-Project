import { Hono } from 'hono';
import { Env, Product, Category } from '../types';

export const chatbotRouter = new Hono<{ Bindings: Env }>();

// 1. POST /api/chatbot: Trợ lý AI tư vấn hoa tươi dùng Google Gemini API (Hỗ trợ đa Key xoay vòng)
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
        reply: 'Chào bạn! Mình là Florist AI từ FlowerShop 🌸. Bạn đang tìm hoa cho dịp đặc biệt nào (Sinh nhật, Tình yêu, Khai trương, Kỷ niệm)?'
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

    const systemPrompt = `Bạn là "Florist AI" - chuyên viên tư vấn hoa tươi thông minh, duyên dáng, tận tình và chuyên nghiệp của tiệm hoa trực tuyến FlowerShop.
Nhiệm vụ của bạn:
1. Tư vấn các loài hoa ý nghĩa phù hợp với dịp của khách (Sinh nhật, Tình yêu/Tỏ tình, Khai trương, Chúc mừng, Kỷ niệm, Cảm ơn, Ngày Phụ nữ 8/3, 20/10, v.v.).
2. Giới thiệu các bó hoa/giỏ hoa có thật trong danh sách hoa của shop dưới đây kèm theo giá tiền chính xác.
3. Nhắc khách áp dụng các mã giảm giá nếu đơn hàng phù hợp.
4. Trả lời bằng tiếng Việt thân thiện, súc tích, định dạng gạch đầu dòng rõ ràng, dùng emoji hoa lá 🌸🌹💐 tươi tắn.

Dữ liệu shop hiện tại:
${productContext}
`;

    // 2. Nếu có danh sách API Key thì gọi Google Gemini API với cơ chế xoay vòng & dự phòng lỗi
    if (apiKeys.length > 0) {
      // Các mô hình thử lần lượt (Gemini 3.8 / 2.5 / 1.5)
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
                  provider: `Google Gemini (${modelName}) - Key #${i + 1}`
                });
              }
            } else {
              const errBody = await geminiResponse.text();
              console.warn(`Lỗi Gemini [${modelName}] với Key #${i + 1}: ${geminiResponse.status} - ${errBody.substring(0, 150)}`);
              // Nếu 404 (model không tìm thấy), thử model tiếp theo trong vòng lặp model
              if (geminiResponse.status === 404) continue;
              // Nếu 429 hoặc 403, thoát ra thử Key tiếp theo
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
    const lower = userMessage.toLowerCase();

    if (lower.includes('sinh nhật') || lower.includes('sn')) {
      fallbackReply = '🌸 **Gợi ý hoa Sinh Nhật rực rỡ từ FlowerShop:**\n- **Bó Hoa Hồng Đỏ Tình Nồng** (499.000đ): Lãng mạn, ngọt ngào cho người yêu.\n- **Bó Hướng Dương Nắng Hạ** (299.000đ): Mang lại năng lượng vui vẻ, may mắn cho bạn bè/đồng nghiệp.\n- **Bó Tulip Hà Lan Pastel** (580.000đ): Sang trọng, tinh tế cho phái nữ.\n\n🎁 Nhập mã **FLOWER10** để được giảm thêm 10% bạn nhé!';
    } else if (lower.includes('khai trương') || lower.includes('tân gia') || lower.includes('chúc mừng')) {
      fallbackReply = '💐 **Gợi ý hoa Khai Trương - May Mắn & Phát Tài:**\n- **Chậu Lan Hồ Điệp Hoàng Gia 5 Cành** (1.250.000đ): Vương giả, bền đẹp trên 6 tuần.\n- **Giỏ Hoa Khai Trương Phát Tài** (850.000đ): Tông màu đỏ cam phát tài phát lộc.\n\n🚚 Đơn hàng được **miễn phí giao hoa tận nơi** và tặng kèm banner/thiệp chúc mừng in logo công ty!';
    } else if (lower.includes('giá') || lower.includes('bao nhiêu') || lower.includes('bảng giá')) {
      fallbackReply = '💰 **Bảng giá các mẫu hoa bán chạy nhất hôm nay:**\n- Hướng Dương Nắng Hạ: **299.000đ**\n- Cẩm Tú Cầu Lam Ngọc: **350.000đ**\n- Bó Hoa Baby Trắng: **380.000đ**\n- Bó Hồng Đỏ Tình Nồng: **499.000đ**\n- Bó Tulip Hà Lan: **580.000đ**\n- Chậu Lan Hồ Điệp: **1.250.000đ**\n\nBạn muốn chọn mẫu nào để mình thêm vào giỏ hàng giúp bạn nhé?';
    } else if (lower.includes('mã') || lower.includes('khuyến mãi') || lower.includes('coupon') || lower.includes('voucher')) {
      fallbackReply = '🎟️ **Mã giảm giá đang áp dụng tại FlowerShop:**\n- `FLOWER10`: Giảm 10% cho đơn từ 300.000đ\n- `GIAM50K`: Giảm 50.000đ cho đơn từ 500.000đ\n- `FREESHIP`: Miễn phí vận chuyển toàn quốc\n\nBạn có thể nhập mã này ngay tại trang Giỏ hàng để nhận ưu đãi!';
    } else {
      fallbackReply = `Dạ chào bạn! FlowerShop rất vui được hỗ trợ bạn 🌸. Tiệm có đầy đủ hoa tươi Đà Lạt và hoa nhập khẩu cao cấp (Hoa Hồng, Lan Hồ Điệp, Tulip, Hướng Dương, Cẩm Tú Cầu).\n\n💡 Bạn có thể hỏi mình: *"Tư vấn hoa tặng sinh nhật người yêu"*, *"Hoa khai trương sang trọng"*, hoặc *"Bảng giá hoa hôm nay"*.`;
    }

    return c.json({
      success: true,
      reply: fallbackReply,
      provider: 'Florist AI Engine (FlowerShop)'
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});
