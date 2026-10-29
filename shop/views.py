from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import redirect_to_login
from django.contrib.auth.models import User
from django.contrib import messages
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum, Count, Avg, F, DecimalField, ExpressionWrapper
from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.http import require_POST
from django.http import JsonResponse, HttpResponseRedirect
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from decimal import Decimal
import json
import os
import urllib.error
import urllib.request
import urllib.parse

from .models import (
    Category, Product, Order, OrderItem, ProductReview,
    Coupon, Wishlist, UserAddress, Profile
)
from .forms import (
    UserRegistrationForm, UserUpdateForm, ProfileUpdateForm,
    OrderCreateForm, ProductReviewForm, UserAddressForm, CouponApplyForm
)
from .cart import Cart


# ==========================================
# 1. TRỢ LÝ AI CHATBOT (OLLAMA LOCAL LLM)
# ==========================================

def _ollama_chat(system_prompt: str, user_message: str, timeout: int = 120):
    """Gọi Ollama (/api/chat) — mặc định Llama 3.2 cục bộ."""
    base = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').rstrip('/')
    model = os.getenv('OLLAMA_MODEL', 'llama3.2')
    url = f'{base}/api/chat'
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt.strip()},
            {'role': 'user', 'content': user_message.strip()},
        ],
        'stream': False,
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode())
        msg = (body or {}).get('message') or {}
        text = (msg.get('content') or '').strip()
        return text if text else None
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def chatbot_response(request):
    user_message = request.GET.get('message', '').strip()
    if not user_message:
        return JsonResponse({'response': "Chào bạn! Tôi có thể giúp gì cho bạn?"})

    try:
        products = Product.objects.filter(available=True).order_by('-created')[:15]
        categories = Category.objects.all()
        
        product_info = "\n".join([f"- {p.name}: {int(p.price):,} VNĐ (Còn: {p.stock})" for p in products])
        category_info = ", ".join([c.name for c in categories])

        system_prompt = f"""
        Bạn là chuyên viên tư vấn hoa tươi tại 'FlowerShop'.
        Danh sách hoa nổi bật:
        {product_info}
        Danh mục hoa: {category_info}
        Địa chỉ: 123 Đường Láng, Hà Nội. Hotline: +84 123 456 789.
        Chính sách: Giao hỏa tốc trong 2h, tặng kèm thiệp & ruy băng sang trọng, hỗ trợ mã giảm giá và thanh toán VietQR.
        Trả lời lịch sự, thân thiện, ngắn gọn bằng tiếng Việt.
        """

        reply = _ollama_chat(system_prompt, user_message)
        if reply:
            return JsonResponse({'response': reply})
        return JsonResponse({
            'response': (
                'FlowerShop xin chào! Hiện trợ lý AI đang bận kết nối, bạn có thể gọi hotline +84 123 456 789 để được hỗ trợ tức thì nhé!'
            ),
        })

    except Exception:
        return JsonResponse({'response': 'Xin lỗi, trợ lý AI đang gặp sự cố nhỏ. Vui lòng thử lại sau!'})


# ==========================================
# 2. DASHBOARD THỐNG KÊ (ĐÃ TỐI ƯU & SỬA LỖI DOANH THU)
# ==========================================

