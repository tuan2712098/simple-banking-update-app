"""Hai mô hình ML phục vụ bài thực tập, huấn luyện từ dữ liệu giả lập công khai.

- TF-IDF ký tự + LogisticRegression: phân loại *nội dung* giao dịch.
- IsolationForest: phát hiện giao dịch nằm ngoài phân phối hành vi mô phỏng.
Điểm bất thường không phải xác suất gian lận, không dùng để từ chối giao dịch.
"""
from __future__ import annotations

import math
import re
from typing import TypedDict

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

CATEGORIES = {
    "an_uong": "Ăn uống",
    "mua_sam": "Mua sắm",
    "hoa_don": "Hóa đơn & tiện ích",
    "di_chuyen": "Di chuyển",
    "giai_tri": "Giải trí",
    "ca_nhan": "Chuyển khoản cá nhân",
}

EXAMPLES = {
    "an_uong": [
        "ăn cơm trưa", "cafe highlands", "cà phê buổi sáng", "thanh toán quán phở", "ăn tối nhà hàng", "mua bánh mì", "mua trà sữa",
        "tiền bữa ăn", "đặt đồ ăn grabfood", "cơm văn phòng", "đồ uống trà chanh", "lẩu cuối tuần", "mua cà phê",
        "bún bò huế", "mì cay", "trả tiền ăn sáng", "đi ăn buffet", "thanh toán cơm gà", "cửa hàng bánh ngọt",
    ],
    "mua_sam": [
        "mua áo quần", "shopee đơn hàng", "thanh toán tiki", "lazada mua đồ", "mua giày mới", "mua điện thoại", "siêu thị mua sắm",
        "mua đồ gia dụng", "đặt hàng online", "thanh toán cửa hàng quần áo", "mua máy tính", "phụ kiện điện thoại",
        "mua sách", "mua bàn phím", "trả tiền đồ dùng học tập", "mua túi xách", "đơn hàng shopee mall",
    ],
    "hoa_don": [
        "thanh toán tiền điện", "đóng tiền nước", "tiền internet", "hóa đơn wifi", "trả cước điện thoại", "nạp điện thoại",
        "đóng học phí", "phí dịch vụ chung cư", "thanh toán truyền hình", "đóng phí bảo hiểm", "trả tiền điện tháng 5",
        "tiền điện lực", "thanh toán hóa đơn", "trả cước mạng", "cước thuê bao viettel", "đóng tiền phòng",
    ],
    "di_chuyen": [
        "đổ xăng", "tiền taxi", "grab xe máy", "mua vé xe bus", "mua vé máy bay", "đặt vé tàu", "phí gửi xe",
        "thanh toán xe công nghệ", "taxi xanh sm", "trả tiền xăng", "vé xe khách", "tiền bảo dưỡng xe",
        "phí cao tốc", "thanh toán be bike", "đi grabcar", "vé tàu hỏa",
    ],
    "giai_tri": [
        "mua vé xem phim", "vé concert", "đăng ký netflix", "spotify premium", "đi karaoke", "tiền chơi game", "vé công viên",
        "đi xem bóng đá", "đăng ký giải trí", "mua vé hòa nhạc", "xem phim cgv", "đi du lịch tham quan",
        "mua game steam", "dịch vụ giải trí", "vé khu vui chơi", "mua vé sự kiện",
    ],
    "ca_nhan": [
        "chuyển khoản cho mẹ", "gửi tiền cho bố", "chuyển tiền cho bạn", "trả tiền mượn", "cho em tiền",
        "chuyển tiền cá nhân", "gửi tiền về quê", "thanh toán nợ người quen", "chuyển tiền hỗ trợ", "chuyển cho anh nam",
        "trả lại tiền", "mừng sinh nhật bạn", "biếu ông bà", "tiền sinh hoạt gia đình", "chuyển tiền", "gửi người thân",
    ],
}

class FraudFeatures(TypedDict):
    amount_vnd: float
    avg_amount_vnd: float
    hour: int
    recent_count_24h: int
    new_recipient: bool
    history_count: int
    std_amount_vnd: float


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())[:160]


def train_spending():
    texts, labels = [], []
    for category, examples in EXAMPLES.items():
        for phrase in examples:
            # Hai kiểu diễn đạt giao dịch, tránh chỉ khớp chuỗi chính xác.
            texts.extend([phrase, "thanh toan " + phrase, "ck " + phrase])
            labels.extend([category] * 3)
    model = make_pipeline(
        TfidfVectorizer(analyzer="char", ngram_range=(2, 5), min_df=1, sublinear_tf=True),
        LogisticRegression(max_iter=1000, random_state=42),
    )
    model.fit(texts, labels)
    return model


