import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { dataSource } from './db';
import { demoEmail, FIRST_ACCOUNT, SECOND_ACCOUNT, requireSafeBatchDatabase, SENDER_COUNT } from './batch-poc-fixtures';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Account, AccountStatus, AccountTier } from '../src/accounts/entities/account.entity';
import { LedgerEntry, LedgerEntryType } from '../src/ledger/entities/ledger-entry.entity';

async function main() {
  requireSafeBatchDatabase();
  await dataSource.initialize();
  try {
    const passwordHash = await bcrypt.hash('BankFlowTest@2026', 12);
    let created = 0;
    await dataSource.transaction(async (manager) => {
      for (let index = 1; index <= SENDER_COUNT + 2; index++) {
        const email = index <= SENDER_COUNT ? demoEmail(index) : `bankflow-batch-receiver-${index - SENDER_COUNT}@example.test`;
        const number = index <= SENDER_COUNT ? `98000000${index.toString().padStart(4, '0')}` : index === 101 ? FIRST_ACCOUNT : SECOND_ACCOUNT;
        const opening = index <= SENDER_COUNT ? '1000000.00' : '0.00';
        let user = await manager.getRepository(User).findOne({ where: { email } });
        if (!user) {
          user = await manager.save(User, manager.create(User, {
            fullName: index <= SENDER_COUNT ? `Batch Sender ${index}` : `Batch Receiver ${index - SENDER_COUNT}`,
            email, passwordHash, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE,
          }));
          created++;
        }
        let account = await manager.getRepository(Account).findOne({ where: { user: { id: user.id } } });
        if (!account) {
          const existingNumber = await manager.getRepository(Account).findOne({ where: { accountNumber: number } });
          if (existingNumber) throw new Error(`Account number ${number} is already owned by another user`);
          account = await manager.save(Account, manager.create(Account, {
            user, accountNumber: number, balance: opening, holdAmount: '0.00', currency: 'VND',
            status: AccountStatus.ACTIVE, tier: AccountTier.STANDARD,
          }));
          if (opening !== '0.00') {
            await manager.getRepository(LedgerEntry).insert({
              account, transaction: null, type: LedgerEntryType.CREDIT,
              amount: opening, balanceAfter: opening, reference: 'opening',
            });
          }
        } else if (account.accountNumber !== number) {
          throw new Error(`User ${email} already has a different account number`);
        }
      }
    });
    console.log(`TEST SEED PASS: ${SENDER_COUNT} senders, 2 recipients; created ${created} users; existing accounts were not reset`);
  } finally {
    await dataSource.destroy();
  }
}
main().catch((error) => { console.error('TEST SEED FAIL:', error.message); process.exitCode = 1; });
