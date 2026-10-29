"""Chạy trực tiếp: python demo_ai.py (không cần Backend/DB)."""
from models import predict_fraud, predict_spending

print("=== AI PHÂN LOẠI CHI TIÊU ===")
for description, result in zip(
    ["Cafe Highlands", "thanh toán tiền điện", "mua giày trên shopee", "gửi tiền cho mẹ", "qwertyxyz"],
    predict_spending(["Cafe Highlands", "thanh toán tiền điện", "mua giày trên shopee", "gửi tiền cho mẹ", "qwertyxyz"]),
):
    print(f"{description:28} => {result['label']:22} (độ tin cậy mô hình: {result['confidence']:.1%})")

print("\n=== AI PHÁT HIỆN BẤT THƯỜNG ===")
items = [
    {"amount_vnd": 250_000, "avg_amount_vnd": 350_000, "hour": 12, "recent_count_24h": 2, "new_recipient": False, "history_count": 30},
    {"amount_vnd": 18_000_000, "avg_amount_vnd": 350_000, "hour": 2, "recent_count_24h": 12, "new_recipient": True, "history_count": 30},
]
for item, result in zip(items, predict_fraud(items)):
    print(f"{item['amount_vnd']:>12,.0f} VND => {result['status']}; chỉ số bất thường = {result['anomaly_score']}")
    print("  Dấu hiệu:", "; ".join(result["reasons"]))
print("\nLƯU Ý: dữ liệu huấn luyện giả lập, chưa xác thực hiệu quả trên dữ liệu ngân hàng thật.")
