// ========================================================
// FlowerShop - API Client & Utility Functions
// ========================================================

const API_BASE = '/api';

// Lấy hoặc khởi tạo Session ID cho giỏ hàng
function getSessionId() {
  let sessionId = localStorage.getItem('flower_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('flower_session_id', sessionId);
  }
  return sessionId;
}

// Wrapper cho hàm fetch với tự động gửi Header Session
async function apiRequest(endpoint, options = {}) {
  const sessionId = getSessionId();
  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
    ...(options.headers || {})
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    // Nếu backend trả về sessionId mới thì cập nhật
    const newSession = res.headers.get('x-session-id');
    if (newSession && newSession !== sessionId) {
      localStorage.setItem('flower_session_id', newSession);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`Lỗi API [${endpoint}]:`, err);
    return { success: false, error: err.message || 'Lỗi kết nối máy chủ' };
  }
}

// Định dạng tiền tệ VND
function formatVND(amount) {
  if (amount === undefined || amount === null) return '0₫';
  return Number(amount).toLocaleString('vi-VN') + '₫';
}

// Hiển thị thông báo Toast
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container-custom';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-custom';
  
  let icon = 'fa-check-circle text-success';
  if (type === 'error') {
    icon = 'fa-exclamation-circle text-danger';
    toast.style.borderLeftColor = '#e11d48';
  } else if (type === 'warning') {
    icon = 'fa-info-circle text-warning';
    toast.style.borderLeftColor = '#f59e0b';
  }

  toast.innerHTML = `
    <i class="fas ${icon} fs-5"></i>
    <div class="flex-grow-1 font-weight-600">${message}</div>
    <button type="button" class="btn-close ms-2 small" onclick="this.parentElement.remove()"></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

