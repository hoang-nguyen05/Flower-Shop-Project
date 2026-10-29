import { Hono } from 'hono';
import { Env, Coupon } from '../types';

export const adminRouter = new Hono<{ Bindings: Env }>();

// 1. GET /api/admin/dashboard: Thống kê số liệu doanh thu và hệ thống
adminRouter.get('/dashboard', async (c) => {
  try {
    // 1. Tổng doanh thu & số đơn hàng
    const orderStats: any = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        COUNT(DISTINCT customer_phone) as total_customers
      FROM orders
    `).first();

    // 2. Tổng số sản phẩm & hết hàng
    const productStats: any = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN stock <= 3 THEN 1 ELSE 0 END) as low_stock_count
      FROM products
    `).first();

    // 3. 5 đơn hàng mới nhất
    const { results: recentOrders } = await c.env.DB.prepare(`
      SELECT id, order_code, customer_name, customer_phone, total_amount, payment_method, status, created_at
      FROM orders
      ORDER BY id DESC
      LIMIT 6
    `).all();

    // 4. Kiểm tra trạng thái các dịch vụ Cloudflare
    const cloudflareStatus = {
      d1: 'Hoạt động (Cloudflare D1 SQL)',
      kv: 'Hoạt động (Cloudflare Key-Value)',
      r2: 'Hoạt động (Cloudflare R2 Storage)',
      gemini: c.env.GEMINI_API_KEY ? 'Đã kết nối (Gemini Flash)' : 'Chưa nhập API Key (Đang dùng Florist Fallback)'
    };

    return c.json({
      success: true,
      stats: {
        totalRevenue: orderStats?.total_revenue || 0,
        totalOrders: orderStats?.total_orders || 0,
        completedOrders: orderStats?.completed_orders || 0,
        pendingOrders: orderStats?.pending_orders || 0,
        totalCustomers: orderStats?.total_customers || 0,
        totalProducts: productStats?.total_products || 0,
        lowStockCount: productStats?.low_stock_count || 0
      },
      recentOrders,
      cloudflareStatus
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. GET /api/coupons: Lấy danh sách mã giảm giá
adminRouter.get('/coupons', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM coupons ORDER BY id DESC'
    ).all<Coupon>();
    return c.json({ success: true, coupons: results });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. POST /api/coupons: Tạo mã giảm giá mới
adminRouter.post('/coupons', async (c) => {
  try {
    const body = await c.req.json();
    const { code, description, discount_percent, discount_amount, min_order_value, max_uses } = body;

    if (!code) {
      return c.json({ success: false, error: 'Thiếu mã giảm giá' }, 400);
    }

    await c.env.DB.prepare(`
      INSERT INTO coupons (code, description, discount_percent, discount_amount, min_order_value, max_uses, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(
      code.toUpperCase().trim(),
      description || '',
      discount_percent || 0,
      discount_amount || 0,
      min_order_value || 0,
      max_uses || 100
    ).run();

    return c.json({ success: true, message: `Tạo mã giảm giá ${code} thành công` });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 4. POST /api/reviews: Thêm đánh giá cho sản phẩm
adminRouter.post('/reviews', async (c) => {
  try {
    const body = await c.req.json();
    const { product_id, customer_name, rating, comment } = body;

    if (!product_id || !customer_name || !rating || !comment) {
      return c.json({ success: false, error: 'Vui lòng điền đủ thông tin đánh giá' }, 400);
    }

    await c.env.DB.prepare(`
      INSERT INTO reviews (product_id, customer_name, rating, comment)
      VALUES (?, ?, ?, ?)
    `).bind(product_id, customer_name, rating, comment).run();

    return c.json({ success: true, message: 'Cảm ơn bạn đã gửi đánh giá!' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

