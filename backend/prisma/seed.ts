import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create roles
  const roles = [
    { name: 'ADMIN', description: 'Full system administrator access' },
    { name: 'ENGINEER', description: 'Service engineer access for diagnostic and repair logs' },
    { name: 'ACCOUNTS', description: 'Financial access for quotations, invoicing, and payments' },
    { name: 'SUPPORT', description: 'Customer support access for registering jobs and logging comments' },
    { name: 'CUSTOMER', description: 'Client view-only portal access' },
  ];

  const createdRoles: Record<string, any> = {};
  for (const role of roles) {
    const dbRole = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    createdRoles[role.name] = dbRole;
    console.log(`Role ${role.name} created.`);
  }

  // Create default users
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@123', salt);
  const engineerPassword = await bcrypt.hash('Engineer@123', salt);
  const accountsPassword = await bcrypt.hash('Accounts@123', salt);
  const supportPassword = await bcrypt.hash('Support@123', salt);

  const users = [
    {
      email: 'admin@fsrms.com',
      name: 'System Administrator',
      passwordHash: adminPassword,
      roleId: createdRoles['ADMIN'].id,
    },
    {
      email: 'engineer@fsrms.com',
      name: 'Senior Engineer John Doe',
      passwordHash: engineerPassword,
      roleId: createdRoles['ENGINEER'].id,
    },
    {
      email: 'accounts@fsrms.com',
      name: 'Accounts Specialist Jane',
      passwordHash: accountsPassword,
      roleId: createdRoles['ACCOUNTS'].id,
    },
    {
      email: 'support@fsrms.com',
      name: 'Support Representative Sam',
      passwordHash: supportPassword,
      roleId: createdRoles['SUPPORT'].id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
    console.log(`User ${user.name} (${user.email}) created.`);
  }

  // Seed default spare parts inventory
  const spareParts = [
    { partName: 'Pump Diode (Raycus 135W)', manufacturer: 'Raycus', quantity: 45, cost: 480.00, stockLevel: 10 },
    { partName: 'QBH Connector Assembly', manufacturer: 'IPG', quantity: 12, cost: 850.00, stockLevel: 3 },
    { partName: 'Laser Module (IPG 1kW)', manufacturer: 'IPG', quantity: 5, cost: 2200.00, stockLevel: 2 },
    { partName: 'Optical Collimator Lens', manufacturer: 'Maxphotonics', quantity: 18, cost: 350.00, stockLevel: 5 },
    { partName: 'Control Board V3.2', manufacturer: 'Raycus', quantity: 8, cost: 680.00, stockLevel: 2 },
    { partName: 'BWT Pump Source 915nm', manufacturer: 'BWT', quantity: 22, cost: 550.00, stockLevel: 5 },
    { partName: 'Deionized Water Flow Sensor', manufacturer: 'Other', quantity: 25, cost: 120.00, stockLevel: 6 },
    { partName: 'QBH Output Protective Window', manufacturer: 'JPT', quantity: 30, cost: 95.00, stockLevel: 8 },
  ];

  for (const part of spareParts) {
    await prisma.sparePart.create({
      data: part,
    });
  }
  console.log('Seeded spare parts.');

  // Create a default customer and laser source for demo purposes
  const customer = await prisma.customer.create({
    data: {
      companyName: 'Laser Tech Solutions Ltd',
      customerName: 'Robert Paulson',
      mobileNumber: '+919876543210',
      email: 'robert@lasertech.com',
      address: 'Industrial Area Phase 1, New Delhi, Delhi 110020',
      gstNumber: '07AAAAA1111A1Z1',
      contactPerson: 'Robert Paulson',
    }
  });
  console.log('Sample Customer created.');

  const laser = await prisma.laserSource.create({
    data: {
      brand: 'Raycus',
      modelNumber: 'RFL-C3000S',
      serialNumber: 'R3000S99182',
      powerRating: '3kW',
      mfgYear: 2024,
      machineManufacturer: 'Han\'s Laser',
      machineModel: 'G3015F',
      sourceType: 'Single Module',
    }
  });
  console.log('Sample Laser Source created.');

  // Create a sample service job (RECEIVED)
  const sequence = '00001';
  const trackId = `FSR-2026-${sequence}`;
  await prisma.serviceJob.create({
    data: {
      trackId,
      customerId: customer.id,
      laserSourceId: laser.id,
      complaintCategory: 'Low Output Power',
      complaintDescription: 'Output power dropped from 3kW to less than 1.2kW suddenly during welding operations. Alarm E08 triggered.',
      receivingNotes: 'Outer protective optical window has visual dust deposits. QBH cap was missing upon receipt.',
      status: 'RECEIVED',
    }
  });
  console.log(`Sample Job ${trackId} created.`);

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
