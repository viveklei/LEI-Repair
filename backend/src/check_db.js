const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const job = await prisma.serviceJob.findFirst({
    where: { id: '13e7ba47-6c9d-4f93-a168-dd223d88cd66' },
    include: {
      customer: true,
      laserSource: true,
      currentEngineer: true,
      inspections: { include: { engineer: true } },
      quotations: { include: { items: true } },
      repairs: { include: { engineer: true, partsUsed: { include: { sparePart: true } } } },
      testResults: { include: { engineer: true } },
      serviceReports: { include: { engineer: true } },
      payments: true,
      dispatches: true,
      qcAssessment: true
    }
  });
  console.log(JSON.stringify(job, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
