import os
import time
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
BUCKET = os.getenv("R2_BUCKET", "")
ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
USE_SAMPLE = os.getenv("USE_SAMPLE", "0") == "1"
GROUP_ID = os.getenv("GROUP_ID", "Nhóm 07 CNTTK22L")
R2_ENDPOINT = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"


def sample_events() -> pd.DataFrame:
    now_ms = int(time.time() * 1000)
    rows = [
        {"id": GROUP_ID, "country": "VN", "device": "mobile", "time": now_ms - i * 3600_000, "ip": f"14.232.208.{i % 20}"}
        for i in range(45)
    ] + [
        {"id": GROUP_ID, "country": "VN", "device": "desktop", "time": now_ms - i * 5400_000, "ip": f"113.190.234.{i % 15}"}
        for i in range(35)
    ] + [
        {"id": GROUP_ID, "country": "SG", "device": "tablet", "time": now_ms - i * 7200_000, "ip": f"103.253.145.{i % 10}"}
        for i in range(15)
    ] + [
        {"id": "nhóm khác", "country": "US", "device": "desktop", "time": now_ms - i * 1800_000, "ip": f"198.51.100.{i % 10}"}
        for i in range(30)
    ]
    return pd.DataFrame(rows)


def latest_metadata_key(s3) -> str:
    keys = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
        keys += [o["Key"] for o in page.get("Contents", []) if o["Key"].endswith(".metadata.json")]
    if not keys:
        raise ValueError(f"Không tìm thấy file .metadata.json nào trong bucket '{BUCKET}'")
    return sorted(keys)[-1]


def iceberg_events() -> pd.DataFrame:
    import boto3
    from pyiceberg.table import StaticTable

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        region_name="auto",
    )
    meta_key = latest_metadata_key(s3)
    table = StaticTable.from_metadata(
        f"s3://{BUCKET}/{meta_key}",
        properties={
            "s3.endpoint": R2_ENDPOINT,
            "s3.access-key-id": ACCESS_KEY_ID,
            "s3.secret-access-key": SECRET_ACCESS_KEY,
            "s3.region": "auto",
        },
    )
    return table.scan(selected_fields=("id", "country", "device", "time", "ip")).to_pandas()


@st.cache_data(ttl=60)
def load_events() -> pd.DataFrame:
    df = sample_events() if USE_SAMPLE else iceberg_events()
    
    # Chuẩn hóa cột time sang kiểu datetime UTC
    if pd.api.types.is_numeric_dtype(df["time"]):
        df["time"] = pd.to_datetime(df["time"], unit="ms", utc=True)
    else:
        df["time"] = pd.to_datetime(df["time"], utc=True)
    
    # Chuyển đổi sang múi giờ Việt Nam (UTC+7) để hiển thị trực quan
    df["time_vn"] = df["time"].dt.tz_convert("Asia/Ho_Chi_Minh")
    return df


# -------------------------------------------------------------
# CẤU HÌNH GIAO DIỆN STREAMLIT
# -------------------------------------------------------------
st.set_page_config(
    page_title="Thống Kê Truy Cập Basin Catalog - Nhóm 07",
    page_icon="📊",
    layout="wide"
)

st.title("📊 Thống Kê & Trực Quan Hóa Lượt Truy Cập (Basin Catalog)")
st.caption("Dữ liệu lưu trữ trong Apache Iceberg trên Cloudflare R2 | Nhóm 07 CNTTK22L (Lead: Nguyễn Đắc Hoàng)")

if USE_SAMPLE:
    st.info("💡 Đang chạy ở chế độ Dữ liệu mẫu (USE_SAMPLE=1). Đặt USE_SAMPLE=0 trong file `.env` để kết nối kho Iceberg thật.")

try:
    raw_df = load_events()
except Exception as e:
    st.error(f"❌ Lỗi khi đọc dữ liệu từ R2 Iceberg: {e}")
    st.info("Đang tự động chuyển sang chế độ dữ liệu mẫu để bạn tiếp tục kiểm thử giao diện...")
    raw_df = sample_events()
    raw_df["time"] = pd.to_datetime(raw_df["time"], unit="ms", utc=True)
    raw_df["time_vn"] = raw_df["time"].dt.tz_convert("Asia/Ho_Chi_Minh")

