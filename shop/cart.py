from decimal import Decimal
from django.conf import settings
from .models import Product, Coupon, DBCart, DBCartItem

class Cart:
    def __init__(self, request):
        """
        Khởi tạo giỏ hàng: hỗ trợ cả Session (vãng lai) và Database (khi đã đăng nhập).
        """
        self.session = request.session
        self.request = request
        self.user = request.user if request.user.is_authenticated else None
        
        cart = self.session.get(settings.CART_SESSION_ID)
        if not cart:
            cart = self.session[settings.CART_SESSION_ID] = {}
        self.cart = cart
        
        # Mã giảm giá lưu trong session
        self.coupon_id = self.session.get('coupon_id')

        # Nếu user đã đăng nhập, đồng bộ giỏ hàng DB với Session
        if self.user:
            self._sync_with_db()

    def _sync_with_db(self):
        """
        Đồng bộ giỏ hàng từ Session vào Database và ngược lại khi User đã đăng nhập.
        """
        db_cart, _ = DBCart.objects.get_or_create(user=self.user)
        
        # Nếu trong session có hàng chưa lưu vào DB, chuyển vào DB
        for product_id_str, item_data in list(self.cart.items()):
            try:
                product = Product.objects.get(id=int(product_id_str), available=True)
                db_item, created = DBCartItem.objects.get_or_create(cart=db_cart, product=product)
                if created:
                    db_item.quantity = item_data.get('quantity', 1)
                else:
                    # Gộp số lượng nếu có sẵn
                    db_item.quantity = max(db_item.quantity, item_data.get('quantity', 1))
                db_item.save()
            except Product.DoesNotExist:
                pass
        
        # Cập nhật lại session cart từ DB cart để luôn chính xác và nhất quán
        new_session_cart = {}
        for db_item in db_cart.items.select_related('product'):
            if db_item.product.available:
                new_session_cart[str(db_item.product.id)] = {
                    'quantity': db_item.quantity,
                    'price': str(db_item.product.price)
                }
        self.cart = self.session[settings.CART_SESSION_ID] = new_session_cart
        self.save()

    def add(self, product, quantity=1, override_quantity=False):
        """
        Thêm sản phẩm vào giỏ hàng hoặc cập nhật số lượng của nó.
        """
        product_id = str(product.id)
        if product_id not in self.cart:
            self.cart[product_id] = {'quantity': 0, 'price': str(product.price)}
        
        if override_quantity:
            self.cart[product_id]['quantity'] = quantity
        else:
            self.cart[product_id]['quantity'] += quantity

        # Đảm bảo số lượng không vượt quá tồn kho (nếu có tồn kho > 0)
        if product.stock > 0 and self.cart[product_id]['quantity'] > product.stock:
            self.cart[product_id]['quantity'] = product.stock

        if self.user:
            db_cart, _ = DBCart.objects.get_or_create(user=self.user)
            db_item, _ = DBCartItem.objects.get_or_create(cart=db_cart, product=product)
            db_item.quantity = self.cart[product_id]['quantity']
            db_item.save()

        self.save()

    def save(self):
        self.session.modified = True

    def remove(self, product):
        """
        Xóa sản phẩm khỏi giỏ hàng.
        """
        product_id = str(product.id)
        if product_id in self.cart:
            del self.cart[product_id]
            self.save()

        if self.user:
            try:
                db_cart = DBCart.objects.get(user=self.user)
                DBCartItem.objects.filter(cart=db_cart, product=product).delete()
            except DBCart.DoesNotExist:
                pass

    def __iter__(self):
        """
        Lặp qua các mục trong giỏ hàng và lấy các sản phẩm từ cơ sở dữ liệu.
        """
        product_ids = self.cart.keys()
        products = Product.objects.filter(id__in=product_ids)
        cart = self.cart.copy()
        for product in products:
            cart[str(product.id)]['product'] = product

        for item in cart.values():
            if 'product' in item:
                item['price'] = Decimal(item['price'])
                item['total_price'] = item['price'] * item['quantity']
                yield item

    def __len__(self):
        """
        Đếm tổng số lượng tất cả các bông/mục trong giỏ hàng.
        """
        return sum(item['quantity'] for item in self.cart.values())

    def get_subtotal_price(self):
        """
        Tổng tiền hàng trước khi áp dụng giảm giá.
        """
        return sum(Decimal(item['price']) * item['quantity'] for item in self.cart.values())

    @property
    def coupon(self):
        if self.coupon_id:
            try:
                coupon = Coupon.objects.get(id=self.coupon_id, active=True)
                is_valid, _ = coupon.is_valid(self.get_subtotal_price())
                if is_valid:
                    return coupon
                else:
                    # Coupon không còn hợp lệ do tổng đơn thay đổi hoặc hết hạn
                    self.remove_coupon()
                    return None
            except Coupon.DoesNotExist:
                self.remove_coupon()
                return None
        return None

    def apply_coupon(self, coupon):
        self.coupon_id = coupon.id
        self.session['coupon_id'] = coupon.id
        self.save()

    def remove_coupon(self):
        self.coupon_id = None
        if 'coupon_id' in self.session:
            del self.session['coupon_id']
        self.save()

    def get_discount(self):
        if self.coupon:
            return self.coupon.calculate_discount(self.get_subtotal_price())
        return Decimal(0)

    def get_total_price(self):
        """
        Tổng tiền thanh toán sau khi trừ khuyến mãi / coupon.
        """
        subtotal = self.get_subtotal_price()
        discount = self.get_discount()
        return max(Decimal(0), subtotal - discount)

    def clear(self):
        """
        Xóa sạch giỏ hàng.
        """
        del self.session[settings.CART_SESSION_ID]
        if 'coupon_id' in self.session:
            del self.session['coupon_id']
        self.coupon_id = None
        self.save()

        if self.user:
            try:
                db_cart = DBCart.objects.get(user=self.user)
                db_cart.items.all().delete()
            except DBCart.DoesNotExist:
                pass
