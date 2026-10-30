import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/entities/transaction.entity';

const DAY = 86400000;
const VN_OFFSET = 7 * 3600000;

type Hint = { level: 'info' | 'warn'; text: string };

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1e12) : 0;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mask(value?: string | null): string {
  return value ? `••••${value.slice(-4)}` : 'Không xác định';
}

function monthBounds(year: number, month0: number) {
  // Múi giờ Việt Nam UTC+07:00, không có DST.
  return {
    start: new Date(Date.UTC(year, month0, 1) - VN_OFFSET),
    end: new Date(Date.UTC(year, month0 + 1, 1) - VN_OFFSET),
  };
}

/**
 * Phân tích hành vi chi tiêu dựa trên số tiền, thời gian và người nhận.
 * Không phụ thuộc vào nội dung chuyển khoản vì người dùng thường ghi qua loa.
 */
@Injectable()
export class AiInsightsService {
  constructor(
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
  ) {}

  private async ownAccountIds(userId: string): Promise<string[]> {
    const rows = await this.accounts.find({ where: { user: { id: userId } }, select: { id: true } });
    return rows.map(row => row.id);
  }

  private outgoing(accountIds: string[], since: Date) {
    return this.transactions.createQueryBuilder('t')
      .leftJoinAndSelect('t.fromAccount', 'source')
      .leftJoinAndSelect('t.toAccount', 'destination')
      .leftJoinAndSelect('destination.user', 'recipient')
      .where('source.id IN (:...accountIds)', { accountIds })
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('t.type IN (:...types)', { types: [TransactionType.TRANSFER, TransactionType.WITHDRAWAL] })
      .andWhere('t.createdAt >= :since', { since })
      .orderBy('t.createdAt', 'DESC').take(2000);
  }