# -------------------------------------------------------------
# SIDEBAR: BỘ LỌC ĐÁP ỨNG YÊU CẦU 1 & YÊU CẦU 2 CỦA THẦY
# -------------------------------------------------------------
st.sidebar.header("🔍 Bộ Lọc Dữ Liệu")

# YÊU CẦU 1: Lấy ra thống kê của nhóm mình (dựa trên ID định danh, không lấy nhóm khác)
st.sidebar.subheader("1. Lọc theo Nhóm (Yêu cầu 1)")
group_filter_mode = st.sidebar.radio(
    "Chọn phạm vi nhóm:",
    options=[
        "Chỉ nhóm mình (Nhóm 07 CNTTK22L)",
        "Tất cả dữ liệu Nhóm 07 (Bao gồm bài lab/test)",
        "Tất cả các nhóm (Toàn trường)"
    ],
    index=0,
    help="Yêu cầu 1 của Thầy: Lấy ra thống kê riêng của nhóm mình dựa trên ID định danh."
)

if group_filter_mode == "Chỉ nhóm mình (Nhóm 07 CNTTK22L)":
    filtered_df = raw_df[raw_df["id"] == GROUP_ID].copy()
elif group_filter_mode == "Tất cả dữ liệu Nhóm 07 (Bao gồm bài lab/test)":
    filtered_df = raw_df[raw_df["id"].astype(str).str.contains("07", case=False, na=False)].copy()
else:
    filtered_df = raw_df.copy()

# YÊU CẦU 2: Thống kê theo khoảng thời gian: 24h qua, 7 ngày qua (tuần), 30 ngày qua (tháng)
st.sidebar.subheader("2. Khoảng thời gian (Yêu cầu 2)")
time_range = st.sidebar.radio(
    "Chọn khung thời gian:",
    options=[
        "24 giờ qua",
        "7 ngày qua (Tuần qua)",
        "30 ngày qua (Tháng qua)",
        "Toàn bộ thời gian"
    ],
    index=0,
    help="Yêu cầu 2 của Thầy: Bổ sung thống kê theo 24 giờ qua, tuần qua (7 ngày), tháng qua (30 ngày)."
)

now_utc = pd.Timestamp.now(tz="UTC")
if time_range == "24 giờ qua":
    cutoff = now_utc - pd.Timedelta(hours=24)
    filtered_df = filtered_df[filtered_df["time"] >= cutoff]
    resample_freq = "1h"
    resample_label = "giờ"
elif time_range == "7 ngày qua (Tuần qua)":
    cutoff = now_utc - pd.Timedelta(days=7)
    filtered_df = filtered_df[filtered_df["time"] >= cutoff]
    resample_freq = "6h"
    resample_label = "khoảng 6 giờ"
elif time_range == "30 ngày qua (Tháng qua)":
    cutoff = now_utc - pd.Timedelta(days=30)
    filtered_df = filtered_df[filtered_df["time"] >= cutoff]
    resample_freq = "1D"
    resample_label = "ngày"
else:
    resample_freq = "1D"
    resample_label = "ngày"

if st.sidebar.button("🔄 Làm mới dữ liệu từ R2", use_container_width=True):
    st.cache_data.clear()
    st.rerun()

# -------------------------------------------------------------
# PHẦN 1: CÁC CHỈ SỐ TỔNG QUAN (METRICS)
# -------------------------------------------------------------
total_views = len(filtered_df)
unique_ips = filtered_df["ip"].nunique() if total_views > 0 else 0
unique_countries = filtered_df["country"].nunique() if total_views > 0 else 0
top_device = filtered_df["device"].mode()[0] if total_views > 0 and not filtered_df["device"].empty else "N/A"

st.markdown(f"#### 📌 Trạng thái: **{group_filter_mode}** | Thời gian: **{time_range}**")

