import { Hono } from 'hono';
import { Env, CartSessionData, CartResponse, HydratedCartItem, Product, Coupon } from '../types';

export const cartRouter = new Hono<{ Bindings: Env }>();

// Helper để lấy hoặc tạo Session ID
function getSessionId(c: any): string {
  let sessionId = c.req.header('x-session-id');
  if (!sessionId) {
    const cookies = c.req.header('cookie') || '';
    const match = cookies.match(/cart_session=([^;]+)/);
    if (match) sessionId = match[1];
  }
  if (!sessionId) {
    sessionId = 'sess_' + crypto.randomUUID();
  }
  return sessionId;
}

// Helper lấy Cart Session từ Cloudflare KV
async function getCartFromKV(kv: KVNamespace, sessionId: string): Promise<CartSessionData> {
  const data = await kv.get<CartSessionData>(`cart:${sessionId}`, 'json');
  return data || { items: [], couponCode: null, updatedAt: Date.now() };
}

// Helper lưu Cart Session vào Cloudflare KV (lưu 7 ngày)
async function saveCartToKV(kv: KVNamespace, sessionId: string, data: CartSessionData) {
  data.updatedAt = Date.now();
  await kv.put(`cart:${sessionId}`, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 7 });
}

// Helper tính toán giỏ hàng hoàn chỉnh từ Cloudflare D1 + KV
export async function calculateCart(db: D1Database, kv: KVNamespace, sessionId: string): Promise<{ cart: CartResponse; sessionId: string; sessionData: CartSessionData }> {
  const sessionData = await getCartFromKV(kv, sessionId);
  const hydratedItems: HydratedCartItem[] = [];
  let subtotal = 0;

  if (sessionData.items && sessionData.items.length > 0) {
    // Lấy thông tin các sản phẩm từ Cloudflare D1
    const productIds = sessionData.items.map(i => i.productId);
    const placeholders = productIds.map(() => '?').join(',');
    const { results: products } = await db.prepare(
      `SELECT id, name, slug, price, original_price, stock, image_url, available 
       FROM products 
       WHERE id IN (${placeholders})`
    ).bind(...productIds).all<Product>();

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of sessionData.items) {
      const prod = productMap.get(item.productId);
      if (prod && prod.available) {
        // Đảm bảo số lượng không vượt quá tồn kho
        const validQuantity = Math.min(item.quantity, prod.stock > 0 ? prod.stock : 1);
        const itemSubtotal = prod.price * validQuantity;
        subtotal += itemSubtotal;

        hydratedItems.push({
          productId: prod.id,
          name: prod.name,
          slug: prod.slug,
          image_url: prod.image_url,
          price: prod.price,
          original_price: prod.original_price,
          quantity: validQuantity,
          subtotal: itemSubtotal,
          stock: prod.stock
        });
      }
    }
  }

  // Phí giao hàng: Mặc định 30,000 VND, miễn phí với đơn từ 500,000 VND hoặc giỏ trống
  let shippingFee = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
  let discount = 0;
  let couponInfo: any = null;

  // Xử lý mã giảm giá (truy xuất từ Cloudflare D1)
  if (sessionData.couponCode && subtotal > 0) {
    const coupon = await db.prepare(
      'SELECT * FROM coupons WHERE code = ? AND is_active = 1'
    ).bind(sessionData.couponCode).first<Coupon>();

    if (coupon) {
      if (subtotal >= coupon.min_order_value) {
        if (coupon.discount_percent > 0) {
          discount = Math.round((subtotal * coupon.discount_percent) / 100);
        } else if (coupon.discount_amount > 0) {
          discount = coupon.discount_amount;
        }

        // Nếu mã FREESHIP
        if (coupon.code === 'FREESHIP') {
          shippingFee = 0;
        }

        discount = Math.min(discount, subtotal);
        couponInfo = {
          code: coupon.code,
          description: coupon.description,
          discountAmount: discount
        };
      } else {
        // Không đủ giá trị đơn tối thiểu
        sessionData.couponCode = null;
        await saveCartToKV(kv, sessionId, sessionData);
      }
    } else {
      sessionData.couponCode = null;
      await saveCartToKV(kv, sessionId, sessionData);
    }
  }

  const total = Math.max(0, subtotal - discount + shippingFee);
  const itemCount = hydratedItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    sessionId,
    sessionData,
    cart: {
      items: hydratedItems,
      itemCount,
      subtotal,
      discount,
      shippingFee,
      total,
      coupon: couponInfo
    }
  };
}

