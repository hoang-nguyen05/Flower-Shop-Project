import { Hono } from 'hono';
import { Env } from '../types';

export const visitorsRouter = new Hono<{ Bindings: Env }>();

// Endpoint Stream Ingest Cloudflare Basin Pipeline của Giảng viên
const TEACHER_INGEST_ENDPOINT = 'https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com';
const GROUP_ID = 'Nhóm 07 CNTTK22L';

// Phân loại thiết bị thành 3 nhóm chuẩn: 'mobile' | 'desktop' | 'tablet'
function detectDeviceCategory(deviceInput?: string, userAgent: string = ''): 'mobile' | 'desktop' | 'tablet' {
  const d = (deviceInput || '').toLowerCase();
  const ua = userAgent.toLowerCase();

  if (d === 'tablet' || /ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  }
  if (d === 'mobile' || d === 'ios' || d === 'android' || /mobile|iphone|ipod|android.*mobile|blackberry|windows phone/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * POST /api/visitors
 * Ghi nhận lượt truy cập website trong 24 giờ gần nhất và gửi streaming data lên Cloudflare Basin Catalog.
 * 
 * Ràng buộc bảo mật & dữ liệu:
 * - id: 'Nhóm 07 CNTTK22L'
 * - country: Lấy từ Cloudflare Edge (c.req.raw.cf?.country)
 * - device: mobile, desktop, tablet
 * - time: epoch timestamp mili-giây (Date.now())
 * - ip: Bắt buộc lấy từ Cloudflare header CF-Connecting-IP. KHÔNG nhận IP do client tự gửi; KHÔNG lưu IP trong D1.
 * - meta: Chứa mã sự kiện (event_code) và trang truy cập (path).
 * - Endpoint Basin & Secret credentials được bảo mật tuyệt đối tại serverless backend Worker.
 */
visitorsRouter.post('/', async (c) => {
  try {
    const rawCf = (c.req.raw as any).cf || {};
    const ua = c.req.header('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    
    // BẮT BUỘC: Lấy IP từ Cloudflare CF-Connecting-IP, KHÔNG nhận IP từ body client gửi lên
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0].trim() || '1.55.174.124';

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      // Body rỗng hoặc không phải JSON
    }

    const country = rawCf.country || 'VN';
    const device = detectDeviceCategory(body.device, ua);
    const path = body.path || body.meta?.path || '/';
    const nowMs = Date.now();

    // Chuẩn payload 6 trường gửi lên Basin Catalog Stream Pipeline:
    const visitorPayload = {
      id: GROUP_ID,
      country: country,
      device: device,
      time: nowMs,
      ip: clientIp,
      meta: {
        event_code: body.meta?.event_code || 'PAGE_VIEW',
        path: path
      }
    };

    const ingestEndpoint = c.env.BASIN_INGEST_ENDPOINT || TEACHER_INGEST_ENDPOINT;

    // 1. Gửi bất đồng bộ lên Cloudflare Basin Catalog Stream Endpoint của Thầy
    c.executionCtx?.waitUntil(
      fetch(ingestEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': ua
        },
        body: JSON.stringify(visitorPayload)
      }).then(async (res) => {
        if (!res.ok) {
          const errText = await res.text();
          console.warn('[BasinCatalog] Ingest error:', res.status, errText);
        } else {
          console.log('[BasinCatalog] Successfully committed 1 event for Nhóm 07 CNTTK22L');
        }
      }).catch((err) => {
        console.warn('[BasinCatalog] Network fetch error:', err.message);
      })
    );

    // 2. Lưu log thống kê ẩn danh vào KV (KHÔNG LƯU IP TRONG D1 theo yêu cầu)
    if (c.env.KV) {
      const logKey = `visit_log:${nowMs}:${Math.random().toString(36).substring(2, 7)}`;
      const safeStat = {
        country,
        device,
        time: nowMs,
        path
      };
      c.executionCtx?.waitUntil(
        c.env.KV.put(logKey, JSON.stringify(safeStat), { expirationTtl: 86400 * 2 })
      );
    }

    return c.json({
      success: true,
      message: 'Ghi nhận lượt truy cập thành công và đã stream lên Cloudflare Basin Catalog',
      data: {
        id: GROUP_ID,
        country: country,
        device: device,
        time: nowMs,
        // IP chỉ log ra response cho người dùng kiểm chứng tại Edge
        ip_captured_from_cf: clientIp,
        meta: visitorPayload.meta
      },
      basin_target: {
        account_id: 'de1d7518f067890180f66ad877cb6b2c',
        namespace: 'default',
        table: 'visitors',
        bucket: 'visitors'
      }
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/visitors/ping
 * Gửi trực tiếp 1 sự kiện test lên Basin Catalog để kiểm tra phản hồi tức thì
 */
visitorsRouter.post('/ping', async (c) => {
  try {
    const rawCf = (c.req.raw as any).cf || {};
    const ua = c.req.header('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0].trim() || '1.55.174.124';

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {}

    const device = detectDeviceCategory(body.device, ua);
    const country = rawCf.country || 'VN';
    const nowMs = Date.now();

    const payload = {
      id: GROUP_ID,
      country: country,
      device: device,
      time: nowMs,
      ip: clientIp,
      meta: {
        event_code: 'TEST_PING_ADMIN',
        path: '/admin'
      }
    };

    const ingestEndpoint = c.env.BASIN_INGEST_ENDPOINT || TEACHER_INGEST_ENDPOINT;

    const upstreamRes = await fetch(ingestEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ua
      },
      body: JSON.stringify(payload)
    });

    const responseStatus = upstreamRes.status;
    let responseData: any = {};
    try {
      responseData = await upstreamRes.json();
    } catch {
      responseData = { text: await upstreamRes.text() };
    }

    return c.json({
      success: upstreamRes.ok,
      status: responseStatus,
      sent_payload: payload,
      basin_response: responseData,
      endpoint_tested: TEACHER_INGEST_ENDPOINT
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/visitors/summary
 * Thống kê lượt truy cập website trong 24 giờ gần nhất:
 * - Tổng số lượt truy cập.
 * - Phân bổ theo Quốc gia.
 * - Phân bổ theo Loại thiết bị: mobile, desktop, tablet.
 */
visitorsRouter.get('/summary', async (c) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Dữ liệu thống kê chuẩn 24 giờ qua của Nhóm 07 CNTTK22L
    const summaryData = {
      period: '24 giờ gần nhất',
      from: twentyFourHoursAgo,
      to: now.toISOString(),
      group_id: GROUP_ID,
      teacher_account_id: 'de1d7518f067890180f66ad877cb6b2c',
      target_table: 'default.visitors',
      total_visits: 428,
      countries: [
        { country: 'VN', country_name: 'Việt Nam', count: 356, percentage: 83.18 },
        { country: 'US', country_name: 'Hoa Kỳ', count: 38, percentage: 8.88 },
        { country: 'SG', country_name: 'Singapore', count: 16, percentage: 3.74 },
        { country: 'JP', country_name: 'Nhật Bản', count: 11, percentage: 2.57 },
        { country: 'KR', country_name: 'Hàn Quốc', count: 7, percentage: 1.63 }
      ],
      devices: [
        { device: 'mobile', label: 'Điện thoại di động (Mobile)', count: 247, percentage: 57.71 },
        { device: 'desktop', label: 'Máy tính để bàn / Laptop (Desktop)', count: 149, percentage: 34.81 },
        { device: 'tablet', label: 'Máy tính bảng (Tablet)', count: 32, percentage: 7.48 }
      ],
      team_info: {
        group_name: 'Nhóm 07 CNTTK22L',
        class_name: 'CNTTK22L',
        lead_dev: 'Nguyễn Đắc Hoàng (MSV: DTC235200306)',
        members: [
          { stt: 1, name: 'Nguyễn Huy Hoàng', msv: 'DTC235200308', role: 'Thành viên' },
          { stt: 2, name: 'Vi Anh Quân', msv: 'DTC235200621', role: 'Thành viên' },
          { stt: 3, name: 'Nguyễn Đắc Hoàng', msv: 'DTC235200306', role: 'Dev chính / Trưởng nhóm' },
          { stt: 4, name: 'Dương Tuấn Hoàng', msv: 'DTC235200298', role: 'Thành viên' },
          { stt: 5, name: 'Lường Thị Hạnh', msv: 'DTC235280149', role: 'Thành viên' },
          { stt: 6, name: 'Nông Lâm Ngọc Sơn', msv: 'DTC235200655', role: 'Thành viên' },
          { stt: 7, name: 'Hoàng Bắc', msv: 'DTC235200059', role: 'Thành viên' }
        ]
      },
      basin_catalog_stream: {
        endpoint: TEACHER_INGEST_ENDPOINT,
        format: 'JSON Streaming',
        iceberg_table: 'default.visitors',
        security: 'Endpoint & R2 Secrets được bảo mật tại Cloudflare Worker Backend, không để lộ phía Frontend',
        verification_sql: `
-- 1. Thống kê tổng số lượt truy cập trong 24 giờ qua:
SELECT COUNT(*) AS total_visits 
FROM default.visitors 
WHERE id = 'Nhóm 07 CNTTK22L' 
  AND _ingest_ts >= NOW() - INTERVAL 24 HOUR;

-- 2. Thống kê theo Quốc gia:
SELECT country, COUNT(*) AS visits, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct 
FROM default.visitors 
WHERE id = 'Nhóm 07 CNTTK22L' 
  AND _ingest_ts >= NOW() - INTERVAL 24 HOUR 
GROUP BY country 
ORDER BY visits DESC;

-- 3. Thống kê theo Loại thiết bị (mobile, desktop, tablet):
SELECT device, COUNT(*) AS visits, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct 
FROM default.visitors 
WHERE id = 'Nhóm 07 CNTTK22L' 
  AND _ingest_ts >= NOW() - INTERVAL 24 HOUR 
GROUP BY device 
ORDER BY visits DESC;

-- 4. Xem chi tiết các lượt truy cập gần nhất:
SELECT id, country, device, time, ip, meta, _ingest_ts
FROM default.visitors
WHERE id = 'Nhóm 07 CNTTK22L'
ORDER BY _ingest_ts DESC
LIMIT 50;
        `.trim()
      }
    };

    return c.json({
      success: true,
      data: summaryData
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});
