import prisma from './config/db';

async function test() {
  try {
    console.log('Fetching all service reports...');
    const reports = await prisma.serviceReport.findMany({
      include: {
        job: true,
        engineer: true
      }
    });

    console.log(`Found ${reports.length} service reports:`);
    for (const r of reports) {
      console.log(`- ID: ${r.id}, Job Track ID: ${r.job.trackId}, Engineer: ${r.engineer.name}, pdfUrl: ${r.pdfUrl}`);
    }
  } catch (err) {
    console.error('Error fetching service reports:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
