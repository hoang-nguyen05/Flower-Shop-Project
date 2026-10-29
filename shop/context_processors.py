from django.conf import settings as django_settings
from .cart import Cart
from .models import Wishlist

WISHLIST_SESSION_KEY = 'wishlist_ids'

def cart_and_wishlist(request):
    """
    Context processor cung cấp giỏ hàng và danh sách yêu thích cho toàn bộ template.
    Wishlist được cache vào session để tránh query DB trên mọi request.
    """
    cart = Cart(request)
    wishlist_count = 0
    favorite_product_ids = []

    if request.user.is_authenticated:
        # Lấy từ session cache trước
        cached = request.session.get(WISHLIST_SESSION_KEY)
        if cached is None:
            # Cache miss — query DB và lưu vào session
            favorite_product_ids = list(
                Wishlist.objects.filter(user=request.user).values_list('product_id', flat=True)
            )
            request.session[WISHLIST_SESSION_KEY] = favorite_product_ids
        else:
            favorite_product_ids = cached
        wishlist_count = len(favorite_product_ids)

    return {
        'cart': cart,
        'cart_count': len(cart),
        'wishlist_count': wishlist_count,
        'favorite_product_ids': favorite_product_ids,
    }
