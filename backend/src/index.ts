import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { productsRouter } from './routes/products';
import { cartRouter } from './routes/cart';
import { ordersRouter } from './routes/orders';
import { chatbotRouter } from './routes/chatbot';
import { storageRouter } from './routes/storage';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';

const app = new Hono<{ Bindings: Env }>();

// 1. CORS Middleware để frontend gọi API trơn tru
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-auth-token', 'x-admin-key'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Set-Cookie', 'x-session-id']
}));

// 2. Healthcheck & Thông tin hệ thống Cloudflare
app.get('/api/health', async (c) => {
  let d1Status = 'ok';
  let kvStatus = 'ok';
  let r2Status = 'ok';
  let vectorizeStatus = 'disabled';
  let workersAiStatus = 'disabled';

  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch (err: any) {
    d1Status = 'error: ' + err.message;
  }

  try {
    await c.env.KV.get('test_ping');
  } catch (err: any) {
    kvStatus = 'error: ' + err.message;
  }

  try {
    if (c.env.R2) {
      await c.env.R2.list({ limit: 1 });
    } else {
      r2Status = 'optional (chưa bật)';
    }
  } catch (err: any) {
    r2Status = 'error: ' + err.message;
  }

  if (c.env.VECTORIZE) {
    vectorizeStatus = 'ok (flower-shop-index 1024-dim cosine)';
  }

  if (c.env.AI) {
    workersAiStatus = 'ok (@cf/baai/bge-m3 + Gemma 26B / Llama 3.1)';
  }

  return c.json({
    ok: true,
    service: 'flower-shop-ai',
    appName: c.env.APP_NAME || 'FlowerShop Cloudflare AI',
    runtime: 'Hono.js on Cloudflare Edge',
    vectorize_enabled: Boolean(c.env.VECTORIZE),
    workers_ai_enabled: Boolean(c.env.AI),
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      cloudflare_d1: d1Status,
      cloudflare_kv: kvStatus,
      cloudflare_vectorize: vectorizeStatus,
      cloudflare_workers_ai: workersAiStatus,
      cloudflare_r2: r2Status,
      gemini_fallback_configured: Boolean(c.env.GEMINI_API_KEY)
    }
  });
});


app.all('/api/sync-vectors', async (c) => {
  const startTime = Date.now();
  if (!c.env.AI || !c.env.VECTORIZE) {
    return c.json({
      ok: false,
      error: 'Cloudflare Workers AI hoặc Vectorize chưa được gắn kết trong Worker bindings.'
    }, 500);
  }

  try {
    // 1. Lấy toàn bộ sản phẩm từ D1
    const productsRes = await c.env.DB.prepare(`
      SELECT p.id, p.name, p.price, p.description, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `).all<any>();
    const products = productsRes.results || [];

    // 2. Lấy toàn bộ chính sách từ D1
    const policiesRes = await c.env.DB.prepare(`
      SELECT id, title, slug, content FROM policies
    `).all<any>();
    const policies = policiesRes.results || [];

    const vectorsToUpsert: any[] = [];

    // 3. Tạo Embeddings cho Sản Phẩm bằng @cf/baai/bge-m3
    if (products.length > 0) {
      const productTexts = products.map(p => 
        `Sản phẩm: ${p.name}. Danh mục: ${p.category_name || 'Hoa tươi'}. Giá: ${p.price} VNĐ. Mô tả: ${p.description || ''}`
      );
      
      const prodEmbeddings: any = await c.env.AI.run('@cf/baai/bge-m3', {
        text: productTexts
      });

      if (prodEmbeddings && Array.isArray(prodEmbeddings.data)) {
        for (let i = 0; i < products.length; i++) {
          const p = products[i];
          const vec = prodEmbeddings.data[i];
          if (vec) {
            vectorsToUpsert.push({
              id: `product-${p.id}`,
              values: vec,
              metadata: {
                type: 'product',
                id: p.id,
                name: p.name,
                price: p.price,
                category: p.category_name || 'Hoa tươi'
              }
            });
          }
        }
      }
    }

    // 4. Tạo Embeddings cho Chính Sách bằng @cf/baai/bge-m3
    if (policies.length > 0) {
      const policyTexts = policies.map(pol => 
        `Chính sách: ${pol.title}. Nội dung: ${pol.content}`
      );

      const polEmbeddings: any = await c.env.AI.run('@cf/baai/bge-m3', {
        text: policyTexts
      });

      if (polEmbeddings && Array.isArray(polEmbeddings.data)) {
        for (let i = 0; i < policies.length; i++) {
          const pol = policies[i];
          const vec = polEmbeddings.data[i];
          if (vec) {
            vectorsToUpsert.push({
              id: `policy-${pol.id}`,
              values: vec,
              metadata: {
                type: 'policy',
                id: pol.id,
                title: pol.title,
                slug: pol.slug
              }
            });
          }
        }
      }
    }

    // 5. Lưu vào Cloudflare Vectorize Index
    if (vectorsToUpsert.length > 0) {
      await c.env.VECTORIZE.upsert(vectorsToUpsert);
    }

    return c.json({
      ok: true,
      message: 'Đã đồng bộ dữ liệu vào Cloudflare Vectorize thành công!',
      total_indexed: vectorsToUpsert.length,
      products_count: products.length,
      policies_count: policies.length,
      embedding_model: '@cf/baai/bge-m3',
      index_name: 'flower-shop-index',
      dimensions: 1024,
      latencyMs: Date.now() - startTime
    });
  } catch (err: any) {
    return c.json({
      ok: false,
      error: 'Lỗi khi đồng bộ Vectorize: ' + err.message
    }, 500);
  }
});

// 3. Mount các router API Backend
app.route('/api', productsRouter);
app.route('/api/cart', cartRouter);
app.route('/api/orders', ordersRouter);
app.route('/api/chatbot', chatbotRouter);
app.route('/api/storage', storageRouter);
app.route('/api/admin', adminRouter);
app.route('/api/auth', authRouter);

// 4. Fallback cho Static Frontend Assets
// Khi truy cập /, /index.html, /css/style.css, v.v., Hono tự động chuyển tiếp sang Cloudflare Assets
app.all('*', async (c) => {
  const url = new URL(c.req.url);

  // Nếu là API không tồn tại thì báo lỗi JSON
  if (url.pathname.startsWith('/api/')) {
    return c.json({ success: false, error: `API endpoint '${url.pathname}' không tồn tại` }, 404);
  }

  // Chuyển cho Cloudflare Static Assets
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text('Cloudflare Worker FlowerShop API đang chạy.', 200);
});

export default app;

