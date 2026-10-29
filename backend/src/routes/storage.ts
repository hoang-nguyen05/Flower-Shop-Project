import { Hono } from 'hono';
import { Env } from '../types';

export const storageRouter = new Hono<{ Bindings: Env }>();

// 1. POST /api/storage/upload: Tải ảnh hoặc tài liệu lên Cloudflare R2
storageRouter.post('/upload', async (c) => {
  try {
    if (!c.env.R2) {
      return c.json({
        success: false,
        error: 'Cloudflare R2 chưa được bật trên tài khoản Cloudflare. Vui lòng vào Cloudflare Dashboard bấm "Enable R2" để sử dụng.'
      }, 503);
    }
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ success: false, error: 'Vui lòng chọn tệp tải lên' }, 400);
    }

    // Làm sạch tên tệp
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const key = `uploads/${timestamp}_${cleanFileName}`;

    // Lưu vào Cloudflare R2
    await c.env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });

    const fileUrl = `/api/storage/files/${key}`;

    return c.json({
      success: true,
      message: 'Tải tệp lên Cloudflare R2 thành công!',
      key,
      url: fileUrl,
      size: file.size,
      type: file.type
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. GET /api/storage/files/:key: Truy xuất và hiển thị ảnh / tài liệu từ Cloudflare R2
storageRouter.get('/files/*', async (c) => {
  try {
    if (!c.env.R2) return c.text('Cloudflare R2 chưa được bật', 503);
    // Lấy key sau '/files/'
    const url = new URL(c.req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/api\/storage\/files\//, ''));

    if (!key) {
      return c.text('Thiếu tên tệp', 400);
    }

    const object = await c.env.R2.get(key);

    if (!object) {
      return c.text('Không tìm thấy tệp trong R2', 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (error: any) {
    return c.text(`Lỗi R2: ${error.message}`, 500);
  }
});

// 3. GET /api/storage/list: Danh sách tệp đã lưu trong Cloudflare R2 (dành cho Admin)
storageRouter.get('/list', async (c) => {
  try {
    if (!c.env.R2) {
      return c.json({ success: true, total: 0, files: [] });
    }
    const prefix = c.req.query('prefix') || 'uploads/';
    const listing = await c.env.R2.list({ prefix, limit: 50 });

    const files = listing.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      uploadedAt: obj.uploaded,
      url: `/api/storage/files/${obj.key}`,
      etag: obj.httpEtag
    }));

    return c.json({
      success: true,
      total: files.length,
      files
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 4. DELETE /api/storage/files/*: Xóa tệp khỏi Cloudflare R2
storageRouter.delete('/files/*', async (c) => {
  try {
    const url = new URL(c.req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/api\/storage\/files\//, ''));

    if (!key) {
      return c.json({ success: false, error: 'Thiếu key' }, 400);
    }

    await c.env.R2.delete(key);
    return c.json({ success: true, message: `Đã xóa tệp "${key}" khỏi Cloudflare R2` });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