@staff_member_required
def admin_dashboard(request):
    from django.db.models.functions import TruncMonth
    from datetime import timedelta

    total_orders = Order.objects.count()
    
    # Sửa lỗi: Doanh thu = Tổng (giá * số lượng) của từng item trong đơn đã thanh toán
    revenue_calc = OrderItem.objects.filter(order__paid=True).aggregate(
        total=Sum(ExpressionWrapper(F('price') * F('quantity'), output_field=DecimalField()))
    )['total']
    total_revenue = float(revenue_calc or 0)
    
    total_users = User.objects.count()
    total_products = Product.objects.count()
    
    # Doanh thu theo tháng (6 tháng gần nhất)
    six_months_ago = timezone.now() - timedelta(days=180)
    revenue_by_month = OrderItem.objects.filter(order__paid=True, order__created__gte=six_months_ago) \
        .annotate(month=TruncMonth('order__created')) \
        .values('month') \
        .annotate(total=Sum(ExpressionWrapper(F('price') * F('quantity'), output_field=DecimalField()))) \
        .order_by('month')

    months_labels = [r['month'].strftime('%m/%Y') for r in revenue_by_month]
    revenue_data = [float(r['total']) for r in revenue_by_month]

    # Thống kê trạng thái đơn hàng
    status_stats = Order.objects.values('status').annotate(count=Count('id'))
    status_labels = []
    status_counts = []
    status_dict = dict(Order.STATUS_CHOICES)
    for stat in status_stats:
        status_labels.append(status_dict.get(stat['status'], stat['status']))
        status_counts.append(stat['count'])
    
    # Top 5 sản phẩm bán chạy nhất
    top_products = Product.objects.annotate(
        total_sold=Sum('order_items__quantity')
    ).filter(total_sold__gt=0).order_by('-total_sold')[:5]

    # Cảnh báo tồn kho thấp (≤ 5 sản phẩm)
    low_stock_products = Product.objects.filter(available=True, stock__lte=5).order_by('stock')[:10]
    out_of_stock_count = Product.objects.filter(available=True, stock=0).count()

    # Đơn hàng gần đây
    recent_orders = Order.objects.select_related('user').prefetch_related('items__product').order_by('-created')[:10]

    # Đơn hàng chờ xử lý
    pending_orders = Order.objects.filter(status='pending').select_related('user').order_by('-created')[:10]

    context = {
        'total_orders': total_orders,
        'total_revenue': total_revenue,
        'total_users': total_users,
        'total_products': total_products,
        'months_labels': json.dumps(months_labels),
        'revenue_data': json.dumps(revenue_data),
        'status_labels': json.dumps(status_labels),
        'status_counts': json.dumps(status_counts),
        'top_products': top_products,
        'recent_orders': recent_orders,
        'pending_orders': pending_orders,
        'low_stock_products': low_stock_products,
        'out_of_stock_count': out_of_stock_count,
        'order_status_choices': Order.STATUS_CHOICES,
    }
    return render(request, 'shop/admin/dashboard.html', context)


# ==========================================
# 3. TRANG CHỦ & DANH SÁCH SẢN PHẨM
# ==========================================

def home(request):
    categories = Category.objects.all()
    featured_products = Product.objects.filter(available=True, is_featured=True)[:8]
    if not featured_products.exists():
        featured_products = Product.objects.filter(available=True)[:8]
    
    sale_products = Product.objects.filter(available=True, original_price__gt=F('price'))[:8]
    latest_products = Product.objects.filter(available=True).order_by('-created')[:8]
    
    coupons = Coupon.objects.filter(active=True, valid_to__gte=timezone.now())[:4]

    return render(request, 'shop/home.html', {
        'categories': categories,
        'featured_products': featured_products,
        'sale_products': sale_products,
        'latest_products': latest_products,
        'coupons': coupons,
    })


def product_list(request, category_slug=None):
    category = None
    categories = Category.objects.all()
    products = Product.objects.filter(available=True)
    
    # Tìm kiếm
    query = request.GET.get('q', '').strip()
    if query:
        products = products.filter(
            Q(name__icontains=query) | Q(description__icontains=query) | Q(category__name__icontains=query)
        )

    # Lọc theo danh mục
    if category_slug:
        category = get_object_or_404(Category, slug=category_slug)
        products = products.filter(category=category)

    # Lọc theo chỉ hoa khuyến mãi / giảm giá
    on_sale = request.GET.get('on_sale')
    if on_sale == '1':
        products = products.filter(original_price__gt=F('price'))

    # Lọc theo khoảng giá
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    if min_price and min_price.isdigit():
        products = products.filter(price__gte=Decimal(min_price))
    if max_price and max_price.isdigit():
        products = products.filter(price__lte=Decimal(max_price))

    # Sắp xếp
    sort = request.GET.get('sort', 'newest')
    if sort == 'price_asc':
        products = products.order_by('price')
    elif sort == 'price_desc':
        products = products.order_by('-price')
    elif sort == 'name_asc':
        products = products.order_by('name')
    elif sort == 'discount_desc':
        products = products.filter(original_price__gt=F('price')).order_by('-created')
    else:
        products = products.order_by('-created')

    # Phân trang (12 sản phẩm/trang)
    paginator = Paginator(products, 12)
    page = request.GET.get('page', 1)
    try:
        product_page = paginator.page(page)
    except PageNotAnInteger:
        product_page = paginator.page(1)
    except EmptyPage:
        product_page = paginator.page(paginator.num_pages)

    return render(request, 'shop/product/list.html', {
        'category': category,
        'categories': categories,
        'products': product_page,
        'current_sort': sort,
        'query': query,
        'on_sale': on_sale,
        'min_price': min_price,
        'max_price': max_price,
        'total_count': products.count() if hasattr(products, 'count') else 0,
    })


