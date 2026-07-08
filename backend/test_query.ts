import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('Fetching all jobs...');
  const jobs = await prisma.serviceJob.findMany();
  console.log(`Found ${jobs.length} jobs.`);
  
  if (jobs.length > 0) {
    const id = jobs[0].id;
    console.log(`Querying job details for ID: ${id}...`);
    try {
      const job = await prisma.serviceJob.findFirst({
        where: { id, isDeleted: false },
        include: {
          customer: true,
          laserSource: true,
          inspections: { include: { engineer: true } },
          quotations: { include: { items: true } },
          repairs: { include: { engineer: true, partsUsed: { include: { sparePart: true } } } },
          testResults: { include: { engineer: true } },
          serviceReports: { include: { engineer: true } },
          payments: true,
          dispatches: true,
          files: true,
          auditLogs: { include: { user: true }, orderBy: { timestamp: 'asc' } }
        }
      });
      console.log('✓ Query success! Job details:', JSON.stringify(job, null, 2).substring(0, 500) + '...');
    } catch (e: any) {
      console.error('❌ Query failed with error:', e);
    }
  }
  await prisma.$disconnect();
}

run();
