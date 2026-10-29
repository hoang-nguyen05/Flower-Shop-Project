// ========================================================
// FlowerShop - Global Application Helpers
// ========================================================

// 1. Quản lý Yêu thích (Wishlist)
function getWishlist() {
  return JSON.parse(localStorage.getItem('flower_wishlist') || '[]');
}

function toggleWishlist(productId, btn) {
  let list = getWishlist();
  const index = list.indexOf(productId);
  let isAdded = false;

  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(productId);
    isAdded = true;
  }

  localStorage.setItem('flower_wishlist', JSON.stringify(list));

  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      if (isAdded) {
        icon.classList.remove('far');
        icon.classList.add('fas', 'text-danger');
      } else {
        icon.classList.remove('fas', 'text-danger');
        icon.classList.add('far');
      }
    }
  }

  updateWishlistBadge();
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