m1, m2, m3, m4 = st.columns(4)
m1.metric("Tổng lượt truy cập", f"{total_views:,}")
m2.metric("Số IP duy nhất (Visitors)", f"{unique_ips:,}")
m3.metric("Số quốc gia", f"{unique_countries:,}")
m4.metric("Thiết bị phổ biến nhất", str(top_device).upper())

st.divider()

# -------------------------------------------------------------
# PHẦN 2: YÊU CẦU 3 - BIỂU ĐỒ ĐƯỜNG (LINE CHART) BIẾN ĐỘNG THEO THỜI GIAN
# -------------------------------------------------------------
st.subheader("📈 3. Biểu đồ đường (Line Chart): Biến động lượt truy cập theo thời gian")
st.caption(f"Thể hiện số lượt truy cập được nhóm theo từng **{resample_label}** trong khoảng thời gian **{time_range.lower()}**.")

if total_views > 0:
    # Chuẩn bị dữ liệu chuỗi thời gian (Time-series)
    ts_df = filtered_df.copy()
    ts_df = ts_df.set_index("time_vn")
    
    # 1. Biểu đồ đường tổng hợp và phân tách theo loại thiết bị
    device_pivot = ts_df.pivot_table(
        index=pd.Grouper(freq=resample_freq),
        columns="device",
        values="ip",
        aggfunc="count",
        fill_value=0
    )
    
    # Thêm cột tổng cộng nếu muốn xem tổng quan
    total_line = ts_df.groupby(pd.Grouper(freq=resample_freq))["ip"].count().rename("Tổng lượt truy cập")
    
    chart_tab1, chart_tab2 = st.tabs(["📉 Tổng lượt truy cập theo thời gian", "📱 Phân tách theo thiết bị"])
    with chart_tab1:
        st.line_chart(total_line)
    with chart_tab2:
        st.line_chart(device_pivot)
else:
    st.warning("⚠️ Không có lượt truy cập nào của nhóm trong khoảng thời gian đã chọn.")
    if group_filter_mode == "Chỉ nhóm mình (Nhóm 07 CNTTK22L)":
        st.info("💡 Bạn có thể chọn 'Tất cả dữ liệu Nhóm 07 (Bao gồm bài lab/test)' ở cột bên trái để xem biểu đồ đầy đủ của các buổi thực hành trước, hoặc truy cập website để tạo thêm lượt truy cập mới!")

st.divider()

# -------------------------------------------------------------
# PHẦN 3: PHÂN BỐ THEO QUỐC GIA & THIẾT BỊ (BAR CHARTS)
# -------------------------------------------------------------
col_left, col_right = st.columns(2)
with col_left:
    st.subheader("🌍 Phân bố theo Quốc gia")
    if total_views > 0:
        country_counts = filtered_df["country"].value_counts()
        st.bar_chart(country_counts)
    else:
        st.write("Không có dữ liệu.")

with col_right:
    st.subheader("💻 Phân bố theo Thiết bị")
    if total_views > 0:
        device_counts = filtered_df["device"].value_counts()
        st.bar_chart(device_counts)
    else:
        st.write("Không có dữ liệu.")

st.divider()

# -------------------------------------------------------------
# PHẦN 4: BẢNG DỮ LIỆU CHI TIẾT (LOGS TỪ ICEBERG)
# -------------------------------------------------------------
st.subheader("📋 Dữ liệu chi tiết từ Apache Iceberg")
st.caption(f"Hiển thị {total_views} bản ghi đã lọc")

if total_views > 0:
    display_df = filtered_df[["time_vn", "id", "country", "device", "ip"]].sort_values("time_vn", ascending=False)
    display_df.columns = ["Thời gian (VN)", "Mã định danh (ID)", "Quốc gia", "Thiết bị", "Địa chỉ IP"]
    st.dataframe(display_df, use_container_width=True, hide_index=True)
    
    # Nút tải dữ liệu CSV
    csv_data = display_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="📥 Tải xuống dữ liệu (CSV)",
        data=csv_data,
        file_name=f"thong_ke_truy_cap_{GROUP_ID.replace(' ', '_')}_{time_range.replace(' ', '_')}.csv",
        mime="text/csv"
    )
