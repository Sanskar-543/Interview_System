import { db, users } from '@ai-interviewer/db';
import { eq } from 'drizzle-orm';

async function grantProAccess() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('❌ Please provide a user email or user ID.\nUsage: npx tsx --env-file=.env scripts/grant-pro.ts user@example.com');
    process.exit(1);
  }

  console.log(`🔍 Searching for user: ${identifier}...`);

  // Check if identifier is email or user ID
  const isEmail = identifier.includes('@');
  const queryCondition = isEmail ? eq(users.email, identifier.trim().toLowerCase()) : eq(users.id, identifier.trim());

  const [existingUser] = await db.select().from(users).where(queryCondition).limit(1);

  if (!existingUser) {
    console.error(`❌ User "${identifier}" was not found in the database.`);
    process.exit(1);
  }

  // Update user plan to 'paid' (premium access)
  const [updatedUser] = await db.update(users)
    .set({
      plan: 'paid',
      updatedAt: new Date(),
    })
    .where(eq(users.id, existingUser.id))
    .returning();

  console.log(`\n🎉 PREMIUM ACCESS GRANTED SUCCESSFULLY!`);
  console.log(`----------------------------------------`);
  console.log(`  User ID:    ${updatedUser.id}`);
  console.log(`  Name:       ${updatedUser.name}`);
  console.log(`  Email:      ${updatedUser.email}`);
  console.log(`  New Plan:   PRO / PREMIUM (${updatedUser.plan.toUpperCase()}) 🌟`);
  console.log(`----------------------------------------\n`);

  process.exit(0);
}

grantProAccess().catch((err) => {
  console.error('❌ Error granting premium access:', err);
  process.exit(1);
});
