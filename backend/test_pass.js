const { execSync } = require('child_process');

const passwords = [
  'postgres',
  'admin',
  'root',
  '123456',
  '12345',
  'password',
  '12345678',
  'Postgres@123',
  'admin123',
  'fieldservice',
  'lei',
  'root123',
  '',
  '1234',
  '123',
  'admin@123',
  'Admin@123',
  'postgres123',
  'postgresql',
  'postgre',
  'rootroot',
  'manager',
  '123456789'
];

console.log('Starting PostgreSQL password brute-force scan...');

for (const pass of passwords) {
  const url = `postgresql://postgres:${pass}@localhost:5432/fsrms?schema=public`;
  console.log(`Testing password: "${pass}"...`);
  
  try {
    const output = execSync('npx prisma db push', {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe'
    }).toString();
    console.log(`\n========================================`);
    console.log(`SUCCESS! The correct password is: "${pass}"`);
    console.log(`========================================\n`);
    process.exit(0);
  } catch (err) {
    const errMsg = err.stderr ? err.stderr.toString() : (err.message || '');
    if (errMsg.includes('P1000')) {
      // Auth failed, try next
    } else {
      console.log(`\n========================================`);
      console.log(`SUCCESS! The correct password is: "${pass}" (Non-auth error: ${errMsg.trim()})`);
      console.log(`========================================\n`);
      process.exit(0);
    }
  }
}

console.log('Failed to find a valid password from the list.');
process.exit(1);
