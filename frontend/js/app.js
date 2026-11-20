// ========================================================
// FlowerShop - Global Application Helpers
// ========================================================

// 1. Quản lý Yêu thích (Wishlist) Độc Lập Theo Từng Tài Khoản (Per-User & Guest)
function getWishlistStorageKey() {
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  return user && user.id ? `flower_wishlist_user_${user.id}` : 'flower_wishlist_guest';
}

function getWishlist() {
  try {
    const key = getWishlistStorageKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(Number) : [];
  } catch (e) {
    return [];
  }
}

function isProductWishlisted(productId) {
  const list = getWishlist();
  return list.includes(Number(productId));
}

async function toggleWishlist(productId, btn) {
  // Bảo vệ: Bắt buộc đăng nhập theo yêu cầu người dùng
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (!user) {
    showToast('Vui lòng đăng nhập để lưu hoa vào danh sách yêu thích của bạn!', 'warning');
    setTimeout(() => {
      const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login.html?redirect=${redirectUrl}`;
    }, 800);
    return;
  }

  productId = Number(productId);
  const key = getWishlistStorageKey();
  let list = getWishlist();
  const index = list.indexOf(productId);
  let isAdded = false;

  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(productId);
    isAdded = true;
  }

  localStorage.setItem(key, JSON.stringify(list));

  // Cập nhật tất cả các nút có cùng data-wishlist-id trên trang
  const matchingBtns = document.querySelectorAll(`[data-wishlist-id="${productId}"]`);
  matchingBtns.forEach(b => {
    const icon = b.querySelector('i');
    if (icon) {
      icon.className = isAdded ? 'fas fa-heart text-danger' : 'far fa-heart';
    }
  });

  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isAdded ? 'fas fa-heart text-danger' : 'far fa-heart';
    }
  }

  updateWishlistBadge();

  // Đồng bộ lên database Cloudflare D1 nếu người dùng đã đăng nhập
  const token = (typeof getAuthToken === 'function') ? getAuthToken() : null;
  if (token) {
    try {
      await apiRequest('/auth/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ productId })
      });
    } catch (err) {
      console.warn('Lỗi đồng bộ wishlist lên D1:', err);
    }
  }

  showToast(isAdded ? 'Đã thêm hoa vào danh sách yêu thích ❤️' : 'Đã bỏ yêu thích', isAdded ? 'success' : 'warning');
}

function updateWishlistBadge() {
  const count = getWishlist().length;
  const badges = document.querySelectorAll('.wishlist-badge-count');
  badges.forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
}

// Đồng bộ danh sách yêu thích từ Server khi tải trang hoặc khi đổi nick
async function syncWishlistWithServer() {
  const token = (typeof getAuthToken === 'function') ? getAuthToken() : null;
  if (!token) {
    updateWishlistBadge();
    return;
  }

  try {
    const res = await apiRequest('/auth/wishlist');
    if (res.success && Array.isArray(res.items)) {
      const serverIds = res.items.map(i => Number(i.id));
      const key = getWishlistStorageKey();
      localStorage.setItem(key, JSON.stringify(serverIds));
      updateWishlistBadge();

      // Cập nhật lại màu tim trên các thẻ hoa đang hiển thị
      serverIds.forEach(id => {
        const btns = document.querySelectorAll(`[data-wishlist-id="${id}"]`);
        btns.forEach(b => {
          const icon = b.querySelector('i');
          if (icon) icon.className = 'fas fa-heart text-danger';
        });
      });
    }
  } catch (err) {
    updateWishlistBadge();
  }
}

// Lắng nghe sự kiện đổi nick (login, logout) để chuyển wishlist tương ứng ngay lập tức
window.addEventListener('authChange', () => {
  syncWishlistWithServer();
  updateWishlistBadge();
});

// 2. Tải danh mục vào Navbar
async function loadNavCategories() {
  const res = await apiRequest('/categories');
  const dropdown = document.getElementById('nav-categories-dropdown');
  if (res.success && res.categories && dropdown) {
    dropdown.innerHTML = res.categories.map(c => `
      <li><a class="dropdown-item" href="/products.html?category=${c.slug}"><i class="fas fa-feather-alt text-danger me-2"></i>${c.name}</a></li>
    `).join('') + `
      <li><hr class="dropdown-divider"></li>
      <li><a class="dropdown-item text-danger fw-bold" href="/products.html?on_sale=1"><i class="fas fa-tag me-2"></i>Khuyến Mãi Hôm Nay</a></li>
    `;
  }
}

// 3. Khởi tạo chung
document.addEventListener('DOMContentLoaded', () => {
  updateWishlistBadge();
  syncWishlistWithServer();
  loadNavCategories();

  // Xử lý form tìm kiếm ở Header
  const searchForm = document.getElementById('global-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = document.getElementById('global-search-input')?.value.trim();
      if (query) {
        window.location.href = `/products.html?q=${encodeURIComponent(query)}`;
      }
    });
  }
});

// 4. Xử lý đăng ký nhận ưu đãi (Newsletter)
function handleNewsletter(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('newsletter-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  showToast('🎉 Đăng ký thành công! Mã ưu đãi FLOWER10 (giảm 10%) đã được kích hoạt.');
  localStorage.setItem('applied_coupon', 'FLOWER10');
  input.value = '';
}




// 5. Tự động ghi nhận lượt truy cập và đẩy lên Cloudflare Basin Catalog (Nhóm 07 CNTTK22L)
(function trackBasinVisitor() {
  try {
    const sessionKey = 'fs_visited_session';
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, Date.now().toString());
      const ua = (navigator.userAgent || '').toLowerCase();
      let device = 'desktop';
      if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
        device = 'tablet';
      } else if (/mobile|iphone|ipod|android/i.test(ua)) {
        device = 'mobile';
      }

      fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: device,
          path: window.location.pathname || '/',
          meta: {
            event_code: 'PAGE_VIEW',
            path: window.location.pathname || '/'
          }
        })
      }).catch(function() {});
    }
  } catch (e) {}
})();

// 6. Cloudflare Web Analytics Official Beacon Snippet (Token: e79a77d6e38c449eb5da54da33edb008)
(function initCloudflareWebAnalytics() {
  try {
    if (!document.querySelector('script[src*="cloudflareinsights.com/beacon.min.js"]')) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      s.setAttribute('data-cf-beacon', '{"token": "e79a77d6e38c449eb5da54da33edb008"}');
      document.head.appendChild(s);
    }
  } catch (e) {}
})();
