export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2?: R2Bucket;
  ASSETS: Fetcher;
  GEMINI_API_KEY?: string;
  VIETQR_BANK_ID?: string;
  VIETQR_ACCOUNT_NO?: string;
  VIETQR_ACCOUNT_NAME?: string;
  APP_NAME?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  created_at?: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  image_url?: string;
  description?: string;
  price: number;
  original_price?: number;
  stock: number;
  is_featured: number | boolean;
  available: number | boolean;
  created_at?: string;
  updated_at?: string;
  reviews_count?: number;
  average_rating?: number;
}

export interface CartItemSession {
  productId: number;
  quantity: number;
  addedAt: number;
}

export interface CartSessionData {
  items: CartItemSession[];
  couponCode?: string | null;
  updatedAt: number;
}

export interface HydratedCartItem {
  productId: number;
  name: string;
  slug: string;
  image_url?: string;
  price: number;
  original_price?: number;
  quantity: number;
  subtotal: number;
  stock: number;
}

export interface CartResponse {
  items: HydratedCartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  coupon?: {
    code: string;
    description?: string;
    discountAmount: number;
  } | null;
}

export interface Coupon {
  id: number;
  code: string;
  description?: string;
  discount_percent: number;
  discount_amount: number;
  min_order_value: number;
  max_uses: number;
  used_count: number;
  valid_to?: string;
  is_active: number;
}

export interface CreateOrderRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address: string;
  city: string;
  notes?: string;
  payment_method: 'cod' | 'vietqr' | 'momo' | 'bank_transfer';
}

export interface Order {
  id: number;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address: string;
  city: string;
  notes?: string;
  payment_method: string;
  payment_status: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  coupon_code?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number;
  product_name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export interface Review {
  id: number;
  product_id: number;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}
