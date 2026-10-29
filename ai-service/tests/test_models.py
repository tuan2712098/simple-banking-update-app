import unittest
from models import predict_fraud, predict_spending

class ModelsTests(unittest.TestCase):
    def test_categories(self):
        examples = ["cafe highlands", "thanh toán tiền điện", "đặt vé xe bus", "mua vé xem phim", "chuyển tiền cho mẹ", "shopee đơn hàng"]
        actual = [x['category'] for x in predict_spending(examples)]
        self.assertEqual(actual, ["an_uong", "hoa_don", "di_chuyen", "giai_tri", "ca_nhan", "mua_sam"])

    def test_unknown_text(self):
        self.assertEqual(predict_spending(["qwertyxyz"])[0]["category"], "khong_ro")

    def test_anomaly(self):
        rows = [
            {"amount_vnd": 250_000, "avg_amount_vnd": 350_000, "hour": 12, "recent_count_24h": 2, "new_recipient": False, "history_count": 30},
            {"amount_vnd": 18_000_000, "avg_amount_vnd": 350_000, "hour": 2, "recent_count_24h": 12, "new_recipient": True, "history_count": 30},
        ]
        results = predict_fraud(rows)
        self.assertFalse(results[0]["is_anomaly"])
        self.assertTrue(results[1]["is_anomaly"])
        self.assertEqual(results[1]["reference"], "synthetic-demo")

    def test_empty(self):
        self.assertEqual(predict_spending([]), [])
        self.assertEqual(predict_fraud([]), [])

if __name__ == '__main__': unittest.main()
