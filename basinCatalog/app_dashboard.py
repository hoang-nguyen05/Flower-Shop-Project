import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta, timezone
import boto3
from pyiceberg.table import StaticTable
import json

# Cấu hình giao diện Streamlit
st.set_page_config(
    page_title="FlowerShop - Basin Catalog Big Data Analytics",
    page_icon="🌸",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Cấu hình R2 / Basin Catalog của Giảng viên
R2_ACCOUNT_ID = "de1d7518f067890180f66ad877cb6b2c"
R2_ACCESS_KEY_ID = "987ecfb4cc6819e35a2f8581955e7e64"
R2_SECRET_ACCESS_KEY = "1abbbc86bf0b7fafb94f74ba40e9a9b768b4ba295e92f9d0866c33fffe9acebf"
R2_BUCKET = "visitors"
TARGET_GROUP = "Nhóm 07 CNTTK22L"

@st.cache_data(ttl=60)
def load_iceberg_data():
    """Truy vấn dữ liệu thời gian thực từ bảng Apache Iceberg trên Cloudflare R2 qua PyIceberg."""
    try:
        s3 = boto3.client(
            service_name="s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto"
        )

        paginator = s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(
            Bucket=R2_BUCKET,
            Prefix="__r2_data_catalog/01a1332e-237d-7a62-bb4a-b31986a85db9/01a1332e-2466-73e0-ab71-19de52394b0f/metadata/"
        )
        
        meta_files = []
        for page in pages:
            for obj in page.get("Contents", []):
                if obj["Key"].endswith(".metadata.json"):
                    meta_files.append((obj["LastModified"], obj["Key"]))

        if not meta_files:
            return None, "Không tìm thấy file metadata Iceberg trên R2."

        meta_files.sort(reverse=True)
        latest_metadata_key = meta_files[0][1]

        properties = {
            "s3.endpoint": f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            "s3.access-key-id": R2_ACCESS_KEY_ID,
            "s3.secret-access-key": R2_SECRET_ACCESS_KEY,
            "s3.region": "auto"
        }

        tbl = StaticTable.from_metadata(f"s3://{R2_BUCKET}/{latest_metadata_key}", properties=properties)
        df = tbl.scan().to_pandas()

        # Chuẩn hóa thời gian ingest
        if "__ingest_ts" in df.columns:
            df["ingest_time"] = pd.to_datetime(df["__ingest_ts"], utc=True)
        elif "time" in df.columns:
            df["ingest_time"] = pd.to_datetime(df["time"], unit="ms", utc=True)
        else:
            df["ingest_time"] = pd.to_datetime(datetime.now(timezone.utc))

        # Chuẩn hóa device
        if "device" in df.columns:
            df["device"] = df["device"].fillna("desktop").astype(str).str.lower()
            df["device"] = df["device"].replace({
                "ios": "mobile",
                "android": "mobile",
                "windows": "desktop",
                "mac": "desktop"
            })
            df.loc[~df["device"].isin(["mobile", "desktop", "tablet"]), "device"] = "desktop"

        # Chuẩn hóa country
        if "country" in df.columns:
            df["country"] = df["country"].fillna("VN").astype(str).str.upper()

        return df, None
    except Exception as e:
        return None, str(e)

# Giao diện Sidebar
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/flower.png", width=64)
    st.title("Big Data Pipeline")
    st.markdown("**Cloudflare Basin Catalog & PyIceberg**")
    st.divider()

    st.subheader("Bộ Lọc Dữ Liệu")
    time_filter = st.selectbox(
        "Khoảng thời gian thống kê:",
        ["24 Giờ Gần Nhất (Đề Bài Yêu Cầu)", "48 Giờ Qua", "7 Ngày Qua", "Toàn Bộ Dữ Liệu"]
    )

    if st.button("🔄 Làm Mới Dữ Liệu R2", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    st.divider()
    st.markdown("### Nhóm Tác Giả Dự Án")
    st.caption("**Nhóm 07 CNTTK22L**")
    st.markdown("""
    - **Nguyễn Đắc Hoàng** *(Lead Dev - DTC235200306)*
    - Nguyễn Huy Hoàng *(DTC235200308)*
    - Vi Anh Quân *(DTC235200621)*
    - Dương Tuấn Hoàng *(DTC235200298)*
    - Lường Thị Hạnh *(DTC235280149)*
    - Nông Lâm Ngọc Sơn *(DTC235200655)*
    - Hoàng Bắc *(DTC235200059)*
    """)

    st.divider()
    st.caption("Khóa học: Điện toán đám mây & Dữ liệu lớn")
    st.caption("Catalog: `default.visitors` | R2 Bucket: `visitors`")

# Tiêu đề chính
st.title("🌸 Báo Cáo Phân Tích Dữ Liệu Lượt Truy Cập (Basin Catalog)")
st.markdown("Hệ thống trực quan hóa dữ liệu lớn xây dựng bằng **Python + PyIceberg + Streamlit** theo mô hình kiến trúc của Giảng viên.")

# Tải dữ liệu từ PyIceberg
with st.spinner("Đang kết nối Cloudflare R2 và tải dữ liệu Apache Iceberg qua PyIceberg..."):
    df_all, err = load_iceberg_data()

if err or df_all is None:
    st.error(f"Lỗi khi tải dữ liệu từ Basin Catalog Iceberg: {err}")
    st.stop()

# Lọc theo Nhóm 07
df_group = df_all[df_all["id"].astype(str).str.contains("07|nhóm 07", case=False, na=False)].copy()

# Lọc theo thời gian
now_utc = datetime.now(timezone.utc)
if "24 Giờ" in time_filter:
    cutoff = now_utc - timedelta(hours=24)
    df_filtered = df_group[df_group["ingest_time"] >= cutoff]
    period_label = "24 giờ qua"
elif "48 Giờ" in time_filter:
    cutoff = now_utc - timedelta(hours=48)
    df_filtered = df_group[df_group["ingest_time"] >= cutoff]
    period_label = "48 giờ qua"
elif "7 Ngày" in time_filter:
    cutoff = now_utc - timedelta(days=7)
    df_filtered = df_group[df_group["ingest_time"] >= cutoff]
    period_label = "7 ngày qua"
else:
    df_filtered = df_group
    period_label = "toàn bộ thời gian"

# Nếu nhóm 07 trong 24h chưa đủ mẫu, hiển thị tổng hợp để biểu đồ trực quan
total_visits = len(df_filtered)
if total_visits == 0 and len(df_group) > 0:
    st.info("Trong 24h qua nhóm chưa phát sinh thêm lượt truy cập mới, tự động mở rộng hiển thị các bản ghi gần nhất của nhóm.")
    df_filtered = df_group.tail(100)
    total_visits = len(df_filtered)

# 1. TRẢ LỜI CÁC CÂU HỎI CỦA THẦY TRÊN BẢNG BẰNG METRIC CARDS
st.markdown("### 📌 Kết Quả Trả Lời 3 Câu Hỏi Đề Bài (Trên Bảng)")
c1, c2, c3, c4 = st.columns(4)

top_country = df_filtered["country"].mode()[0] if not df_filtered.empty and "country" in df_filtered else "VN"
top_device = df_filtered["device"].mode()[0] if not df_filtered.empty and "device" in df_filtered else "desktop"

with c1:
    st.metric(
        label="1. Tổng lượt truy cập website (24h)",
        value=f"{total_visits:,} lượt",
        delta="Realtime Stream"
    )

with c2:
    st.metric(
        label="2. Quốc gia truy cập hàng đầu",
        value=f"{top_country} (Việt Nam)",
        delta=f"{len(df_filtered[df_filtered['country'] == top_country])} lượt" if total_visits > 0 else "0"
    )

with c3:
    st.metric(
        label="3. Thiết bị sử dụng nhiều nhất",
        value=f"{top_device.capitalize()}",
        delta=f"{len(df_filtered[df_filtered['device'] == top_device])} lượt" if total_visits > 0 else "0"
    )

with c4:
    st.metric(
        label="Hạ tầng Basin Catalog",
        value="Apache Iceberg",
        delta="Cloudflare R2"
    )

st.divider()

# 2. VẼ CÁC BIỂU ĐỒ TRỰC QUAN THEO SƠ ĐỒ TRÊN BẢNG (PIE, BAR, TIMELINE)
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("🌍 Phân Bố Lượt Truy Cập Theo Quốc Gia")
    if not df_filtered.empty and "country" in df_filtered:
        country_counts = df_filtered["country"].value_counts().reset_index()
        country_counts.columns = ["Quốc Gia", "Số Lượt"]
        fig_pie = px.pie(
            country_counts,
            names="Quốc Gia",
            values="Số Lượt",
            hole=0.45,
            color_discrete_sequence=px.colors.sequential.RdBu
        )
        fig_pie.update_layout(margin=dict(t=20, b=20, l=20, r=20), height=350)
        st.plotly_chart(fig_pie, use_container_width=True)
    else:
        st.info("Chưa có dữ liệu quốc gia.")

with col_right:
    st.subheader("📱 Phân Bố Lượt Truy Cập Theo Thiết Bị")
    if not df_filtered.empty and "device" in df_filtered:
        device_counts = df_filtered["device"].value_counts().reset_index()
        device_counts.columns = ["Thiết Bị", "Số Lượt"]
        color_map = {"mobile": "#e63946", "desktop": "#457b9d", "tablet": "#2a9d8f"}
        fig_bar = px.bar(
            device_counts,
            x="Thiết Bị",
            y="Số Lượt",
            color="Thiết Bị",
            color_discrete_map=color_map,
            text="Số Lượt"
        )
        fig_bar.update_layout(margin=dict(t=20, b=20, l=20, r=20), height=350, showlegend=False)
        st.plotly_chart(fig_bar, use_container_width=True)
    else:
        st.info("Chưa có dữ liệu thiết bị.")

# 3. BIỂU ĐỒ DIỄN BIẾN THEO THỜI GIAN (TIMELINE)
st.subheader("📈 Xu Hướng Lượt Truy Cập Theo Thời Gian (24 Giờ Gần Nhất)")
if not df_filtered.empty and "ingest_time" in df_filtered:
    df_filtered["hour"] = df_filtered["ingest_time"].dt.floor("H")
    timeline = df_filtered.groupby("hour").size().reset_index(name="Lượt Truy Cập")
    fig_line = px.area(
        timeline,
        x="hour",
        y="Lượt Truy Cập",
        labels={"hour": "Thời Gian", "Lượt Truy Cập": "Lượt Truy Cập"},
        color_discrete_sequence=["#e63946"]
    )
    fig_line.update_layout(margin=dict(t=20, b=20, l=20, r=20), height=300)
    st.plotly_chart(fig_line, use_container_width=True)
else:
    st.info("Chưa có dữ liệu timeline.")

st.divider()

# 4. BẢNG DỮ LIỆU GỐC TỪ APACHE ICEBERG & CÂU TRUY VẤN
st.subheader("📋 Bảng Ghi Nhận Dữ Liệu Thời Gian Thực (PyIceberg Scan)")
st.caption("Dữ liệu được trích xuất trực tiếp từ file Parquet trong Apache Iceberg Table `default.visitors` trên Cloudflare R2.")

display_cols = [c for c in ["__ingest_ts", "id", "country", "device", "ip", "meta"] if c in df_filtered.columns]
st.dataframe(
    df_filtered[display_cols].sort_values(by="__ingest_ts", ascending=False).head(50),
    use_container_width=True
)

st.markdown("""
**Câu lệnh truy vấn tương đương tại Basin Catalog (SQL):**
```sql
SELECT country, device, COUNT(*) AS visits
FROM default.visitors
WHERE id = 'Nhóm 07 CNTTK22L'
  AND _ingest_ts >= NOW() - INTERVAL 24 HOUR
GROUP BY country, device
ORDER BY visits DESC;
```
""")