def fraud_vector(item: FraudFeatures) -> list[float]:
    amount = float(item["amount_vnd"])
    historical = max(1.0, float(item["avg_amount_vnd"]))
    hour = int(item["hour"])
    return [
        math.log1p(max(0.0, amount)),
        min(12.0, amount / historical),
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        min(30, int(item["recent_count_24h"])),
        int(bool(item["new_recipient"])),
    ]


def train_fraud():
    rng = np.random.default_rng(42)
    examples = []
    # Phân phối tham chiếu từ DỮ LIỆU GIẢ LẬP, không phải dữ liệu ngân hàng thực.
    for _ in range(2400):
        typical = float(np.exp(rng.normal(math.log(450_000), 0.65)))
        amount = float(np.clip(typical * rng.lognormal(0, .32), 15_000, 3_000_000))
        hour = int(rng.choice(np.arange(7, 23)))
        vector = fraud_vector({
            "amount_vnd": amount, "avg_amount_vnd": typical,
            "hour": hour, "recent_count_24h": int(min(15, rng.poisson(1.7))),
            "new_recipient": bool(rng.random() < .18), "history_count": 20,
        })
        examples.append(vector)
    scaler = StandardScaler()
    x = scaler.fit_transform(np.array(examples))
    forest = IsolationForest(n_estimators=160, contamination=.07, random_state=42)
    forest.fit(x)
    return scaler, forest


SPENDING_MODEL = train_spending()
FRAUD_SCALER, FRAUD_MODEL = train_fraud()


def predict_spending(descriptions: list[str]):
    if not descriptions:
        return []
    clean = [normalize(item) for item in descriptions]
    probabilities = SPENDING_MODEL.predict_proba(clean)
    predictions = []
    for text, row in zip(clean, probabilities):
        i = int(row.argmax())
        confidence = float(row[i])
        category = str(SPENDING_MODEL.classes_[i]) if text and confidence >= .42 else "khong_ro"
        predictions.append({
            "category": category,
            "label": CATEGORIES.get(category, "Chưa xác định"),
            "confidence": round(confidence, 3),
            "needs_review": category == "khong_ro" or confidence < .65,
        })
    return predictions


MIN_PERSONAL_HISTORY = 5


def personal_zscore(item: FraudFeatures) -> float:
    """Độ lệch so với thói quen riêng của tài khoản gửi (sàn độ lệch chuẩn = 25% mức trung bình)."""
    avg = max(1.0, float(item["avg_amount_vnd"]))
    spread = max(float(item.get("std_amount_vnd", 0.0)), 0.25 * avg)
    return (float(item["amount_vnd"]) - avg) / spread


def predict_fraud(items: list[FraudFeatures]):
    if not items:
        return []
    x = FRAUD_SCALER.transform([fraud_vector(item) for item in items])
    scores = FRAUD_MODEL.decision_function(x)
    flags = FRAUD_MODEL.predict(x)
    results = []
    for item, raw, flag in zip(items, scores, flags):
        reasons = []
        personal = item["history_count"] >= MIN_PERSONAL_HISTORY
        if personal:
            # Đủ lịch sử: so với baseline của chính tài khoản, không phụ thuộc dữ liệu giả lập.
            z = personal_zscore(item)
            anomaly = z > 3 or (z > 2 and bool(item["new_recipient"])) or (z > 1.5 and int(item["hour"]) < 5)
            score = round(z, 2)
            method = "Baseline riêng của tài khoản"
            if z > 2:
                reasons.append(f"Số tiền cao hơn khoảng {z:.1f} độ lệch chuẩn so với thói quen của tài khoản gửi")
        else:
            anomaly = int(flag) == -1
            score = round(float(-raw), 4)
            method = "IsolationForest (dữ liệu tham chiếu giả lập)"
            reasons.append("Chưa đủ lịch sử của tài khoản, dùng mô hình tham chiếu chung")
            if item["amount_vnd"] > max(1, item["avg_amount_vnd"]) * 4 and item["history_count"] >= 3:
                reasons.append("Số tiền cao hơn đáng kể mức giao dịch trước đó")
        if item["recent_count_24h"] >= 6:
            reasons.append("Tần suất giao dịch trong 24 giờ tương đối cao")
        if item["new_recipient"] and anomaly:
            reasons.append("Tài khoản nhận mới so với lịch sử đang xét")
        if int(item["hour"]) < 5 and anomaly:
            reasons.append("Thực hiện vào khung giờ ít phổ biến")
        results.append({
            "is_anomaly": anomaly,
            "status": "Cần xem xét" if anomaly else "Bình thường",
            # Chỉ số tham khảo (z-score hoặc decision_function), KHÔNG phải xác suất gian lận.
            "anomaly_score": score,
            "reasons": reasons if anomaly else [],
            "model": method,
            "reference": "personal-baseline" if personal else "synthetic-demo",
        })
    return results