  async getInsights(userId: string, value?: string) {
    const nowVn = new Date(Date.now() + VN_OFFSET);
    const currentKey = `${nowVn.getUTCFullYear()}-${String(nowVn.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthKey = value || currentKey;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) throw new BadRequestException('month must be YYYY-MM');
    const [year, part] = monthKey.split('-').map(Number);
    const { start, end } = monthBounds(year, part - 1);
    const isCurrent = monthKey === currentKey;

    const empty = {
      month: monthKey, total: 0, count: 0, previousTotal: 0, averageThreeMonths: 0,
      recipients: [], recurring: [], weekdays: Array(7).fill(0), forecast: null,
    };
    const accountIds = await this.ownAccountIds(userId);
    if (!accountIds.length) return empty;

    const since = monthBounds(year, part - 7).start; // 6 tháng lịch sử trước tháng đang xem
    const rows = await this.outgoing(accountIds, since).getMany();
    // Chuyển khoản giữa các tài khoản cùng chủ không phải chi tiêu.
    const external = rows.filter(row => row.type === TransactionType.WITHDRAWAL || row.toAccount?.user?.id !== userId);

    const inRange = (row: Transaction, from: Date, to: Date) => row.createdAt >= from && row.createdAt < to;
    const monthRows = external.filter(row => inRange(row, start, end));
    const total = monthRows.reduce((sum, row) => sum + num(row.amount), 0);

    const previous = monthBounds(year, part - 2);
    const previousTotal = external.filter(row => inRange(row, previous.start, previous.end)).reduce((sum, row) => sum + num(row.amount), 0);
    const threeMonths = [1, 2, 3].map(back => {
      const range = monthBounds(year, part - 1 - back);
      return external.filter(row => inRange(row, range.start, range.end)).reduce((sum, row) => sum + num(row.amount), 0);
    });
    const averageThreeMonths = threeMonths.reduce((a, b) => a + b, 0) / 3;

    // 1. Nhóm theo người nhận.
    const byRecipient = new Map<string, { key: string; name: string; account: string; total: number; count: number }>();
    for (const row of monthRows) {
      const isCash = row.type === TransactionType.WITHDRAWAL;
      const key = isCash ? 'cash' : row.toAccount?.id || 'unknown';
      const entry = byRecipient.get(key) || {
        key, count: 0, total: 0,
        name: isCash ? 'Rút tiền mặt' : row.toAccount?.user?.fullName || 'Người nhận không xác định',
        account: isCash ? '' : mask(row.toAccount?.accountNumber),
      };
      entry.total += num(row.amount); entry.count++;
      byRecipient.set(key, entry);
    }
    const recipients = [...byRecipient.values()].sort((a, b) => b.total - a.total).slice(0, 8)
      .map(item => ({ ...item, share: total ? item.total / total : 0 }));

    // 2. Khoản chi định kỳ: cùng người nhận, số tiền gần nhau, chu kỳ đều (tuần hoặc tháng).
    const transfers = external.filter(row => row.type === TransactionType.TRANSFER && row.toAccount).reverse();
    const groups = new Map<string, Transaction[]>();
    for (const row of transfers) {
      const list = groups.get(row.toAccount!.id) || [];
      list.push(row); groups.set(row.toAccount!.id, list);
    }
    const nowMs = Date.now();
    const recurring: Array<{
      recipientId: string; name: string; account: string; period: 'weekly' | 'monthly'; periodDays: number;
      amount: number; occurrences: number; lastAt: Date; nextAt: Date; daysUntil: number;
    }> = [];
    for (const [recipientId, list] of groups) {
      if (list.length < 3) continue;
      const times = list.map(row => row.createdAt.getTime());
      const gaps = times.slice(1).map((time, i) => (time - times[i]) / DAY);
      const gap = median(gaps);
      const period = gap >= 6 && gap <= 8 ? 'weekly' : gap >= 25 && gap <= 35 ? 'monthly' : null;
      if (!period || gaps.some(g => Math.abs(g - gap) / gap > 0.3)) continue;
      const amounts = list.map(row => num(row.amount));
      const typical = median(amounts);
      if (!typical || amounts.some(a => Math.abs(a - typical) / typical > 0.25)) continue;
      const nextAt = new Date(times[times.length - 1] + gap * DAY);
      if (nextAt.getTime() < nowMs - gap * DAY * 0.5) continue; // đã ngưng
      const last = list[list.length - 1];
      recurring.push({
        recipientId, name: last.toAccount?.user?.fullName || 'Người nhận không xác định', account: mask(last.toAccount?.accountNumber),
        period, periodDays: gap, amount: typical, occurrences: list.length, lastAt: last.createdAt, nextAt,
        daysUntil: Math.ceil((nextAt.getTime() - nowMs) / DAY),
      });
    }
    recurring.sort((a, b) => a.nextAt.getTime() - b.nextAt.getTime());

    // 5. Ngày trong tuần (0 = Chủ nhật), tính theo giờ Việt Nam.
    const weekdays: number[] = Array(7).fill(0);
    for (const row of monthRows) weekdays[new Date(row.createdAt.getTime() + VN_OFFSET).getUTCDay()] += num(row.amount);

    // 3. Dự báo cuối tháng: chi tiêu thường ngày theo tốc độ hiện tại + các khoản định kỳ còn lại.
    let forecast: null | { projected: number; dailyAverage: number; recurringRemaining: number; daysLeft: number; reliable: boolean } = null;
    if (isCurrent) {
      const dayOfMonth = nowVn.getUTCDate();
      const daysInMonth = new Date(Date.UTC(year, part, 0)).getUTCDate();
      const daysLeft = daysInMonth - dayOfMonth;
      const recurringIds = new Set(recurring.map(item => item.recipientId));
      const recurringSoFar = monthRows.filter(row => row.toAccount && recurringIds.has(row.toAccount.id)).reduce((s, r) => s + num(r.amount), 0);
      const dailyAverage = (total - recurringSoFar) / dayOfMonth;
      let recurringRemaining = 0;
      for (const item of recurring) {
        for (let at = item.nextAt.getTime(); at < end.getTime(); at += item.periodDays * DAY) {
          if (at > nowMs) recurringRemaining += item.amount;
        }
      }
      forecast = {
        projected: total + dailyAverage * daysLeft + recurringRemaining,
        dailyAverage, recurringRemaining, daysLeft, reliable: dayOfMonth >= 7 && monthRows.length >= 3,
      };
    }

    return {
      month: monthKey, total, count: monthRows.length, previousTotal, averageThreeMonths,
      recipients, weekdays, forecast,
      recurring: recurring.map(({ recipientId: _id, ...item }) => item),
    };
  }

  /** Gợi ý trước khi xác nhận chuyển tiền, dựa trên thói quen của chính người gửi. */
  async checkTransfer(userId: string, toAccountNumber: string, amountRaw: string) {
    if (!/^\d{8,30}$/.test(toAccountNumber)) throw new BadRequestException('Số tài khoản không hợp lệ');
    if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(amountRaw)) throw new BadRequestException('Số tiền không hợp lệ');
    const amount = Number(amountRaw);
    const hints: Hint[] = [];
    const accountIds = await this.ownAccountIds(userId);
    if (!accountIds.length) return { level: 'ok', hints, stats: { historyCount: 0, averageAmount: 0, sentToRecipient: 0 } };

    const recipient = await this.accounts.findOne({ where: { accountNumber: toAccountNumber }, select: { id: true } });
    const rows = (await this.outgoing(accountIds, new Date(Date.now() - 90 * DAY)).getMany())
      .filter(row => row.type === TransactionType.TRANSFER);
    const amounts = rows.map(row => num(row.amount));
    const average = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
    const sentToRecipient = recipient ? rows.filter(row => row.toAccount?.id === recipient.id).length : 0;
    const last24h = rows.filter(row => row.createdAt.getTime() >= Date.now() - DAY).length;
    const hour = new Date(Date.now() + VN_OFFSET).getUTCHours();

    if (!sentToRecipient) hints.push({ level: 'info', text: 'Đây là lần đầu bạn chuyển tiền cho tài khoản này trong 90 ngày qua.' });
    if (amounts.length >= 3 && amount > average * 5) {
      hints.push({ level: 'warn', text: `Số tiền cao gấp khoảng ${Math.round(amount / Math.max(1, average))} lần mức bạn thường chuyển.` });
    } else if (amounts.length >= 3 && amount > Math.max(...amounts)) {
      hints.push({ level: 'info', text: 'Đây là số tiền lớn nhất bạn từng chuyển trong 90 ngày qua.' });
    }
    if (!sentToRecipient && amounts.length >= 3 && amount > average * 5) {
      hints.push({ level: 'warn', text: 'Người nhận mới kèm số tiền lớn là dấu hiệu thường gặp của lừa đảo. Hãy xác minh người nhận qua kênh khác trước khi chuyển.' });
    }
    if (last24h >= 5) hints.push({ level: 'warn', text: `Bạn đã chuyển ${last24h} giao dịch trong 24 giờ qua.` });
    if (hour < 5) hints.push({ level: 'info', text: 'Bạn đang chuyển tiền vào khung giờ khuya, ít khi xảy ra với tài khoản của bạn.' });

    return {
      level: hints.some(h => h.level === 'warn') ? 'warn' : hints.length ? 'info' : 'ok',
      hints, stats: { historyCount: rows.length, averageAmount: average, sentToRecipient },
    };
  }
}
