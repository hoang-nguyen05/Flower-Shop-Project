// ========================================================
// FlowerShop - API Client, Auth & Utility Functions
// ========================================================

const API_BASE = '/api';

// 1. Quản lý Session ID cho Giỏ Hàng
function getSessionId() {
  let sessionId = localStorage.getItem('flower_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('flower_session_id', sessionId);
  }
  return sessionId;
}

// 2. Quản lý Auth Token & Người Dùng Đăng Nhập
function getAuthToken() {
  return localStorage.getItem('flower_auth_token') || '';
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('flower_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user) {
  localStorage.setItem('flower_auth_token', token);
  localStorage.setItem('flower_auth_user', JSON.stringify(user));
  window.dispatchEvent(new Event('authChange'));
}

function clearAuthSession() {
  localStorage.removeItem('flower_auth_token');
  localStorage.removeItem('flower_auth_user');
  window.dispatchEvent(new Event('authChange'));
}

// Hàm Đăng xuất
async function logoutUser() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (e) {}
  clearAuthSession();
  showToast('Đã đăng xuất tài khoản thành công!');
  setTimeout(() => {
    window.location.href = '/index.html';
  }, 500);
}

// 3. Wrapper cho hàm fetch với tự động gửi Header Session & Auth Token
async function apiRequest(endpoint, options = {}) {
  const sessionId = getSessionId();
  const authToken = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
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

// 4. Định dạng tiền tệ VND
function formatVND(amount) {
  if (amount === undefined || amount === null) return '0₫';
  return Number(amount).toLocaleString('vi-VN') + '₫';
}

// 5. Hiển thị thông báo Toast
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

// 6. Tự động hiển thị Menu Người Dùng / Đăng Nhập trên Navbar
function renderUserNav() {
  const container = document.getElementById('user-nav-container');
  if (!container) return;

  const user = getCurrentUser();

  if (user) {
    // Đã đăng nhập
    const displayName = user.full_name || user.username;
    const avatar = user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
    const isAdmin = user.role === 'admin';

    container.innerHTML = `
      <div class="dropdown">
        <a class="nav-link dropdown-toggle d-flex align-items-center py-1 px-2 rounded-pill bg-light border text-dark fw-bold" 
           href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <img src="${avatar}" alt="${displayName}" class="rounded-circle me-2 border border-danger" style="width: 28px; height: 28px; object-fit: cover;">
          <span class="small d-none d-md-inline me-1 text-truncate" style="max-width: 120px;">${displayName}</span>
          ${isAdmin ? '<span class="badge bg-danger ms-1" style="font-size: 0.65rem;">Admin</span>' : ''}
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-4 py-2 mt-2" style="min-width: 210px;">
          <li class="px-3 py-2 border-bottom mb-1">
            <div class="fw-bold text-dark small text-truncate">${displayName}</div>
            <div class="text-muted" style="font-size: 0.72rem;">@${user.username} • ${isAdmin ? 'Quản trị viên' : 'Thành viên'}</div>
          </li>
          <li>
            <a class="dropdown-item py-2 small" href="/profile.html">
              <i class="fas fa-user-circle me-2 text-primary"></i>Hồ sơ cá nhân
            </a>
          </li>
          <li>
            <a class="dropdown-item py-2 small" href="/orders.html">
              <i class="fas fa-receipt me-2 text-success"></i>Đơn hàng của tôi
            </a>
          </li>
          <li>
            <a class="dropdown-item py-2 small" href="/wishlist.html">
              <i class="fas fa-heart me-2 text-danger"></i>Hoa yêu thích
            </a>
          </li>
          ${isAdmin ? `
            <li><hr class="dropdown-divider"></li>
            <li>
              <a class="dropdown-item py-2 small fw-bold text-danger bg-danger-subtle" href="/admin.html">
                <i class="fas fa-cog me-2"></i>Trang Quản Trị Admin
              </a>
            </li>
          ` : ''}
          <li><hr class="dropdown-divider"></li>
          <li>
            <a class="dropdown-item py-2 small text-danger" href="javascript:void(0)" onclick="logoutUser()">
              <i class="fas fa-sign-out-alt me-2"></i>Đăng xuất
            </a>
          </li>
        </ul>
      </div>
    `;
  } else {
    // Chưa đăng nhập
    container.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <a href="/login.html" class="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold">
          <i class="fas fa-sign-in-alt me-1"></i>Đăng nhập
        </a>
        <a href="/register.html" class="btn btn-danger btn-sm rounded-pill px-3 fw-bold d-none d-sm-inline-block">
          <i class="fas fa-user-plus me-1"></i>Đăng ký
        </a>
      </div>
    `;
  }

  // Cập nhật nút tài khoản trên thanh Bottom Nav di động nếu có
  const mobileUserBtn = document.getElementById('mobile-nav-user');
  if (mobileUserBtn) {
    if (user) {
      mobileUserBtn.href = '/profile.html';
      mobileUserBtn.innerHTML = `
        <i class="fas fa-user-check"></i>
        <span>Tôi</span>
      `;
    } else {
      mobileUserBtn.href = '/login.html';
      mobileUserBtn.innerHTML = `
        <i class="fas fa-user"></i>
        <span>Đăng nhập</span>
      `;
    }
  }
}

// Khởi tạo renderUserNav khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  renderUserNav();
  window.addEventListener('authChange', renderUserNav);
});
