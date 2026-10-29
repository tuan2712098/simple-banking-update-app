import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/entities/transaction.entity';

type CategoryPrediction = { category: string; label: string; confidence: number; needs_review: boolean };
type FraudPrediction = {
  is_anomaly: boolean; status: string; anomaly_score: number;
  reasons: string[]; model: string; reference: string;
};
type FraudFeature = {
  amount_vnd: number; avg_amount_vnd: number; hour: number;
  recent_count_24h: number; new_recipient: boolean; history_count: number;
};

function amountNumber(amount: string): number {
  const value = Number(amount);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 1e12) : 0;
}

function monthRange(value?: string) {
  const now = new Date(Date.now() + 7 * 3600000);
  const month = value || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('month must be YYYY-MM');
  const [year, part] = month.split('-').map(Number);
  // Múi giờ Việt Nam UTC+07:00, không có DST.
  const start = new Date(Date.UTC(year, part - 1, 1) - 7 * 3600000);
  const end = new Date(Date.UTC(year, part, 1) - 7 * 3600000);
  return { month, start, end };
}

function vietnamHour(date: Date): number {
  return new Date(date.getTime() + 7 * 3600000).getUTCHours();
}

function maskAccount(value?: string | null): string {
  if (!value) return 'Không xác định';
  return `••••${value.slice(-4)}`;
}

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly config: ConfigService,
  ) {}

  private async predict<T>(path: string, payload: unknown): Promise<{ items: T[]; model: string; training_data: string }> {
    const base = this.config.get<string>('AI_SERVICE_URL', 'http://127.0.0.1:8008');
    let serviceUrl: URL;
    try { serviceUrl = new URL(base); } catch { throw new ServiceUnavailableException('Cấu hình AI_SERVICE_URL không hợp lệ'); }
    // Chỉ cho phép kết nối tới AI cục bộ, không gửi dữ liệu cá nhân sang máy chủ bên ngoài.
    if (serviceUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(serviceUrl.hostname)) {
      throw new ServiceUnavailableException('AI service must run on localhost');
    }
    try {
      const response = await fetch(new URL(path, serviceUrl), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error(`AI service status ${response.status}`);
      const data = await response.json() as { items?: T[]; model?: string; training_data?: string };
      if (!Array.isArray(data.items)) throw new Error('Malformed AI response');
      return { items: data.items, model: data.model || 'unknown', training_data: data.training_data || 'unknown' };
    } catch {
      throw new ServiceUnavailableException('Dịch vụ AI chưa chạy. Khởi động ai-service trên cổng 8008.');
    }
  }

  async getSpending(userId: string, value?: string) {
    const { month, start, end } = monthRange(value);
    const accounts = await this.accounts.find({ where: { user: { id: userId } }, select: { id: true } });
    if (!accounts.length) return {
      month, total: 0, analyzed: 0, limited: false, categories: [], transactions: [],
      model: 'TF-IDF + LogisticRegression', trainingData: 'curated-demo',
      notice: 'Chỉ tính giao dịch tiền ra đã hoàn thành của tài khoản đăng nhập.',
    };
    const rows = await this.transactions.createQueryBuilder('t')
      .leftJoinAndSelect('t.fromAccount', 'source')
      .leftJoinAndSelect('t.toAccount', 'destination')
      .leftJoinAndSelect('destination.user', 'recipient')
      .where('source.id IN (:...accountIds)', { accountIds: accounts.map(account => account.id) })
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('t.type IN (:...types)', { types: [TransactionType.TRANSFER, TransactionType.WITHDRAWAL] })
      .andWhere('t.createdAt >= :start AND t.createdAt < :end', { start, end })
      .orderBy('t.createdAt', 'DESC').take(251).getMany();
    const external = rows.filter(row => row.toAccount?.user?.id !== userId);
    const selected = external.slice(0, 200);
    const predictions = selected.length
      ? (await this.predict<CategoryPrediction>('/predict/spending', {
          descriptions: selected.map(tx => tx.type === TransactionType.WITHDRAWAL ? 'rút tiền mặt' : tx.description || ''),
        })).items
      : [];
    if (predictions.length !== selected.length) throw new ServiceUnavailableException('AI response length mismatch');
    const categories = new Map<string, { category: string; label: string; total: number; count: number }>();
    const transactions = selected.map((tx, index) => {
      const prediction = tx.type === TransactionType.WITHDRAWAL
        ? { category: 'rut_tien', label: 'Rút tiền mặt', confidence: 1, needs_review: false }
        : predictions[index];
      const amount = amountNumber(tx.amount);
      const old = categories.get(prediction.category) || { category: prediction.category, label: prediction.label, total: 0, count: 0 };
      old.total += amount;
      old.count++;
      categories.set(prediction.category, old);
      return {
        id: tx.id, amount, description: tx.description || '(Không có nội dung)', createdAt: tx.createdAt,
        category: prediction.category, categoryLabel: prediction.label,
        confidence: prediction.confidence, needsReview: prediction.needs_review,
      };
    });
    return {
      month, total: transactions.reduce((sum, tx) => sum + tx.amount, 0), analyzed: selected.length,
      limited: external.length > 200 || rows.length > 250,
      categories: [...categories.values()].sort((a, b) => b.total - a.total),
      transactions, model: 'TF-IDF + LogisticRegression', trainingData: 'curated-demo',
      notice: 'Tính theo giao dịch tiền ra đã hoàn thành, loại trừ chuyển khoản nội bộ giữa tài khoản cùng chủ. Mô hình demo có thể phân loại sai; chuyển khoản cá nhân không nhất thiết là tiêu dùng.',
    };
  }

  async getFraudOverview() {
    // Chỉ Admin qua JwtAuthGuard + RolesGuard; không thay trạng thái giao dịch/khóa tài khoản.
    const rows = await this.transactions.createQueryBuilder('t')
      .leftJoinAndSelect('t.fromAccount', 'source')
      .leftJoinAndSelect('t.toAccount', 'destination')
      .where('t.type = :type', { type: TransactionType.TRANSFER })
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .orderBy('t.createdAt', 'DESC').take(500).getMany();
    const ordered = rows.reverse();
    const history = new Map<string, { times: number[]; amounts: number[]; recipients: Set<string> }>();
    const calculated = ordered.map(tx => {
      const sender = tx.fromAccount?.id || 'unknown';
      const receiver = tx.toAccount?.id || 'unknown';
      const past = history.get(sender) || { times: [], amounts: [], recipients: new Set<string>() };
      const timestamp = new Date(tx.createdAt).getTime();
      const amount = amountNumber(tx.amount);
      const recent = past.times.filter(time => time >= timestamp - 86400000).length;
      const average = past.amounts.length ? past.amounts.reduce((a, b) => a + b, 0) / past.amounts.length : amount;
      const features: FraudFeature = {
        amount_vnd: amount, avg_amount_vnd: average, hour: vietnamHour(new Date(tx.createdAt)),
        recent_count_24h: recent, new_recipient: !past.recipients.has(receiver), history_count: past.amounts.length,
      };
      past.times.push(timestamp); past.amounts.push(amount); past.recipients.add(receiver);
      history.set(sender, past);
      return { transaction: tx, features };
    });
    const mostRecent = calculated.slice(-80).reverse();
    const predictions = mostRecent.length
      ? (await this.predict<FraudPrediction>('/predict/fraud', { transactions: mostRecent.map(row => row.features) })).items
      : [];
    if (predictions.length !== mostRecent.length) throw new ServiceUnavailableException('AI response length mismatch');
    const transactions = mostRecent.map(({ transaction: tx, features }, index) => ({
      id: tx.id, createdAt: tx.createdAt, amount: amountNumber(tx.amount),
      fromAccount: maskAccount(tx.fromAccount?.accountNumber),
      toAccount: maskAccount(tx.toAccount?.accountNumber),
      anomaly: predictions[index].is_anomaly, status: predictions[index].status,
      anomalyScore: predictions[index].anomaly_score, reasons: predictions[index].reasons,
      historyCount: features.history_count,
    }));
    return {
      scanned: transactions.length, sourceCount: rows.length, sampled: rows.length === 500,
      suspicious: transactions.filter(t => t.anomaly).length,
      transactions: transactions.sort((a, b) => Number(b.anomaly) - Number(a.anomaly)),
      model: 'IsolationForest', trainingData: 'synthetic-demo',
      notice: 'AI chỉ phát hiện điểm bất thường so với dữ liệu tham chiếu giả lập, KHÔNG khẳng định gian lận. Không tự động chặn hay khóa giao dịch.',
    };
  }
}
