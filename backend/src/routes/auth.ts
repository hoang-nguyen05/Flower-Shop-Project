import { Hono } from 'hono';
import { Env, User, UserSession } from '../types';

export const authRouter = new Hono<{ Bindings: Env }>();

const PASSWORD_SALT = 'FLOWER_SHOP_SALT_2026';

// Hàm băm mật khẩu bảo mật sử dụng Web Crypto API có sẵn trong Cloudflare Workers
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + PASSWORD_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hàm lấy User từ Auth Token qua Cloudflare KV & D1
export async function getAuthenticatedUser(c: any): Promise<UserSession | null> {
  const authHeader = c.req.header('Authorization') || c.req.header('x-auth-token');
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  // 1. Kiểm tra session trong Cloudflare KV
  try {
    const cached = await c.env.KV.get(`auth_session:${token}`);
    if (cached) {
      return JSON.parse(cached) as UserSession;
    }
  } catch (err) {
    console.error('Lỗi đọc auth_session từ KV:', err);
  }

  return null;
}

// ==========================================
// 1. ĐĂNG KÝ THÀNH VIÊN MỚI
// ==========================================
authRouter.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { username, email, password, full_name, phone, address, city } = body;

    if (!username || !email || !password || !full_name) {
      return c.json({ success: false, error: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)' }, 400);
    }

    if (password.length < 6) {
      return c.json({ success: false, error: 'Mật khẩu phải chứa ít nhất 6 ký tự' }, 400);
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Kiểm tra trùng username hoặc email trong D1
    const existing = await c.env.DB.prepare(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ?'
    ).bind(cleanUsername, cleanEmail).first();

    if (existing) {
      if ((existing as any).username === cleanUsername) {
        return c.json({ success: false, error: 'Tên đăng nhập này đã được sử dụng!' }, 400);
      }
      return c.json({ success: false, error: 'Email này đã được đăng ký tài khoản!' }, 400);
    }

    // Băm mật khẩu
    const passwordHash = await hashPassword(password);
    const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    // Lưu vào Cloudflare D1
    const result = await c.env.DB.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, phone, address, city, role, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'customer', ?)
    `).bind(
      cleanUsername,
      cleanEmail,
      passwordHash,
      full_name.trim(),
      phone ? phone.trim() : '',
      address ? address.trim() : '',
      city ? city.trim() : 'Hà Nội',
      defaultAvatar
    ).run();

    const newUserId = Number(result.meta.last_row_id);

    // Tạo phiên làm việc trong Cloudflare KV (hạn 7 ngày)
    const token = crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2);
    const userSession: UserSession = {
      id: newUserId,
      username: cleanUsername,
      email: cleanEmail,
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      city: city ? city.trim() : 'Hà Nội',
      role: 'customer',
      avatar_url: defaultAvatar,
      token,
      createdAt: Date.now()
    };

    await c.env.KV.put(`auth_session:${token}`, JSON.stringify(userSession), {
      expirationTtl: 86400 * 7 // 7 ngày
    });

    return c.json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Chào mừng bạn đến với FlowerShop 🌸',
      token,
      user: userSession
    });
  } catch (error: any) {
    return c.json({ success: false, error: 'Lỗi đăng ký: ' + error.message }, 500);
  }
});

// ==========================================
// 2. ĐĂNG NHẬP
// ==========================================
authRouter.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ success: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu!' }, 400);
    }

    const cleanInput = username.trim().toLowerCase();
    const passwordHash = await hashPassword(password);

    // Tìm user theo username hoặc email trong D1
    const user = await c.env.DB.prepare(`
      SELECT id, username, email, password_hash, full_name, phone, address, city, role, avatar_url
      FROM users
      WHERE (username = ? OR email = ?) AND password_hash = ?
    `).bind(cleanInput, cleanInput, passwordHash).first<User>();

    if (!user) {
      return c.json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' }, 401);
    }

    // Tạo Token lưu vào Cloudflare KV
    const token = crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2);
    const userSession: UserSession = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone || '',
      address: user.address || '',
      city: user.city || 'Hà Nội',
      role: user.role,
      avatar_url: user.avatar_url,
      token,
      createdAt: Date.now()
    };

    await c.env.KV.put(`auth_session:${token}`, JSON.stringify(userSession), {
      expirationTtl: 86400 * 7 // 7 ngày
    });

    return c.json({
      success: true,
      message: `Đăng nhập thành công! Xin chào ${user.full_name} 🌸`,
      token,
      user: userSession
    });
  } catch (error: any) {
    return c.json({ success: false, error: 'Lỗi đăng nhập: ' + error.message }, 500);
  }
});

// ==========================================
// 3. LẤY THÔNG TIN HỒ SƠ HIỆN TẠI (ME)
// ==========================================
authRouter.get('/me', async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ success: false, error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ!' }, 401);
    }

    // Cập nhật thống kê số đơn hàng & yêu thích từ D1
    const orderCountResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM orders WHERE customer_phone = ? OR customer_email = ?'
    ).bind(user.phone || '', user.email || '').first();

    const wishlistCountResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?'
    ).bind(user.id).first();

    return c.json({
      success: true,
      user: {
        ...user,
        orders_count: (orderCountResult as any)?.count || 0,
        wishlist_count: (wishlistCountResult as any)?.count || 0
      }
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==========================================
// 4. CẬP NHẬT THÔNG TIN HỒ SƠ
// ==========================================
authRouter.put('/profile', async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ success: false, error: 'Bạn cần đăng nhập để thực hiện!' }, 401);
    }

    const body = await c.req.json();
    const { full_name, phone, address, city, avatar_url } = body;

    if (!full_name) {
      return c.json({ success: false, error: 'Họ và tên không được để trống!' }, 400);
    }

    // Cập nhật vào Cloudflare D1
    await c.env.DB.prepare(`
      UPDATE users
      SET full_name = ?, phone = ?, address = ?, city = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      full_name.trim(),
      phone ? phone.trim() : user.phone,
      address ? address.trim() : user.address,
      city ? city.trim() : user.city,
      avatar_url || user.avatar_url,
      user.id
    ).run();

    // Cập nhật lại session trong Cloudflare KV
    const updatedSession: UserSession = {
      ...user,
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : user.phone,
      address: address ? address.trim() : user.address,
      city: city ? city.trim() : user.city,
      avatar_url: avatar_url || user.avatar_url
    };

    await c.env.KV.put(`auth_session:${user.token}`, JSON.stringify(updatedSession), {
      expirationTtl: 86400 * 7
    });

    return c.json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công!',
      user: updatedSession
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==========================================
// 5. ĐỔI MẬT KHẨU
// ==========================================
authRouter.put('/password', async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ success: false, error: 'Bạn cần đăng nhập để đổi mật khẩu!' }, 401);
    }

    const body = await c.req.json();
    const { old_password, new_password } = body;

    if (!old_password || !new_password) {
      return c.json({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới!' }, 400);
    }

    if (new_password.length < 6) {
      return c.json({ success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự!' }, 400);
    }

    // Kiểm tra mật khẩu cũ trong D1
    const oldHash = await hashPassword(old_password);
    const dbUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ? AND password_hash = ?'
    ).bind(user.id, oldHash).first();

    if (!dbUser) {
      return c.json({ success: false, error: 'Mật khẩu hiện tại không đúng!' }, 400);
    }

    // Lưu mật khẩu mới
    const newHash = await hashPassword(new_password);
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(newHash, user.id).run();

    return c.json({
      success: true,
      message: 'Đổi mật khẩu thành công!'
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==========================================
// 6. ĐĂNG XUẤT
// ==========================================
authRouter.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || c.req.header('x-auth-token');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      await c.env.KV.delete(`auth_session:${token}`);
    }
    return c.json({ success: true, message: 'Đã đăng xuất thành công!' });
  } catch (error: any) {
    return c.json({ success: true });
  }
});

// ==========================================
// 7. LẤY DANH SÁCH ĐƠN HÀNG CỦA TÔI
// ==========================================
authRouter.get('/my-orders', async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ success: false, error: 'Vui lòng đăng nhập để xem đơn hàng!' }, 401);
    }

    const { results } = await c.env.DB.prepare(`
      SELECT o.id, o.order_code, o.customer_name, o.customer_phone, o.customer_email,
             o.shipping_address, o.city, o.notes, o.payment_method, o.payment_status,
             o.status, o.total_amount, o.created_at
      FROM orders o
      WHERE o.customer_phone = ? OR o.customer_email = ?
      ORDER BY o.id DESC
      LIMIT 50
    `).bind(user.phone || 'NONE', user.email || 'NONE').all();

    return c.json({
      success: true,
      orders: results
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==========================================
// 8. LẤY & THÊM/BỚT HOA YÊU THÍCH (WISHLIST)
// ==========================================
authRouter.get('/wishlist', async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ success: false, error: 'Vui lòng đăng nhập!' }, 401);
    }

    const { results } = await c.env.DB.prepare(`
      SELECT p.id, p.name, p.slug, p.image_url, p.price, p.original_price, p.stock,
             c.name as category_name
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE w.user_id = ?
      ORDER BY w.id DESC
    `).bind(user.id).all();

    return c.json({
      success: true,
      items: results
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

authRouter.post('/wishlist/toggle', async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ success: false, error: 'Vui lòng đăng nhập để thêm hoa yêu thích!' }, 401);
    }

    const body = await c.req.json();
    const productId = Number(body.productId);

    if (!productId) {
      return c.json({ success: false, error: 'Mã hoa không hợp lệ!' }, 400);
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?'
    ).bind(user.id, productId).first();

    if (existing) {
      await c.env.DB.prepare(
        'DELETE FROM wishlists WHERE user_id = ? AND product_id = ?'
      ).bind(user.id, productId).run();

      return c.json({ success: true, is_favorited: false, message: 'Đã bỏ yêu thích hoa' });
    } else {
      await c.env.DB.prepare(
        'INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)'
      ).bind(user.id, productId).run();

      return c.json({ success: true, is_favorited: true, message: 'Đã thêm vào danh sách hoa yêu thích ❤️' });
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