def product_detail(request, id, slug):
    product = get_object_or_404(Product, id=id, slug=slug, available=True)
    reviews = product.reviews.select_related('user').all()
    agg = reviews.aggregate(avg=Avg('rating'), count=Count('id'))
    avg_rating = agg['avg']
    review_count = agg['count']
    avg_rounded_stars = int(round(float(avg_rating))) if avg_rating is not None else 0

    # Kiểm tra người dùng đã mua sản phẩm này chưa (Verified Buyer)
    has_purchased = False
    if request.user.is_authenticated:
        has_purchased = OrderItem.objects.filter(
            order__user=request.user,
            order__status__in=['approved', 'shipped', 'completed'],
            product=product
        ).exists()

    user_review = None
    if request.user.is_authenticated:
        user_review = ProductReview.objects.filter(product=product, user=request.user).first()

    # Xử lý gửi hoặc sửa đánh giá
    form = None
    if request.method == 'POST':
        if not request.user.is_authenticated:
            messages.warning(request, 'Vui lòng đăng nhập để gửi đánh giá.')
            return redirect_to_login(next=request.get_full_path())

        form = ProductReviewForm(request.POST, instance=user_review)
        if form.is_valid():
            r = form.save(commit=False)
            r.product = product
            r.user = request.user
            r.save()
            messages.success(request, 'Cảm ơn bạn! Đánh giá đã được lưu thành công.')
            return redirect(product.get_absolute_url())
    elif request.user.is_authenticated:
        form = ProductReviewForm(instance=user_review)

    # Sản phẩm liên quan cùng danh mục
    related_products = Product.objects.filter(category=product.category, available=True).exclude(id=product.id)[:4]

    return render(request, 'shop/product/detail.html', {
        'product': product,
        'reviews': reviews,
        'review_form': form,
        'avg_rating': avg_rating,
        'review_count': review_count,
        'avg_rounded_stars': avg_rounded_stars,
        'user_review': user_review,
        'has_purchased': has_purchased,
        'related_products': related_products,
    })


# ==========================================
# 4. GIỎ HÀNG (CART) & MÃ GIẢM GIÁ (COUPON)
# ==========================================

@require_POST
def cart_add(request, product_id):
    cart = Cart(request)
    product = get_object_or_404(Product, id=product_id)
    quantity = int(request.POST.get('quantity', 1))
    override = request.POST.get('override') == 'True'
    buy_now = request.POST.get('buy_now') == '1'

    if product.stock <= 0:
        messages.error(request, f'Sản phẩm "{product.name}" hiện đang tạm hết hàng.')
        return redirect('product_detail', id=product.id, slug=product.slug)

    cart.add(product=product, quantity=quantity, override_quantity=override)

    if buy_now:
        # Mua ngay: chuyển thẳng đến trang đặt hàng
        return redirect('order_create')

    messages.success(request, f'Đã thêm {product.name} vào giỏ hàng!')
    return redirect('cart_detail')


def cart_remove(request, product_id):
    cart = Cart(request)
    product = get_object_or_404(Product, id=product_id)
    cart.remove(product)
    messages.info(request, f'Đã xóa {product.name} khỏi giỏ hàng.')
    return redirect('cart_detail')


def cart_detail(request):
    cart = Cart(request)
    coupon_form = CouponApplyForm()
    return render(request, 'shop/cart/detail.html', {
        'cart': cart,
        'coupon_form': coupon_form
    })


@require_POST
def coupon_apply(request):
    cart = Cart(request)
    form = CouponApplyForm(request.POST)
    if form.is_valid():
        code = form.cleaned_data['code'].strip().upper()
        try:
            coupon = Coupon.objects.get(code__iexact=code)
            is_valid, msg = coupon.is_valid(order_total=cart.get_subtotal_price())
            if is_valid:
                cart.apply_coupon(coupon)
                messages.success(request, f'Áp dụng mã giảm giá "{coupon.code}" thành công!')
            else:
                messages.error(request, msg)
        except Coupon.DoesNotExist:
            messages.error(request, 'Mã giảm giá không tồn tại hoặc đã hết hiệu lực.')
    return redirect('cart_detail')


