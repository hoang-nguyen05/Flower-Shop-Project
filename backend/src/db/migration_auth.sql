-- Migration: Thêm bảng Users & Wishlists, phân quyền Admin & Khách hàng
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT DEFAULT 'Hà Nội',
    role TEXT NOT NULL DEFAULT 'customer',
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);

-- Thêm tài khoản quản trị Admin mặc định
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, address, city, role, avatar_url)
VALUES (
    'admin',
    'admin@flowershop.vn',
    '87bdfdf7e16c7e73addc4c7f7a5cfc1a546e29b9dd47371c39a87c6a833b783b',
    'Quản Trị Viên FlowerShop',
    '0362843621',
    'Trụ sở FlowerShop, Tòa nhà Công Nghệ',
    'Hà Nội',
    'admin',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
);

-- Thêm tài khoản Khách hàng mẫu
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, address, city, role, avatar_url)
VALUES (
    'khachhang',
    'khachhang@gmail.com',
    '8c2a7b9b4d009742e1f27bde0650c58ebf687b723091be5950264fa0a7567284',
    'Nguyễn Khách Hàng',
    '0987654321',
    '123 Đường Láng, Đống Đa',
    'Hà Nội',
    'customer',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'
);
