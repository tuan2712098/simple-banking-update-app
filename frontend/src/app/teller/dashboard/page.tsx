'use client';

import Link from 'next/link';
import Navigation from '../../../components/Navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import AppIcon from '../../../components/AppIcon';

export default function TellerDashboardPage() {
  return <ProtectedRoute allowRoles={['teller']}><main className="dashboard-page"><Navigation title="Tổng quan tại quầy"/>
    <section className="dashboard-content role-dashboard">
      <div className="role-hero teller-hero"><div><span className="role-kicker"><AppIcon name="building" size={16}/> KHU VỰC GIAO DỊCH VIÊN</span><h2>Bắt đầu ca làm việc</h2><p>Tiếp nhận yêu cầu, hỗ trợ nạp tiền và chuyển khoản hộ khách hàng trong môi trường mô phỏng.</p></div><Link className="role-hero-action" href="/teller/operations">Mở nghiệp vụ <AppIcon name="arrow-right" size={18}/></Link></div>
      <div className="teller-action-grid"><Link href="/teller/operations?tab=deposit" className="teller-action"><span className="role-kpi-icon mint"><AppIcon name="wallet" size={27}/></span><strong>Nạp tiền tại quầy</strong><p>Nhập số tài khoản và số tiền, thực hiện nạp tiền qua API nghiệp vụ.</p><span>Thực hiện <AppIcon name="arrow-right" size={18}/></span></Link><Link href="/teller/operations?tab=transfer" className="teller-action"><span className="role-kpi-icon sky"><AppIcon name="arrow-up-right" size={27}/></span><strong>Chuyển khoản hộ</strong><p>Chuyển tiền theo mã khách hàng, tài khoản nhận và nội dung giao dịch.</p><span>Thực hiện <AppIcon name="arrow-right" size={18}/></span></Link></div>
      <div className="role-two-col"><section className="role-panel"><div className="role-panel-head"><div><h3>Quy trình thao tác</h3><p>Gợi ý xử lý yêu cầu đúng nghiệp vụ</p></div><AppIcon name="circle-check" size={20}/></div><div className="teller-steps"><div><i>1</i><span><strong>Tiếp nhận yêu cầu</strong><small>Kiểm tra thông tin do khách hàng cung cấp.</small></span></div><div><i>2</i><span><strong>Nhập đúng dữ liệu</strong><small>Đối chiếu tài khoản và số tiền trước khi gửi.</small></span></div><div><i>3</i><span><strong>Kiểm tra kết quả</strong><small>Thông báo kết quả sau khi Backend xác nhận.</small></span></div></div></section>
        <section className="role-panel"><div className="role-panel-head"><div><h3>Quyền truy cập</h3><p>Phân tách nghiệp vụ theo vai trò</p></div><AppIcon name="shield" size={20}/></div><div className="teller-permission"><AppIcon name="check" size={18}/><span>Được sử dụng API nạp tiền và chuyển khoản hộ theo quyền Teller.</span></div><div className="teller-permission"><AppIcon name="lock" size={18}/><span>Không truy cập quản lý người dùng, đối soát và AI rủi ro dành riêng cho Admin.</span></div><p className="role-panel-hint">Hiện Backend chưa có API thống kê tác vụ toàn quầy dành cho Teller; trang này không hiển thị chỉ số nghiệp vụ giả.</p></section></div>
    </section>
  </main></ProtectedRoute>;
}
