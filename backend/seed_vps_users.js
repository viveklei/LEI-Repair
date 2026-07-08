// VPS Seed Script - Seeds all roles and users from local database
// Run with: node seed_vps_users.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('[*] Seeding roles...');

  const roles = [
    { name: 'ADMIN',     description: 'Full system administrator access' },
    { name: 'ENGINEER',  description: 'Service engineer access for diagnostic and repair logs' },
    { name: 'ACCOUNTS',  description: 'Financial access for quotations, invoicing, and payments' },
    { name: 'SUPPORT',   description: 'Customer support access for registering jobs and logging comments' },
    { name: 'CUSTOMER',  description: 'Client view-only portal access' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
    console.log(`  [+] Role: ${role.name}`);
  }

  console.log('\n[*] Seeding users...');

  const users = [
    {
      name: 'Manikandan',
      email: 'admin@fsrms.com',
      passwordHash: '$2a$10$6aJhm7CruJdus2ltm/nJRuDroWt3JRBb/n76fOA0M90pwHmtb.O1e',
      roleName: 'ADMIN',
    },
    {
      name: 'Mohan',
      email: 'engineer@fsrms.com',
      passwordHash: '$2a$10$FlSdSZXWwjGoO.Tf4hvBp..IsWELo7S9jfDOEE/oInvaefYTBNXh.',
      roleName: 'ENGINEER',
    },
    {
      name: 'Dinesh N',
      email: 'accounts@fsrms.com',
      passwordHash: '$2a$10$6aJhm7CruJdus2ltm/nJRuhtdI7HjNUn3BjRjkaT5U21LF.vY5kCq',
      roleName: 'ACCOUNTS',
    },
    {
      name: 'Govindha',
      email: 'support@fsrms.com',
      passwordHash: '$2a$10$UHPVbDHHWLdk.29c4NAczeZVRB9Lqbow3QgeDYsjgZNt0Phy2.Z9.',
      roleName: 'SUPPORT',
    },
  ];

  for (const user of users) {
    const role = await prisma.role.findUnique({ where: { name: user.roleName } });
    if (!role) { console.error(`  [!] Role not found: ${user.roleName}`); continue; }

    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash: user.passwordHash, roleId: role.id, isDeleted: false },
      create: { name: user.name, email: user.email, passwordHash: user.passwordHash, roleId: role.id, isDeleted: false },
    });
    console.log(`  [+] User: ${user.name} (${user.email}) - ${user.roleName}`);
  }

  console.log('\n[SUCCESS] All roles and users seeded successfully!');
  console.log('\nLogin credentials (same as local device):');
  console.log('  admin@fsrms.com    → same password as your local device');
  console.log('  engineer@fsrms.com → same password as your local device');
  console.log('  accounts@fsrms.com → same password as your local device');
  console.log('  support@fsrms.com  → same password as your local device');
}

main()
  .catch(e => { console.error('[ERROR]', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
