import { Hono } from 'hono';
import { Env } from '../types';

export const storageRouter = new Hono<{ Bindings: Env }>();

// Chuyển ArrayBuffer sang Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Chuyển Base64 sang Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// 1. POST /api/storage/upload: Tải ảnh từ máy tính/điện thoại người dùng lên Cloudflare R2 / KV
storageRouter.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ success: false, error: 'Vui lòng chọn tệp hình ảnh từ thiết bị của bạn!' }, 400);
    }

    // Làm sạch tên tệp
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const key = `uploads/${timestamp}_${cleanFileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'image/jpeg';

    let storageUsed = 'R2';

    // 1. Nếu có R2, lưu vào Cloudflare R2 Object Storage
    if (c.env.R2) {
      try {
        await c.env.R2.put(key, arrayBuffer, {
          httpMetadata: { contentType },
          customMetadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString()
          }
        });
      } catch (r2Err: any) {
        console.warn('Lỗi R2, chuyển sang Cloudflare KV:', r2Err.message);
        storageUsed = 'KV';
      }
    } else {
      storageUsed = 'KV';
    }

    // 2. Dự phòng: Lưu vào Cloudflare KV để ảnh luôn hiển thị được ngay lập tức
    if (storageUsed === 'KV' || !c.env.R2) {
      const base64Data = arrayBufferToBase64(arrayBuffer);
      await c.env.KV.put(`kv_file:${key}`, JSON.stringify({
        data: base64Data,
        contentType,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString()
      }), {
        expirationTtl: 86400 * 30 // 30 ngày
      });
    }

    const fileUrl = `/api/storage/files/${key}`;

    return c.json({
      success: true,
      message: `Tải ảnh lên thành công (Lưu trữ qua Cloudflare ${storageUsed})! 🌸`,
      key,
      url: fileUrl,
      size: file.size,
      type: contentType
    });
  } catch (error: any) {
    return c.json({ success: false, error: 'Lỗi tải ảnh: ' + error.message }, 500);
  }
});

// 2. GET /api/storage/files/*: Truy xuất và hiển thị ảnh / tài liệu (hỗ trợ cả R2 & KV)
storageRouter.get('/files/*', async (c) => {
  try {
    const url = new URL(c.req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/api\/storage\/files\//, ''));

    if (!key) {
      return c.text('Thiếu tên tệp', 400);
    }

    // A. Kiểm tra từ Cloudflare R2 trước
    if (c.env.R2) {
      try {
        const object = await c.env.R2.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new Response(object.body, { headers });
        }
      } catch (e) {}
    }

    // B. Kiểm tra từ Cloudflare KV
    const kvData = await c.env.KV.get(`kv_file:${key}`);
    if (kvData) {
      const fileMeta = JSON.parse(kvData);
      const bytes = base64ToUint8Array(fileMeta.data);

      return new Response(bytes, {
        headers: {
          'Content-Type': fileMeta.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    return c.text('Không tìm thấy tệp ảnh trên máy chủ', 404);
  } catch (error: any) {
    return c.text(`Lỗi truy xuất ảnh: ${error.message}`, 500);
  }
});

// 3. GET /api/storage/list: Danh sách tệp đã lưu (hỗ trợ cả R2 & KV)
storageRouter.get('/list', async (c) => {
  try {
    const files: any[] = [];

    // Lấy từ R2 nếu có
    if (c.env.R2) {
      try {
        const prefix = c.req.query('prefix') || 'uploads/';
        const listing = await c.env.R2.list({ prefix, limit: 50 });
        listing.objects.forEach(obj => {
          files.push({
            key: obj.key,
            size: obj.size,
            uploadedAt: obj.uploaded,
            url: `/api/storage/files/${obj.key}`,
            source: 'R2'
          });
        });
      } catch (e) {}
    }

    // Lấy từ KV
    try {
      const kvList = await c.env.KV.list({ prefix: 'kv_file:uploads/', limit: 50 });
      for (const item of kvList.keys) {
        const realKey = item.name.replace(/^kv_file:/, '');
        if (!files.some(f => f.key === realKey)) {
          files.push({
            key: realKey,
            size: 0,
            uploadedAt: new Date().toISOString(),
            url: `/api/storage/files/${realKey}`,
            source: 'KV'
          });
        }
      }
    } catch (e) {}

    return c.json({
      success: true,
      total: files.length,
      files
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});
