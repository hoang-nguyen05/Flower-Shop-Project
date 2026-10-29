from django import forms
from django.contrib.auth.models import User
from .models import Profile, Order, ProductReview, UserAddress, Coupon

class UserRegistrationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Nhập mật khẩu'}), label="Mật khẩu")
    confirm_password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Nhập lại mật khẩu'}), label="Xác nhận mật khẩu")

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name']
        labels = {
            'username': 'Tên đăng nhập',
            'email': 'Email',
            'first_name': 'Họ',
            'last_name': 'Tên',
        }
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Tên tài khoản'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Địa chỉ email'}),
            'first_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Họ và tên đệm'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Tên'}),
        }

    def clean_confirm_password(self):
        password = self.cleaned_data.get('password')
        confirm_password = self.cleaned_data.get('confirm_password')
        if password and confirm_password and password != confirm_password:
            raise forms.ValidationError("Mật khẩu xác nhận không khớp.")
        return confirm_password


class UserUpdateForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email']
        labels = {
            'first_name': 'Họ',
            'last_name': 'Tên',
            'email': 'Email',
        }
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
        }


class ProfileUpdateForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['phone', 'address', 'avatar']
        labels = {
            'phone': 'Số điện thoại',
            'address': 'Địa chỉ',
            'avatar': 'Ảnh đại diện',
        }
        widgets = {
            'phone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '0987654321'}),
            'address': forms.Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'Địa chỉ thường trú'}),
            'avatar': forms.FileInput(attrs={'class': 'form-control'}),
        }

    def clean_avatar(self):
        avatar = self.cleaned_data.get('avatar')
        if avatar and hasattr(avatar, 'size'):
            if avatar.size > 2 * 1024 * 1024: # 2MB limit
                raise forms.ValidationError("Dung lượng ảnh không được vượt quá 2MB.")
            extension = avatar.name.split('.')[-1].lower()
            if extension not in ['jpg', 'jpeg', 'png', 'webp']:
                raise forms.ValidationError("Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, JPEG, PNG, WEBP.")
        return avatar


class UserAddressForm(forms.ModelForm):
    class Meta:
        model = UserAddress
        fields = ['full_name', 'phone', 'city', 'district', 'address', 'is_default']
        labels = {
            'full_name': 'Họ và tên người nhận',
            'phone': 'Số điện thoại nhận hàng',
            'city': 'Tỉnh / Thành phố',
            'district': 'Quận / Huyện',
            'address': 'Địa chỉ chi tiết (Số nhà, ngõ, đường, phường/xã)',
            'is_default': 'Đặt làm địa chỉ nhận hàng mặc định',
        }
        widgets = {
            'full_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'VD: Nguyễn Văn A'}),
            'phone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'VD: 0987654321'}),
            'city': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'VD: Hà Nội'}),
            'district': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'VD: Cầu Giấy'}),
            'address': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'VD: Số 123 Đường Cầu Giấy, P. Dịch Vọng'}),
            'is_default': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class CouponApplyForm(forms.Form):
    code = forms.CharField(
        label="Mã giảm giá",
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nhập mã ưu đãi (VD: FLOWERSALE10)',
            'style': 'text-transform: uppercase;'
        })
    )


class OrderCreateForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = ['first_name', 'last_name', 'phone', 'email', 'address', 'city', 'postal_code', 'payment_method', 'notes']
        labels = {
            'first_name': 'Họ',
            'last_name': 'Tên người nhận',
            'phone': 'Số điện thoại',
            'email': 'Email nhận thông báo',
            'address': 'Địa chỉ giao hàng chi tiết',
            'city': 'Tỉnh / Thành phố',
            'postal_code': 'Mã bưu chính',
            'payment_method': 'Phương thức thanh toán',
            'notes': 'Lời chúc đính kèm hoặc ghi chú giao hoa',
        }
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nguyễn'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Văn A'}),
            'phone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '0987654321'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'name@example.com'}),
            'address': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Số 123 đường ABC, phường XYZ'}),
            'city': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Hà Nội'}),
            'postal_code': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '100000'}),
            'payment_method': forms.RadioSelect(),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Ví dụ: Tặng sinh nhật mẹ (Nội dung thiệp: Chúc mẹ luôn tươi trẻ), giao hoa trước 10h sáng...'}),
        }


class ProductReviewForm(forms.ModelForm):
    class Meta:
        model = ProductReview
        fields = ['rating', 'comment']
        labels = {
            'rating': 'Mức độ hài lòng',
            'comment': 'Đánh giá chi tiết',
        }
        widgets = {
            'rating': forms.HiddenInput(),
            'comment': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Hoa có tươi không? Giao hàng đúng giờ chứ? Hãy chia sẻ cảm nhận thực tế của bạn...'
            }),
        }
