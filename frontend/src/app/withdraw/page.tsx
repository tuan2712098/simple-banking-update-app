import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navigation from '../../components/Navigation';

// Giữ URL cũ để giải thích thay vì thao tác trừ tiền trên web.
export default function WithdrawPage() {
  return <ProtectedRoute allowRoles={['customer']}>
    <main className="dashboard-page">
      <Navigation title="Rút tiền tại ATM hoặc quầy" />
      <section className="dashboard-content">
        <div className="page-card" style={{ maxWidth: 720, margin: '24px auto', padding: 30 }}>
          <h2>Rút tiền mặt tại ATM hoặc quầy giao dịch</h2>
          <p>Simple Banking App chưa kết nối hệ thống ATM và nghiệp vụ chi tiền mặt. Vì vậy, ứng dụng không thực hiện rút tiền mặt trực tiếp để tránh trừ số dư nhưng không chi tiền.</p>
          <p>Các giao dịch chuyển khoản và lịch sử tài khoản vẫn hoạt động bình thường.</p>
          <Link href="/dashboard" className="primary-submit" style={{ display:'inline-block',textAlign:'center',marginTop:12,textDecoration:'none',padding:'12px 24px' }}>Về tổng quan</Link>
        </div>
      </section>
    </main>
  </ProtectedRoute>;
}