// 1. GET /api/cart: Lấy chi tiết giỏ hàng hiện tại (xử lý toàn bộ trên backend)
cartRouter.get('/', async (c) => {
  try {
    const sessionId = getSessionId(c);
    const { cart } = await calculateCart(c.env.DB, c.env.KV, sessionId);

    // Gán Cookie cart_session vào response header
    c.header('Set-Cookie', `cart_session=${sessionId}; Path=/; Max-Age=604800; SameSite=Lax`);
    c.header('x-session-id', sessionId);

    return c.json({ success: true, sessionId, cart });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. POST /api/cart/add: Thêm sản phẩm vào giỏ
cartRouter.post('/add', async (c) => {
  try {
    const sessionId = getSessionId(c);
    const body = await c.req.json();
    const productId = parseInt(body.productId, 10);
    const quantity = parseInt(body.quantity || '1', 10);

    if (isNaN(productId) || quantity <= 0) {
      return c.json({ success: false, error: 'Thông tin sản phẩm không hợp lệ' }, 400);
    }

    // Kiểm tra sản phẩm trong Cloudflare D1
    const product = await c.env.DB.prepare(
      'SELECT id, name, stock, available FROM products WHERE id = ?'
    ).bind(productId).first<Product>();

    if (!product || !product.available) {
      return c.json({ success: false, error: 'Sản phẩm không khả dụng hoặc đã hết hàng' }, 404);
    }

    const sessionData = await getCartFromKV(c.env.KV, sessionId);
    const existing = sessionData.items.find(i => i.productId === productId);

    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock);
    } else {
      sessionData.items.push({
        productId,
        quantity: Math.min(quantity, product.stock),
        addedAt: Date.now()
      });
    }

    await saveCartToKV(c.env.KV, sessionId, sessionData);
    const { cart } = await calculateCart(c.env.DB, c.env.KV, sessionId);

    c.header('Set-Cookie', `cart_session=${sessionId}; Path=/; Max-Age=604800; SameSite=Lax`);
    return c.json({ success: true, message: `Đã thêm "${product.name}" vào giỏ hàng`, cart });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. PUT /api/cart/update: Cập nhật số lượng sản phẩm
cartRouter.put('/update', async (c) => {
  try {
    const sessionId = getSessionId(c);
    const body = await c.req.json();
    const productId = parseInt(body.productId, 10);
    const quantity = parseInt(body.quantity, 10);

    const sessionData = await getCartFromKV(c.env.KV, sessionId);

    if (quantity <= 0) {
      sessionData.items = sessionData.items.filter(i => i.productId !== productId);
    } else {
      const item = sessionData.items.find(i => i.productId === productId);
      if (item) {
        // Kiểm tra tồn kho từ Cloudflare D1
        const product = await c.env.DB.prepare(
          'SELECT stock FROM products WHERE id = ?'
        ).bind(productId).first<Product>();

        item.quantity = product ? Math.min(quantity, product.stock) : quantity;
      }
    }

    await saveCartToKV(c.env.KV, sessionId, sessionData);
    const { cart } = await calculateCart(c.env.DB, c.env.KV, sessionId);

    return c.json({ success: true, cart });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 4. DELETE /api/cart/item/:productId: Xóa 1 sản phẩm khỏi giỏ
cartRouter.delete('/item/:productId', async (c) => {
  try {
    const sessionId = getSessionId(c);
    const productId = parseInt(c.req.param('productId'), 10);

    const sessionData = await getCartFromKV(c.env.KV, sessionId);
    sessionData.items = sessionData.items.filter(i => i.productId !== productId);

    await saveCartToKV(c.env.KV, sessionId, sessionData);
    const { cart } = await calculateCart(c.env.DB, c.env.KV, sessionId);

    return c.json({ success: true, message: 'Đã xóa sản phẩm khỏi giỏ', cart });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 5. DELETE /api/cart: Xóa toàn bộ giỏ hàng
cartRouter.delete('/', async (c) => {
  try {
    const sessionId = getSessionId(c);
    await c.env.KV.delete(`cart:${sessionId}`);
    return c.json({
      success: true,
      message: 'Đã dọn sạch giỏ hàng',
      cart: { items: [], itemCount: 0, subtotal: 0, discount: 0, shippingFee: 0, total: 0 }
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 6. POST /api/cart/coupon: Áp dụng mã giảm giá
cartRouter.post('/coupon', async (c) => {
  try {
    const sessionId = getSessionId(c);
    const body = await c.req.json();
    const code = (body.code || '').trim().toUpperCase();

    if (!code) {
      return c.json({ success: false, error: 'Vui lòng nhập mã giảm giá' }, 400);
    }

    // Kiểm tra mã trong Cloudflare D1
    const coupon = await c.env.DB.prepare(
      'SELECT * FROM coupons WHERE code = ? AND is_active = 1'
    ).bind(code).first<Coupon>();

    if (!coupon) {
      return c.json({ success: false, error: 'Mã giảm giá không tồn tại hoặc đã hết hiệu lực' }, 404);
    }

    const sessionData = await getCartFromKV(c.env.KV, sessionId);
    sessionData.couponCode = code;
    await saveCartToKV(c.env.KV, sessionId, sessionData);

    const { cart } = await calculateCart(c.env.DB, c.env.KV, sessionId);

    if (!cart.coupon) {
      return c.json({
        success: false,
        error: `Đơn hàng chưa đạt mức tối thiểu ${coupon.min_order_value.toLocaleString('vi-VN')}đ để áp dụng mã này`
      }, 400);
    }

    return c.json({ success: true, message: `Áp dụng thành công mã ${code}`, cart });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 7. DELETE /api/cart/coupon: Hủy mã giảm giá
cartRouter.delete('/coupon', async (c) => {
  try {
    const sessionId = getSessionId(c);
    const sessionData = await getCartFromKV(c.env.KV, sessionId);
    sessionData.couponCode = null;
    await saveCartToKV(c.env.KV, sessionId, sessionData);

    const { cart } = await calculateCart(c.env.DB, c.env.KV, sessionId);
    return c.json({ success: true, message: 'Đã hủy mã giảm giá', cart });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

