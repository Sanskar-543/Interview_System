import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Neon pooler (-pooler) blocks DDL & custom type extensions. Convert pooler URL to direct URL for migrations.
  const directUrl = databaseUrl.replace('-pooler', '');

  console.log('Connecting to database for automated migrations...');
  const client = new Client({ connectionString: directUrl });

  try {
    await client.connect();
    console.log('Enabling pgvector extension if not present...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        console.log(`Applying migration: ${file}`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        // Split by statement-breakpoint if present
        const statements = sqlContent
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const statement of statements) {
          await client.query(statement);
        }
      }
    }
    console.log('✅ Database migrations applied successfully!');
  } catch (err) {
    console.error('❌ Failed to apply database migrations:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
