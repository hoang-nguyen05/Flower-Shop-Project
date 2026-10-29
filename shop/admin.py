from django.contrib import admin
from .models import (
    Category, Product, Order, OrderItem, Profile, ProductReview,
    Coupon, Wishlist, UserAddress, DBCart, DBCartItem
)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name']


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_percent', 'discount_amount', 'min_order_value', 'valid_from', 'valid_to', 'used_count', 'max_uses', 'active']
    list_filter = ['active', 'valid_from', 'valid_to']
    search_fields = ['code', 'description']
    list_editable = ['active']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price', 'original_price', 'stock', 'is_featured', 'available', 'created', 'updated']
    list_filter = ['available', 'is_featured', 'created', 'updated', 'category']
    list_editable = ['price', 'original_price', 'stock', 'available', 'is_featured']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name', 'description']


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ['product', 'user', 'rating', 'created', 'updated']
    list_filter = ['rating', 'created']
    search_fields = ['comment', 'user__username', 'product__name']
    raw_id_fields = ['product', 'user']


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'created']
    search_fields = ['user__username', 'product__name']
    raw_id_fields = ['user', 'product']


@admin.register(UserAddress)
class UserAddressAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'phone', 'address', 'city', 'is_default', 'created']
    list_filter = ['is_default', 'city']
    search_fields = ['user__username', 'full_name', 'phone', 'address']


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    raw_id_fields = ['product']
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'first_name', 'last_name', 'phone', 'payment_method', 'paid', 'discount', 'status', 'created']
    list_filter = ['paid', 'status', 'payment_method', 'created']
    search_fields = ['id', 'first_name', 'last_name', 'phone', 'email', 'address']
    list_editable = ['status', 'paid']
    inlines = [OrderItemInline]


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'phone', 'address']
    search_fields = ['user__username', 'phone', 'address']


class DBCartItemInline(admin.TabularInline):
    model = DBCartItem
    raw_id_fields = ['product']
    extra = 0


@admin.register(DBCart)
class DBCartAdmin(admin.ModelAdmin):
    list_display = ['user', 'updated']
    inlines = [DBCartItemInline]
