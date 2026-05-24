import './setupEnv';
import { users } from '../../packages/db';
import { getTableConfig } from 'drizzle-orm/pg-core';

console.log('KEYS:', Object.keys(users));
console.log('SYMBOL KEYS:', Object.getOwnPropertySymbols(users).map(s => s.toString()));
console.log('UNDER SCORE:', Object.keys(users._ || {}));
console.log('TABLE NAME:', (users as any).tableName);
console.log('UNDER NAME:', (users as any)._?.name);
try {
  console.log('GET TABLE CONFIG:', getTableConfig(users).name);
} catch (err) {
  console.log('GET TABLE CONFIG FAILED:', err);
}
