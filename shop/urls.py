from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('', views.home, name='home'),
    path('products/', views.product_list, name='product_list'),
    path('products/<slug:category_slug>/', views.product_list, name='product_list_by_category'),
    path('product/<int:id>/<slug:slug>/', views.product_detail, name='product_detail'),
    
    # Tài khoản
    path('register/', views.register, name='register'),
    path('login/', auth_views.LoginView.as_view(template_name='shop/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='home'), name='logout'),
    path('profile/', views.profile, name='profile'),
    
    # Sổ địa chỉ giao hàng
    path('address/create/', views.address_create, name='address_create'),
    path('address/<int:address_id>/delete/', views.address_delete, name='address_delete'),
    path('address/<int:address_id>/default/', views.address_set_default, name='address_set_default'),

    # Wishlist (Hoa yêu thích)
    path('wishlist/', views.wishlist_list, name='wishlist_list'),
    path('wishlist/toggle/<int:product_id>/', views.wishlist_toggle, name='wishlist_toggle'),
    
    # Giỏ hàng & Mã giảm giá
    path('cart/', views.cart_detail, name='cart_detail'),
    path('cart/add/<int:product_id>/', views.cart_add, name='cart_add'),
    path('cart/remove/<int:product_id>/', views.cart_remove, name='cart_remove'),
    path('coupon/apply/', views.coupon_apply, name='coupon_apply'),
    path('coupon/remove/', views.coupon_remove, name='coupon_remove'),
    
    # Đơn hàng & Thanh toán
    path('order/create/', views.order_create, name='order_create'),
    path('order/list/', views.order_list, name='order_list'),
    path('order/<int:order_id>/', views.order_detail, name='order_detail'),
    path('order/<int:order_id>/cancel/', views.order_cancel, name='order_cancel'),
    path('order/<int:order_id>/confirm-payment/', views.order_confirm_payment, name='order_confirm_payment'),

    # Admin Dashboard & Order Management
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/order/<int:order_id>/status/', views.admin_order_update_status, name='admin_order_update_status'),
    path('admin/order/<int:order_id>/mark-paid/', views.admin_order_mark_paid, name='admin_order_mark_paid'),

    # Chatbot
    path('chatbot/', views.chatbot_response, name='chatbot_response'),
]
