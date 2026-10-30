import unittest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class ApiTests(unittest.TestCase):
    def test_health(self):
        r = client.get('/health')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['training_data'], 'synthetic-demo')

    def test_spending_api(self):
        r = client.post('/predict/spending', json={'descriptions': ['cafe highlands', 'mua vé xem phim']})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()['items']), 2)

    def test_fraud_api(self):
        r = client.post('/predict/fraud', json={'transactions': [
            {'amount_vnd': 150000, 'avg_amount_vnd': 200000, 'hour': 13,
             'recent_count_24h': 1, 'new_recipient': False, 'history_count': 20}
        ]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()['items']), 1)

    def test_fraud_personal_baseline(self):
        base = {'avg_amount_vnd': 200000, 'std_amount_vnd': 30000, 'hour': 13,
                'recent_count_24h': 1, 'new_recipient': False, 'history_count': 12}
        r = client.post('/predict/fraud', json={'transactions': [
            {**base, 'amount_vnd': 210000}, {**base, 'amount_vnd': 5000000}]})
        normal, odd = r.json()['items']
        self.assertFalse(normal['is_anomaly'])
        self.assertTrue(odd['is_anomaly'])
        self.assertEqual(odd['reference'], 'personal-baseline')

    def test_invalid(self):
        self.assertEqual(client.post('/predict/spending', json={'descriptions':['x'*241]}).status_code, 422)
        self.assertEqual(client.post('/predict/fraud', json={'transactions': [
            {'amount_vnd': -100, 'avg_amount_vnd': 200000, 'hour': 13,
             'recent_count_24h': 1, 'new_recipient': False, 'history_count': 20}
        ]}).status_code, 422)

if __name__ == '__main__': unittest.main()
