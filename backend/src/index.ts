import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { productsRouter } from './routes/products';
import { cartRouter } from './routes/cart';
import { ordersRouter } from './routes/orders';
import { chatbotRouter } from './routes/chatbot';
import { storageRouter } from './routes/storage';
import { adminRouter } from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

// 1. CORS Middleware để frontend gọi API trơn tru
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-gemini-key'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Set-Cookie', 'x-session-id']
}));

// 2. Healthcheck & Thông tin hệ thống Cloudflare
app.get('/api/health', async (c) => {
  let d1Status = 'ok';
  let kvStatus = 'ok';
  let r2Status = 'ok';

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

  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    appName: c.env.APP_NAME || 'FlowerShop Cloudflare',
    services: {
      cloudflare_d1: d1Status,
      cloudflare_kv: kvStatus,
      cloudflare_r2: r2Status,
      ai_assistant_configured: Boolean(c.env.GEMINI_API_KEY)
    }
  });
});

// 3. Mount các router API Backend
app.route('/api', productsRouter);
app.route('/api/cart', cartRouter);
app.route('/api/orders', ordersRouter);
app.route('/api/chatbot', chatbotRouter);
app.route('/api/storage', storageRouter);
app.route('/api/admin', adminRouter);

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

