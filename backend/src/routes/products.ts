import { Hono } from 'hono';
import { Env, Product, Category, Review } from '../types';

export const productsRouter = new Hono<{ Bindings: Env }>();

// 1. LẤY TẤT CẢ DANH MỤC
productsRouter.get('/categories', async (c) => {
  try {
    // Thử lấy từ KV cache
    const cacheKey = 'cache:categories';
    const cached = await c.env.KV.get(cacheKey, 'json');
    if (cached) {
      return c.json({ success: true, categories: cached, source: 'kv_cache' });
    }

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM categories ORDER BY name ASC'
    ).all<Category>();

    // Lưu vào Cloudflare KV với TTL 1 giờ
    await c.env.KV.put(cacheKey, JSON.stringify(results), { expirationTtl: 3600 });

    return c.json({ success: true, categories: results, source: 'd1_database' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. LẤY DANH SÁCH SẢN PHẨM (HỖ TRỢ TÌM KIẾM, LỌC DANH MỤC, NỔI BẬT, KHUYẾN MÃI, SẮP XẾP)
productsRouter.get('/products', async (c) => {
  try {
    const categorySlug = c.req.query('category');
    const search = c.req.query('q')?.trim();
    const featured = c.req.query('featured');
    const onSale = c.req.query('on_sale');
    const sort = c.req.query('sort') || 'newest';

    let sql = `
      SELECT p.*, c.name as category_name, c.slug as category_slug,
        COUNT(r.id) as reviews_count,
        COALESCE(AVG(r.rating), 5.0) as average_rating
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.available = 1
    `;
    const params: any[] = [];

    if (categorySlug) {
      sql += ` AND c.slug = ?`;
      params.push(categorySlug);
    }

    if (search) {
      sql += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (featured === '1') {
      sql += ` AND p.is_featured = 1`;
    }

    if (onSale === '1') {
      sql += ` AND p.original_price > p.price`;
    }

    sql += ` GROUP BY p.id`;

    // Sắp xếp
    if (sort === 'price_asc') {
      sql += ` ORDER BY p.price ASC`;
    } else if (sort === 'price_desc') {
      sql += ` ORDER BY p.price DESC`;
    } else if (sort === 'rating') {
      sql += ` ORDER BY average_rating DESC`;
    } else {
      sql += ` ORDER BY p.id DESC`;
    }

    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Product>();

    return c.json({
      success: true,
      total: results.length,
      products: results
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. CHI TIẾT SẢN PHẨM & ĐÁNH GIÁ
productsRouter.get('/products/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ success: false, error: 'ID sản phẩm không hợp lệ' }, 400);

    const product = await c.env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).bind(id).first<Product>();

    if (!product) {
      return c.json({ success: false, error: 'Không tìm thấy sản phẩm' }, 404);
    }

    // Lấy reviews
    const { results: reviews } = await c.env.DB.prepare(
      'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC'
    ).bind(id).all<Review>();

    // Lấy hoa tương tự (cùng danh mục)
    const { results: related } = await c.env.DB.prepare(`
      SELECT * FROM products 
      WHERE category_id = ? AND id != ? AND available = 1 
      LIMIT 4
    `).bind(product.category_id, id).all<Product>();

    return c.json({
      success: true,
      product,
      reviews,
      related
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 4. THÊM SẢN PHẨM MỚI (DÀNH CHO ADMIN)
productsRouter.post('/products', async (c) => {
  try {
    const body = await c.req.json();
    const { name, category_id, price, original_price, stock, description, image_url, is_featured } = body;

    if (!name || !category_id || !price) {
      return c.json({ success: false, error: 'Vui lòng điền đủ tên, danh mục và giá sản phẩm' }, 400);
    }

    // Tạo slug
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now();

    const result = await c.env.DB.prepare(`
      INSERT INTO products (name, slug, category_id, price, original_price, stock, description, image_url, is_featured, available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      name,
      slug,
      category_id,
      price,
      original_price || null,
      stock || 10,
      description || '',
      image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
      is_featured ? 1 : 0
    ).run();

    // Xóa cache KV
    await c.env.KV.delete('cache:products:all');

    return c.json({ success: true, message: 'Thêm sản phẩm thành công', id: result.meta.last_row_id });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 5. CẬP NHẬT SẢN PHẨM (DÀNH CHO ADMIN)
productsRouter.put('/products/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { name, category_id, price, original_price, stock, description, image_url, is_featured, available } = body;

    await c.env.DB.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        category_id = COALESCE(?, category_id),
        price = COALESCE(?, price),
        original_price = COALESCE(?, original_price),
        stock = COALESCE(?, stock),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        is_featured = COALESCE(?, is_featured),
        available = COALESCE(?, available),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      name,
      category_id,
      price,
      original_price,
      stock,
      description,
      image_url,
      is_featured,
      available,
      id
    ).run();

    await c.env.KV.delete('cache:products:all');

    return c.json({ success: true, message: 'Cập nhật sản phẩm thành công' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 6. XÓA SẢN PHẨM
productsRouter.delete('/products/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    await c.env.KV.delete('cache:products:all');
    return c.json({ success: true, message: 'Đã xóa sản phẩm thành công' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

