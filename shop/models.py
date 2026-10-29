from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from decimal import Decimal

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, verbose_name="Người dùng")
    phone = models.CharField(max_length=15, blank=True, null=True, verbose_name="Số điện thoại")
    address = models.TextField(blank=True, null=True, verbose_name="Địa chỉ")
    avatar = models.ImageField(upload_to='avatars/', default='avatars/default.png', verbose_name="Ảnh đại diện")

    def __str__(self):
        return f"Hồ sơ của {self.user.username}"

    class Meta:
        verbose_name = "Hồ sơ người dùng"
        verbose_name_plural = "Hồ sơ người dùng"


class UserAddress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses', verbose_name="Người dùng")
    full_name = models.CharField(max_length=100, verbose_name="Họ và tên người nhận")
    phone = models.CharField(max_length=15, verbose_name="Số điện thoại")
    city = models.CharField(max_length=100, verbose_name="Tỉnh / Thành phố")
    district = models.CharField(max_length=100, blank=True, verbose_name="Quận / Huyện")
    address = models.CharField(max_length=255, verbose_name="Địa chỉ chi tiết")
    is_default = models.BooleanField(default=False, db_index=True, verbose_name="Địa chỉ mặc định")
    created = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")

    class Meta:
        ordering = ('-is_default', '-created')
        verbose_name = "Sổ địa chỉ"
        verbose_name_plural = "Sổ địa chỉ"

    def __str__(self):
        return f"{self.full_name} - {self.phone} ({self.address}, {self.city})"

    def save(self, *args, **kwargs):
        if self.is_default:
            # Set all other addresses of this user to not default
            UserAddress.objects.filter(user=self.user, is_default=True).exclude(pk=self.pk).update(is_default=False)
        elif not UserAddress.objects.filter(user=self.user).exclude(pk=self.pk).exists():
            # If this is the first address, make it default automatically
            self.is_default = True
        super().save(*args, **kwargs)


class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên danh mục")
    slug = models.SlugField(unique=True, verbose_name="Slug")
    description = models.TextField(blank=True, verbose_name="Mô tả")

    class Meta:
        ordering = ('name',)
        verbose_name = 'Danh mục'
        verbose_name_plural = 'Danh mục'

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('product_list_by_category', args=[self.slug])


class Coupon(models.Model):
    code = models.CharField(max_length=50, unique=True, verbose_name="Mã giảm giá")
    description = models.CharField(max_length=255, blank=True, verbose_name="Mô tả ưu đãi")
    discount_percent = models.PositiveIntegerField(default=0, verbose_name="% giảm (0-100)")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=0, default=0, verbose_name="Số tiền giảm cố định (VNĐ)")
    valid_from = models.DateTimeField(verbose_name="Hiệu lực từ")
    valid_to = models.DateTimeField(verbose_name="Hiệu lực đến")
    min_order_value = models.DecimalField(max_digits=10, decimal_places=0, default=0, verbose_name="Đơn hàng tối thiểu (VNĐ)")
    max_uses = models.PositiveIntegerField(default=100, verbose_name="Lượt sử dụng tối đa")
    used_count = models.PositiveIntegerField(default=0, verbose_name="Lượt đã sử dụng")
    active = models.BooleanField(default=True, verbose_name="Đang kích hoạt")

    class Meta:
        ordering = ('-valid_from',)
        verbose_name = "Mã giảm giá"
        verbose_name_plural = "Mã giảm giá"

    def __str__(self):
        if self.discount_percent > 0:
            return f"{self.code} (-{self.discount_percent}%)"
        return f"{self.code} (-{int(self.discount_amount):,} ₫)"

    def is_valid(self, order_total=Decimal(0)):
        now = timezone.now()
        if not self.active:
            return False, "Mã giảm giá hiện không hoạt động."
        if now < self.valid_from:
            return False, "Mã giảm giá chưa đến thời gian áp dụng."
        if now > self.valid_to:
            return False, "Mã giảm giá đã hết hạn."
        if self.used_count >= self.max_uses:
            return False, "Mã giảm giá đã hết lượt sử dụng."
        if order_total < self.min_order_value:
            return False, f"Đơn hàng cần tối thiểu {int(self.min_order_value):,} VNĐ để áp dụng mã này."
        return True, "Hợp lệ"

    def calculate_discount(self, total_price):
        total_price = Decimal(total_price)
        if self.discount_percent > 0:
            discount = (total_price * Decimal(self.discount_percent)) / Decimal(100)
        else:
            discount = Decimal(self.discount_amount)
        return min(discount, total_price)


class Product(models.Model):
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE, verbose_name="Danh mục")
    name = models.CharField(max_length=200, verbose_name="Tên sản phẩm")
    slug = models.SlugField(max_length=200, unique=True, verbose_name="Slug")
    image = models.ImageField(upload_to='products/%Y/%m/%d', blank=True, verbose_name="Hình ảnh")
    description = models.TextField(blank=True, verbose_name="Mô tả")
    price = models.DecimalField(max_digits=10, decimal_places=0, verbose_name="Giá bán hiện tại (VNĐ)")
    original_price = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True, verbose_name="Giá gốc / Chưa giảm (VNĐ)")
    is_featured = models.BooleanField(default=False, verbose_name="Sản phẩm nổi bật / Khuyến mãi")
    stock = models.PositiveIntegerField(verbose_name="Số lượng tồn kho")
    available = models.BooleanField(default=True, db_index=True, verbose_name="Sẵn bán")
    created = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")
    updated = models.DateTimeField(auto_now=True, verbose_name="Ngày cập nhật")

    class Meta:
        ordering = ('-created',)
        indexes = [
            models.Index(fields=['id', 'slug']),
        ]
        verbose_name = 'Sản phẩm'
        verbose_name_plural = 'Sản phẩm'

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('product_detail', args=[self.id, self.slug])

    @property
    def has_discount(self):
        return bool(self.original_price and self.original_price > self.price)

    @property
    def discount_percent(self):
        if self.has_discount and self.original_price:
            percent = ((self.original_price - self.price) / self.original_price) * 100
            return int(round(percent))
        return 0


class Wishlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wishlists', verbose_name="Người dùng")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='favorited_by', verbose_name="Sản phẩm")
    created = models.DateTimeField(auto_now_add=True, verbose_name="Ngày thêm")

    class Meta:
        ordering = ('-created',)
        unique_together = ('user', 'product')
        verbose_name = 'Hoa yêu thích'
        verbose_name_plural = 'Hoa yêu thích'

    def __str__(self):
        return f"{self.user.username} thích {self.product.name}"


class DBCart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='db_cart', verbose_name="Người dùng")
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Giỏ hàng người dùng"
        verbose_name_plural = "Giỏ hàng người dùng"

    def __str__(self):
        return f"Giỏ hàng của {self.user.username}"


class DBCartItem(models.Model):
    cart = models.ForeignKey(DBCart, on_delete=models.CASCADE, related_name='items', verbose_name="Giỏ hàng")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="Sản phẩm")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Số lượng")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('cart', 'product')
        verbose_name = "Mục giỏ hàng"
        verbose_name_plural = "Mục giỏ hàng"

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"


class ProductReview(models.Model):
    RATING_CHOICES = [(i, f'{i} sao') for i in range(1, 6)]

    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE, verbose_name='Sản phẩm')
    user = models.ForeignKey(User, related_name='product_reviews', on_delete=models.CASCADE, verbose_name='Người dùng')
    rating = models.PositiveSmallIntegerField(choices=RATING_CHOICES, verbose_name='Điểm đánh giá')
    comment = models.TextField(verbose_name='Nhận xét')
    created = models.DateTimeField(auto_now_add=True, verbose_name='Ngày gửi')
    updated = models.DateTimeField(auto_now=True, verbose_name='Cập nhật')

    class Meta:
        ordering = ('-created',)
        verbose_name = 'Đánh giá sản phẩm'
        verbose_name_plural = 'Đánh giá sản phẩm'
        constraints = [
            models.UniqueConstraint(fields=('product', 'user'), name='unique_product_review_per_user'),
        ]

    def __str__(self):
        return f'{self.user.username} — {self.product.name} ({self.rating}★)'


class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Chờ xử lý'),
        ('approved', 'Đã duyệt'),
        ('rejected', 'Từ chối'),
        ('shipped', 'Đang giao'),
        ('completed', 'Hoàn thành'),
        ('cancelled', 'Đã hủy'),
    )
    
    PAYMENT_METHOD_CHOICES = (
        ('cod', 'Thanh toán khi nhận hàng (COD)'),
        ('bank_transfer', 'Chuyển khoản Ngân hàng (Quét mã VietQR)'),
        ('momo', 'Ví MoMo'),
        ('vnpay', 'Cổng thanh toán VNPAY'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders', verbose_name="Người đặt")
    first_name = models.CharField(max_length=50, verbose_name="Tên")
    last_name = models.CharField(max_length=50, verbose_name="Họ")
    phone = models.CharField(max_length=15, blank=True, verbose_name="Số điện thoại")
    email = models.EmailField(verbose_name="Email")
    address = models.CharField(max_length=250, verbose_name="Địa chỉ giao hàng")
    postal_code = models.CharField(max_length=20, blank=True, default='100000', verbose_name="Mã bưu điện")
    city = models.CharField(max_length=100, verbose_name="Tỉnh / Thành phố")
    notes = models.TextField(blank=True, verbose_name="Ghi chú đơn hàng / Lời chúc thiệp")
    
    # Thanh toán & Khuyến mãi
    payment_method = models.CharField(max_length=30, choices=PAYMENT_METHOD_CHOICES, default='cod', verbose_name="Phương thức thanh toán")
    paid = models.BooleanField(default=False, db_index=True, verbose_name="Đã thanh toán")
    payment_reference = models.CharField(max_length=100, blank=True, verbose_name="Mã giao dịch / Ghi chú thanh toán")
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders', verbose_name="Mã giảm giá áp dụng")
    discount = models.DecimalField(max_digits=10, decimal_places=0, default=0, verbose_name="Số tiền đã giảm (VNĐ)")
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=0, default=0, verbose_name="Phí vận chuyển (VNĐ)")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True, verbose_name="Trạng thái")
    created = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")
    updated = models.DateTimeField(auto_now=True, verbose_name="Ngày cập nhật")

    class Meta:
        ordering = ('-created',)
        verbose_name = 'Đơn hàng'
        verbose_name_plural = 'Đơn hàng'

    def __str__(self):
        return f'Đơn hàng #{self.id}'

    def get_subtotal(self):
        return sum(item.get_cost() for item in self.items.all())

    def get_total_cost(self):
        subtotal = self.get_subtotal()
        total = subtotal - self.discount + self.shipping_fee
        return max(Decimal(0), total)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE, verbose_name="Đơn hàng")
    product = models.ForeignKey(Product, related_name='order_items', on_delete=models.CASCADE, verbose_name="Sản phẩm")
    price = models.DecimalField(max_digits=10, decimal_places=0, verbose_name="Đơn giá (VNĐ)")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Số lượng")

    class Meta:
        verbose_name = 'Mục đơn hàng'
        verbose_name_plural = 'Mục đơn hàng'

    def __str__(self):
        return f"{self.quantity}x {self.product.name}"

    def get_cost(self):
        return self.price * self.quantity