def coupon_remove(request):
    cart = Cart(request)
    cart.remove_coupon()
    messages.info(request, 'Đã gỡ mã giảm giá.')
    return redirect('cart_detail')


# ==========================================
# 5. HOA YÊU THÍCH (WISHLIST)
# ==========================================

@login_required
def wishlist_list(request):
    wishlists = Wishlist.objects.filter(user=request.user).select_related('product', 'product__category')
    return render(request, 'shop/wishlist.html', {'wishlists': wishlists})


@login_required
def wishlist_toggle(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    wishlist_item, created = Wishlist.objects.get_or_create(user=request.user, product=product)

    if not created:
        wishlist_item.delete()
        favorited = False
        msg = f'Đã bỏ "{product.name}" khỏi danh sách yêu thích.'
    else:
        favorited = True
        msg = f'Đã thêm "{product.name}" vào danh sách yêu thích!'

    # Xóa cache wishlist trong session để context processor re-query
    if 'wishlist_ids' in request.session:
        del request.session['wishlist_ids']

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json':
        total_favs = Wishlist.objects.filter(user=request.user).count()
        return JsonResponse({'favorited': favorited, 'message': msg, 'total_wishlist': total_favs})

    messages.success(request, msg)
    referer = request.META.get('HTTP_REFERER')
    return HttpResponseRedirect(referer or product.get_absolute_url())


# ==========================================
# 6. SỔ ĐỊA CHỈ GIAO HÀNG (ADDRESS BOOK)
# ==========================================

@login_required
def address_create(request):
    next_url = request.GET.get('next') or request.POST.get('next') or 'profile'
    if request.method == 'POST':
        form = UserAddressForm(request.POST)
        if form.is_valid():
            address = form.save(commit=False)
            address.user = request.user
            address.save()
            messages.success(request, 'Đã lưu địa chỉ giao hàng mới!')
            return redirect(next_url)
    else:
        form = UserAddressForm()
    return render(request, 'shop/address_form.html', {'form': form, 'title': 'Thêm địa chỉ mới', 'next': next_url})


@login_required
def address_delete(request, address_id):
    address = get_object_or_404(UserAddress, id=address_id, user=request.user)
    address.delete()
    messages.info(request, 'Đã xóa địa chỉ giao hàng.')
    return redirect('profile')


@login_required
def address_set_default(request, address_id):
    address = get_object_or_404(UserAddress, id=address_id, user=request.user)
    address.is_default = True
    address.save()
    messages.success(request, f'Đã đặt địa chỉ "{address.address}" làm mặc định.')
    return redirect('profile')


# ==========================================
# 7. ĐẶT HÀNG & THANH TOÁN THỰC TẾ (VIETQR / COD)
# ==========================================

@login_required
def order_create(request):
    cart = Cart(request)
    if len(cart) == 0:
        messages.warning(request, 'Giỏ hàng của bạn đang trống. Hãy chọn vài bông hoa trước nhé!')
        return redirect('product_list')

    user_addresses = UserAddress.objects.filter(user=request.user)
    default_address = user_addresses.filter(is_default=True).first() or user_addresses.first()

    if request.method == 'POST':
        form = OrderCreateForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    # Khóa hàng tồn kho và kiểm tra race condition
                    for item in cart:
                        prod = Product.objects.select_for_update().get(id=item['product'].id)
                        if prod.stock < item['quantity']:
                            messages.error(request, f'Rất tiếc! Hoa "{prod.name}" chỉ còn {prod.stock} sản phẩm trong kho.')
                            return redirect('cart_detail')

                    order = form.save(commit=False)
                    order.user = request.user

                    # Áp dụng coupon nếu có
                    applied_coupon = cart.coupon
                    if applied_coupon:
                        order.coupon = applied_coupon
                        order.discount = cart.get_discount()
                        applied_coupon.used_count += 1
                        applied_coupon.save()

                    order.save()

                    # Tạo OrderItems và trừ tồn kho (bên trong transaction)
                    for item in cart:
                        OrderItem.objects.create(
                            order=order,
                            product=item['product'],
                            price=item['price'],
                            quantity=item['quantity']
                        )
                        Product.objects.filter(id=item['product'].id).update(
                            stock=F('stock') - item['quantity']
                        )

                    # Xóa giỏ hàng
                    cart.clear()

            except Exception as e:
                messages.error(request, f'Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại!')
                return redirect('cart_detail')

            # Gửi email xác nhận (ngoài transaction để không block)
            _send_order_confirmation_email(order)

            messages.success(request, f'Đặt hàng thành công! Mã đơn hàng của bạn là #{order.id}. 🌸')
            return redirect('order_detail', order_id=order.id)
    else:
        initial_data = {
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'email': request.user.email,
            'phone': request.user.profile.phone if hasattr(request.user, 'profile') else '',
            'address': default_address.address if default_address else (request.user.profile.address if hasattr(request.user, 'profile') else ''),
            'city': default_address.city if default_address else 'Hà Nội',
            'payment_method': 'bank_transfer',
        }
        form = OrderCreateForm(initial=initial_data)

    return render(request, 'shop/order/create.html', {
        'cart': cart,
        'form': form,
        'user_addresses': user_addresses,
        'default_address': default_address,
    })


def _send_order_confirmation_email(order):
    """Gửi email xác nhận đơn hàng đến khách hàng."""
    try:
        subject = f'[FlowerShop] Xác nhận đơn hàng #{order.id} 🌸'
        items_text = '\n'.join(
            f'  - {item.product.name} x{item.quantity}: {int(item.get_cost()):,} ₫'
            for item in order.items.select_related('product').all()
        )
        payment_map = {
            'cod': 'Tiền mặt khi nhận hàng (COD)',
            'bank_transfer': f'Chuyển khoản VietQR (MB - {getattr(settings, "VIETQR_ACCOUNT_NO", "")})',
            'momo': 'Ví MoMo',
            'vnpay': 'VNPAY',
        }
        body = f"""
Xin chào {order.first_name} {order.last_name}!

FlowerShop đã nhận đơn hàng #{order.id} của bạn.

--- CHI TIẾT ĐƠN HÀNG ---
{items_text}

Giảm giá   : -{int(order.discount):,} ₫
Phí vận chuyển: Miễn phí
Tổng thanh toán: {int(order.get_total_cost()):,} ₫

--- GIAO HÀNG ĐẾN ---
{order.first_name} {order.last_name} | {order.phone}
{order.address}, {order.city}

Phương thức TT: {payment_map.get(order.payment_method, order.payment_method)}

Chúng tôi sẽ liên hệ xác nhận và giao hoa trong 2 giờ (nội thành).
Mọi thắc mắc: hotline +84 123 456 789

Cảm ơn bạn đã tin tưởng FlowerShop! 🌺
        """
        send_mail(
            subject=subject,
            message=body.strip(),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.email],
            fail_silently=True,
        )
    except Exception:
        pass  # Email lỗi không nên block flow chính


