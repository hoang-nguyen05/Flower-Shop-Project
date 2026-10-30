// ========================================================
// FlowerShop - Cart Management (Backend-driven)
// Backend xử lý giỏ hàng trên Cloudflare Workers + KV + D1
// ========================================================

let currentCart = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  discount: 0,
  shippingFee: 0,
  total: 0,
  coupon: null
};

// 1. Tải giỏ hàng từ Backend Cloudflare Workers
async function loadCart() {
  const res = await apiRequest('/cart');
  if (res.success && res.cart) {
    currentCart = res.cart;
    updateCartUI();
  }
  return currentCart;
}

// 2. Thêm vào giỏ hàng
async function addToCart(productId, quantity = 1, showFeedback = true) {
  const res = await apiRequest('/cart/add', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity })
  });

  if (res.success && res.cart) {
    currentCart = res.cart;
    updateCartUI();
    if (showFeedback) {
      showToast(res.message || 'Đã thêm hoa vào giỏ hàng thành công! 🌸');
      openCartDrawer();
    }
  } else {
    showToast(res.error || 'Không thể thêm vào giỏ hàng', 'error');
  }
}

// 3. Cập nhật số lượng
async function updateCartQty(productId, quantity) {
  const res = await apiRequest('/cart/update', {
    method: 'PUT',
    body: JSON.stringify({ productId, quantity })
  });

  if (res.success && res.cart) {
    currentCart = res.cart;
    updateCartUI();
  }
}

// 4. Xóa một sản phẩm
async function removeFromCart(productId) {
  const res = await apiRequest(`/cart/item/${productId}`, {
    method: 'DELETE'
  });

  if (res.success && res.cart) {
    currentCart = res.cart;
    updateCartUI();
    showToast('Đã xóa hoa khỏi giỏ hàng', 'warning');
  }
}

// 5. Xóa toàn bộ giỏ hàng
async function clearCart() {
  if (!confirm('Bạn có chắc chắn muốn dọn sạch giỏ hàng?')) return;
  const res = await apiRequest('/cart', {
    method: 'DELETE'
  });

  if (res.success) {
    currentCart = res.cart;
    updateCartUI();
    showToast('Đã làm trống giỏ hàng', 'warning');
  }
}

// 6. Áp dụng mã giảm giá
async function applyCoupon(code) {
  if (!code) {
    showToast('Vui lòng nhập mã giảm giá', 'warning');
    return;
  }

  const res = await apiRequest('/cart/coupon', {
    method: 'POST',
    body: JSON.stringify({ code })
  });

  if (res.success && res.cart) {
    currentCart = res.cart;
    updateCartUI();
    showToast(res.message || 'Áp dụng mã giảm giá thành công! 🎟️');
  } else {
    showToast(res.error || 'Mã giảm giá không hợp lệ', 'error');
  }
}

// 7. Hủy mã giảm giá
async function removeCoupon() {
  const res = await apiRequest('/cart/coupon', {
    method: 'DELETE'
  });

  if (res.success && res.cart) {
    currentCart = res.cart;
    updateCartUI();
    showToast('Đã hủy mã giảm giá', 'warning');
  }
}

// 8. Cập nhật giao diện giỏ hàng (Badges, Offcanvas Drawer & Trang Cart)
function updateCartUI() {
  // Cập nhật số lượng trên các badge
  const count = currentCart.itemCount || 0;
  const badges = document.querySelectorAll('.cart-badge-count');
  badges.forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });

  // Cập nhật Drawer Offcanvas
  renderCartDrawer();

  // Nếu đang ở trang cart.html thì render bảng chi tiết
  if (document.getElementById('cart-page-table-body')) {
    renderCartPage();
  }

  // Nếu đang ở trang checkout.html thì cập nhật tóm tắt
  if (document.getElementById('checkout-summary-body')) {
    renderCheckoutSummary();
  }
}

// Render nội dung Cart Drawer (Offcanvas bên phải)
function renderCartDrawer() {
  const container = document.getElementById('cart-drawer-items');
  const totalEl = document.getElementById('cart-drawer-total');
  const countEl = document.getElementById('cart-drawer-count');

  if (countEl) countEl.textContent = `${currentCart.itemCount} sản phẩm`;
  if (totalEl) totalEl.textContent = formatVND(currentCart.total);

  if (!container) return;

  if (!currentCart.items || currentCart.items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-shopping-basket text-muted" style="font-size: 3.5rem;"></i>
        <h5 class="mt-3 text-secondary">Giỏ hàng của bạn đang trống</h5>
        <p class="text-muted small">Hãy chọn những bó hoa tươi xinh xắn ngay hôm nay nhé!</p>
        <a href="/products.html" class="btn btn-outline-danger btn-sm rounded-pill mt-2">Xem cửa hàng</a>
      </div>
    `;
    return;
  }

  container.innerHTML = currentCart.items.map(item => `
    <div class="cart-drawer-item">
      <img src="${item.image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200'}" class="cart-item-img" alt="${item.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=200';">
      <div class="flex-grow-1 min-w-0">
        <h6 class="mb-1 text-truncate font-weight-700" title="${item.name}">${item.name}</h6>
        <div class="text-danger fw-bold small mb-2">${formatVND(item.price)}</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartQty(${item.productId}, ${item.quantity - 1})">-</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty(${item.productId}, ${item.quantity + 1})">+</button>
        </div>
      </div>
      <button class="btn btn-sm text-muted hover-danger" onclick="removeFromCart(${item.productId})" title="Xóa">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
  `).join('');
}

// Mở Cart Drawer
function openCartDrawer() {
  const drawerEl = document.getElementById('cartDrawer');
  if (drawerEl && window.bootstrap) {
    const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(drawerEl);
    bsOffcanvas.show();
  }
}

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
});

