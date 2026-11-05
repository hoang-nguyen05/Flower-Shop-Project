import { Hono } from 'hono';
import { Env, CreateOrderRequest, Order, OrderItem, Product } from '../types';
import { calculateCart } from './cart';
import { getAuthenticatedUser } from './auth';

export const ordersRouter = new Hono<{ Bindings: Env }>();

// Helper tạo link VietQR thanh toán tự động
function generateVietQrUrl(env: Env, orderCode: string, amount: number): string {
  const bankId = env.VIETQR_BANK_ID || 'MB';
  const accountNo = env.VIETQR_ACCOUNT_NO || '0362843621';
  const accountName = env.VIETQR_ACCOUNT_NAME || 'NGUYEN DAC HOANG';
  const memo = encodeURIComponent(`THANHTOAN ${orderCode}`);
  const encName = encodeURIComponent(accountName);
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${memo}&accountName=${encName}`;
}

// Helper kiểm tra quyền Admin
async function checkIsAdmin(c: any): Promise<boolean> {
  const user = await getAuthenticatedUser(c);
  if (user && user.role === 'admin') return true;
  const adminKey = c.req.header('x-admin-key');
  if (adminKey && adminKey === (c.env.ADMIN_SECRET_KEY || 'admin123')) return true;
  return false;
}

// Helper che giấu thông tin cá nhân (PII Masking) cho khách vãng lai
function maskOrderPII(order: any) {
  return {
    ...order,
    customer_phone: order.customer_phone ? order.customer_phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : '',
    shipping_address: order.shipping_address ? order.shipping_address.replace(/^[^,]{3,}/, '***') : '***'
  };
}

// 1. POST /api/orders: Đặt hàng từ giỏ hàng hiện tại
ordersRouter.post('/', async (c) => {
  try {
    let sessionId = c.req.header('x-session-id');
    if (!sessionId) {
      const cookies = c.req.header('cookie') || '';
      const match = cookies.match(/cart_session=([^;]+)/);
      if (match) sessionId = match[1];
    }
    if (!sessionId) {
      return c.json({ success: false, error: 'Không tìm thấy giỏ hàng của bạn' }, 400);
    }

    const body = await c.req.json<CreateOrderRequest>();
    const { customer_name, customer_phone, customer_email, shipping_address, city, notes, payment_method } = body;

    // VALIDATION P0: Xác thực phía server theo tiêu chuẩn chống dữ liệu rác (FS-06, FS-07, FS-08)
    const cleanName = (customer_name || '').trim().replace(/<[^>]*>?/gm, '');
    const cleanPhone = (customer_phone || '').trim().replace(/\s+/g, '');
    const cleanAddress = (shipping_address || '').trim().replace(/<[^>]*>?/gm, '');
    const cleanCity = (city || '').trim().replace(/<[^>]*>?/gm, '');

    if (!cleanName || cleanName.length < 2 || cleanName.length > 70) {
      return c.json({ success: false, error: 'Họ và tên người nhận phải từ 2 đến 70 ký tự hợp lệ' }, 400);
    }
    // Chặn tên spam/vô nghĩa (chỉ toàn số hoặc ký tự lặp)
    if (/^\d+$/.test(cleanName) || /^([a-zA-Z0-9])\1{4,}$/.test(cleanName)) {
      return c.json({ success: false, error: 'Vui lòng nhập họ và tên thật của người nhận' }, 400);
    }

    // Chuẩn số điện thoại di động Việt Nam: 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09
    const vnPhoneRegex = /^(0[35789]\d{8})$/;
    if (!vnPhoneRegex.test(cleanPhone) || /^0+(\d)\1{7,}$/.test(cleanPhone)) {
      return c.json({ success: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 chữ số (VD: 0362843621, 0912345678)' }, 400);
    }

    if (!cleanAddress || cleanAddress.length < 5 || cleanAddress.length > 200) {
      return c.json({ success: false, error: 'Địa chỉ giao hàng phải từ 5 ký tự trở lên (VD: Số nhà, ngõ/đường, phường/xã)' }, 400);
    }
    if (/^\d+$/.test(cleanAddress)) {
      return c.json({ success: false, error: 'Địa chỉ giao hàng không hợp lệ, vui lòng ghi rõ tên đường/khu phố' }, 400);
    }

    if (!cleanCity || cleanCity.length < 2) {
      return c.json({ success: false, error: 'Vui lòng chọn hoặc nhập Tỉnh/Thành phố nhận hàng' }, 400);
    }

    // Lấy giỏ hàng từ Cloudflare D1 + KV (xét phân quyền Guest vs Thành viên)
    const user = await getAuthenticatedUser(c);
    const { cart } = await calculateCart(c.env.DB, c.env.KV, sessionId, user);

    if (!cart.items || cart.items.length === 0) {
      return c.json({ success: false, error: 'Giỏ hàng của bạn đang trống' }, 400);
    }

    // KIỂM TRA TỒN KHO THỰC TẾ TRƯỚC KHI TẠO ĐƠN (Chống âm kho / bán vượt số lượng)
    for (const item of cart.items) {
      const prod = await c.env.DB.prepare('SELECT id, name, stock FROM products WHERE id = ?').bind(item.productId).first<Product>();
      if (!prod || prod.stock < item.quantity) {
        return c.json({
          success: false,
          error: `Mẫu hoa "${item.name}" chỉ còn ${prod ? prod.stock : 0} bó trong kho, không đủ số lượng bạn đặt (${item.quantity} bó). Vui lòng điều chỉnh lại giỏ hàng!`
        }, 400);
      }
    }

    // Chuẩn hóa phương thức thanh toán
    const validMethods = ['cod', 'vietqr', 'bank_transfer', 'momo'];
    const chosenMethod = validMethods.includes(payment_method) ? payment_method : 'cod';

    // Tạo mã đơn hàng duy nhất
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900);
    const orderCode = `FS-${timestamp}-${random}`;

    // 1. Lưu Order vào Cloudflare D1
    const orderResult = await c.env.DB.prepare(`
      INSERT INTO orders (
        order_code, customer_name, customer_phone, customer_email,
        shipping_address, city, notes, payment_method, payment_status,
        status, subtotal, discount_amount, shipping_fee, total_amount, coupon_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).bind(
      orderCode,
      cleanName,
      cleanPhone,
      customer_email || null,
      cleanAddress,
      cleanCity,
      notes || '',
      chosenMethod,
      'unpaid',
      cart.subtotal,
      cart.discount,
      cart.shippingFee,
      cart.total,
      cart.coupon ? cart.coupon.code : null
    ).run();

    const orderId = orderResult.meta.last_row_id;

    // 2. Lưu các Order Items vào Cloudflare D1 và giảm tồn kho có điều kiện (stock >= quantity)
    for (const item of cart.items) {
      await c.env.DB.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        item.productId,
        item.name,
        item.price,
        item.quantity,
        item.image_url || null
      ).run();

      // Trừ tồn kho sản phẩm trong D1 có điều kiện bảo vệ
      await c.env.DB.prepare(`
        UPDATE products 
        SET stock = stock - ? 
        WHERE id = ? AND stock >= ?
      `).bind(item.quantity, item.productId, item.quantity).run();
    }

    // 3. Nếu có dùng coupon, tăng số lần dùng trong D1
    if (cart.coupon) {
      await c.env.DB.prepare(`
        UPDATE coupons 
        SET used_count = used_count + 1 
        WHERE code = ?
      `).bind(cart.coupon.code).run();
    }

    // 4. Xóa giỏ hàng trong Cloudflare KV
    await c.env.KV.delete(`cart:${sessionId}`);

    // Link VietQR nếu chọn chuyển khoản hoặc quét mã MoMo/VietQR
    let vietQrUrl = null;
    if (chosenMethod === 'vietqr' || chosenMethod === 'bank_transfer' || chosenMethod === 'momo') {
      vietQrUrl = generateVietQrUrl(c.env, orderCode, cart.total);
    }

    return c.json({
      success: true,
      message: 'Đặt hàng thành công!',
      orderId,
      orderCode,
      totalAmount: cart.total,
      paymentMethod: payment_method,
      vietQrUrl
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. GET /api/orders: Danh sách đơn hàng (Bảo vệ thông tin cá nhân & Phân quyền)
ordersRouter.get('/', async (c) => {
  try {
    const rawPhone = c.req.query('phone')?.trim() || '';
    const status = c.req.query('status')?.trim() || '';
    const isAdmin = await checkIsAdmin(c);

    // Nếu không phải Admin, BẮT BUỘC phải nhập chính xác số điện thoại đặt hàng 10 chữ số
    if (!isAdmin) {
      if (!rawPhone || !/^(0[35789]\d{8})$/.test(rawPhone)) {
        return c.json({
          success: false,
          error: 'Vui lòng nhập chính xác số điện thoại đặt hàng 10 chữ số (VD: 0362843621) để tra cứu đơn'
        }, 400);
      }
    }

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];

    if (rawPhone) {
      sql += ' AND customer_phone = ?';
      params.push(rawPhone);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY id DESC LIMIT 50';

    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Order>();

    // Nếu là Admin, trả về dữ liệu gốc đầy đủ; nếu là khách, che PII (Số điện thoại, địa chỉ chi tiết)
    const returnedOrders = isAdmin ? results : results.map(o => maskOrderPII(o));

    return c.json({ success: true, total: returnedOrders.length, orders: returnedOrders });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. GET /api/orders/:codeOrId: Chi tiết đơn hàng + sản phẩm bên trong
ordersRouter.get('/:codeOrId', async (c) => {
  try {
    const param = (c.req.param('codeOrId') || '').trim();
    const isAdmin = await checkIsAdmin(c);

    // Giới hạn độ dài và kiểm tra cấu trúc mã đơn / ID (FS-05)
    if (!param || param.length > 35 || /^0{5,}$/.test(param)) {
      return c.json({ success: false, error: 'Mã đơn hàng không hợp lệ' }, 400);
    }

    let order: Order | null = null;

    if (/^\d{1,8}$/.test(param)) {
      // Tra cứu theo ID số chỉ cho phép Admin (Chống duyệt vét thứ tự đơn)
      if (!isAdmin) {
        return c.json({
          success: false,
          error: 'Quý khách vui lòng tra cứu bằng mã đơn hàng (VD: FS-XXXXXX-XXX)'
        }, 403);
      }
      order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(parseInt(param, 10)).first<Order>();
    } else {
      order = await c.env.DB.prepare('SELECT * FROM orders WHERE order_code = ?').bind(param).first<Order>();
    }

    if (!order) {
      return c.json({ success: false, error: 'Không tìm thấy đơn hàng' }, 404);
    }

    // Lấy danh sách món hàng trong đơn từ D1
    const { results: items } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    ).bind(order.id).all<OrderItem>();

    let vietQrUrl = null;
    if (order.payment_method === 'vietqr' || order.payment_method === 'bank_transfer' || order.payment_method === 'momo') {
      vietQrUrl = generateVietQrUrl(c.env, order.order_code, order.total_amount);
    }

    const finalOrder = isAdmin ? order : maskOrderPII(order);

    return c.json({
      success: true,
      order: {
        ...finalOrder,
        items,
        vietQrUrl
      }
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 4. PATCH /api/orders/:id/status: Cập nhật trạng thái đơn hàng (Chỉ Admin)
ordersRouter.patch('/:id/status', async (c) => {
  try {
    const isAdmin = await checkIsAdmin(c);
    if (!isAdmin) {
      return c.json({ success: false, error: 'Chỉ Quản trị viên (Admin) mới có quyền cập nhật trạng thái đơn hàng' }, 403);
    }

    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { status, payment_status } = body;

    const allowedStatus = ['pending', 'approved', 'processing', 'shipping', 'completed', 'cancelled'];
    const allowedPayment = ['unpaid', 'paid', 'refunded'];

    if (status && !allowedStatus.includes(status)) {
      return c.json({ success: false, error: 'Trạng thái đơn hàng không hợp lệ' }, 400);
    }
    if (payment_status && !allowedPayment.includes(payment_status)) {
      return c.json({ success: false, error: 'Trạng thái thanh toán không hợp lệ' }, 400);
    }

    await c.env.DB.prepare(`
      UPDATE orders SET
        status = COALESCE(?, status),
        payment_status = COALESCE(?, payment_status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status || null, payment_status || null, id).run();

    return c.json({ success: true, message: 'Đã cập nhật trạng thái đơn hàng thành công' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