@login_required
def order_list(request):
    orders = Order.objects.filter(user=request.user)\
        .prefetch_related('items__product')\
        .select_related('coupon')\
        .order_by('-created')
    return render(request, 'shop/order/list.html', {'orders': orders})


@login_required
def order_detail(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    
    # Tạo mã VietQR động chuẩn Napas247 nếu đơn chọn Chuyển khoản ngân hàng
    vietqr_url = None
    bank_id = getattr(settings, 'VIETQR_BANK_ID', 'MB')
    account_no = getattr(settings, 'VIETQR_ACCOUNT_NO', '0898287030')
    account_name = getattr(settings, 'VIETQR_ACCOUNT_NAME', 'FLOWER SHOP')
    
    total_amount = int(order.get_total_cost())
    memo = f"DH{order.id}"
    
    # URL VietQR chuẩn: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-compact2.png?amount=<AMOUNT>&addInfo=<MEMO>&accountName=<ACCOUNT_NAME>
    encoded_name = urllib.parse.quote(account_name)
    vietqr_url = f"https://img.vietqr.io/image/{bank_id}-{account_no}-compact2.png?amount={total_amount}&addInfo={memo}&accountName={encoded_name}"

    return render(request, 'shop/order/detail.html', {
        'order': order,
        'vietqr_url': vietqr_url,
        'bank_id': bank_id,
        'account_no': account_no,
        'account_name': account_name,
        'memo': memo,
    })


@login_required
@require_POST
def order_confirm_payment(request, order_id):
    """Khách hàng bấm xác nhận đã chuyển khoản ngân hàng."""
    order = get_object_or_404(Order, id=order_id, user=request.user)
    ref = request.POST.get('payment_reference', '').strip()
    order.payment_reference = ref or f"Đã chuyển khoản lúc {timezone.now().strftime('%H:%M %d/%m/%Y')}"
    order.save(update_fields=['payment_reference', 'updated'])
    messages.success(request, 'Cảm ơn bạn! Shop đã ghi nhận thông tin và sẽ xác thực chuyển khoản ngay.')
    return redirect('order_detail', order_id=order.id)


@login_required
@require_POST
def order_cancel(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    if order.status != 'pending':
        messages.error(request, 'Chỉ có thể hủy đơn hàng đang ở trạng thái chờ xử lý.')
        return redirect('order_detail', order_id=order.id)

    order.status = 'cancelled'
    order.save(update_fields=['status', 'updated'])

    # Hoàn lại tồn kho cho sản phẩm
    for item in order.items.all():
        prod = item.product
        prod.stock += item.quantity
        prod.save()

    # Hoàn lại lượt dùng coupon nếu có
    if order.coupon and order.coupon.used_count > 0:
        order.coupon.used_count -= 1
        order.coupon.save()

    messages.success(request, f'Đơn hàng #{order.id} đã được hủy và hoàn lại tồn kho thành công.')
    return redirect('order_detail', order_id=order.id)


# ==========================================
# 8. TÀI KHOẢN & HỒ SƠ NGƯỜI DÙNG
# ==========================================

def register(request):
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            # Đăng nhập luôn sau khi đăng ký
            login(request, user)
            messages.success(request, f'Chào mừng {user.username}! Tài khoản của bạn đã được tạo thành công.')
            return redirect('home')
    else:
        form = UserRegistrationForm()
    return render(request, 'shop/register.html', {'form': form})


@login_required
def profile(request):
    user_addresses = UserAddress.objects.filter(user=request.user)
    address_form = UserAddressForm()
    
    if request.method == 'POST':
        u_form = UserUpdateForm(request.POST, instance=request.user)
        p_form = ProfileUpdateForm(request.POST, request.FILES, instance=request.user.profile)
        if u_form.is_valid() and p_form.is_valid():
            u_form.save()
            p_form.save()
            messages.success(request, 'Hồ sơ cá nhân của bạn đã được cập nhật!')
            return redirect('profile')
    else:
        u_form = UserUpdateForm(instance=request.user)
        p_form = ProfileUpdateForm(instance=request.user.profile)

    context = {
        'u_form': u_form,
        'p_form': p_form,
        'user_addresses': user_addresses,
        'address_form': address_form,
    }
    return render(request, 'shop/profile.html', context)


# ==========================================
# 9. ADMIN ORDER MANAGEMENT (QUICK ACTIONS)
# ==========================================

@staff_member_required
@require_POST
def admin_order_update_status(request, order_id):
    """Cập nhật trạng thái đơn hàng nhanh từ dashboard."""
    order = get_object_or_404(Order, id=order_id)
    new_status = request.POST.get('status')
    valid_statuses = [s[0] for s in Order.STATUS_CHOICES]

    if new_status not in valid_statuses:
        messages.error(request, 'Trạng thái không hợp lệ.')
        return redirect('admin_dashboard')

    old_status = order.status
    order.status = new_status

    # Tự động đánh dấu đã thanh toán khi hoàn thành
    if new_status == 'completed' and not order.paid:
        order.paid = True

    order.save(update_fields=['status', 'paid', 'updated'])

    # Hoàn tồn kho nếu bị từ chối hoặc hủy
    if new_status in ('rejected', 'cancelled') and old_status not in ('rejected', 'cancelled'):
        for item in order.items.select_related('product').all():
            Product.objects.filter(id=item.product_id).update(stock=F('stock') + item.quantity)

    status_display = dict(Order.STATUS_CHOICES).get(new_status, new_status)
    messages.success(request, f'Đơn hàng #{order.id} đã chuyển sang: {status_display}')
    return redirect(request.POST.get('next', 'admin_dashboard'))


@staff_member_required
@require_POST
def admin_order_mark_paid(request, order_id):
    """Đánh dấu đơn hàng đã thanh toán từ dashboard."""
    order = get_object_or_404(Order, id=order_id)
    order.paid = not order.paid
    order.save(update_fields=['paid', 'updated'])
    status = 'Đã thanh toán' if order.paid else 'Chưa thanh toán'
    messages.success(request, f'Đơn hàng #{order.id}: {status}')
    return redirect(request.POST.get('next', 'admin_dashboard'))