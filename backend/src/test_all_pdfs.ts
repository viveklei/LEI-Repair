import prisma from './config/db';
import { PdfService } from './services/pdf.service';

async function test() {
  try {
    console.log('Fetching a quotation...');
    const quotation = await prisma.quotation.findFirst({
      include: { items: true }
    });
    
    if (quotation) {
      console.log(`Found quotation ID: ${quotation.id}. Fetching associated job...`);
      const job = await prisma.serviceJob.findUnique({
        where: { id: quotation.jobId },
        include: { customer: true, laserSource: true }
      });
      if (job) {
        console.log('Generating quotation PDF...');
        const result = await PdfService.generateQuotationPdf(quotation, job, quotation.items);
        console.log(`Quotation PDF successfully generated! Saved at: ${result}`);
      }
    } else {
      console.log('No quotation found.');
    }

    console.log('Fetching a service report...');
    const report = await prisma.serviceReport.findFirst({
      include: { job: { include: { customer: true, laserSource: true } }, engineer: true }
    });

    if (report) {
      console.log(`Found service report ID: ${report.id}. Querying test results & parts...`);
      const tests = await prisma.testResult.findFirst({
        where: { jobId: report.jobId, result: 'PASS' }
      });
      
      const repairs = await prisma.repair.findMany({
        where: { jobId: report.jobId },
        include: { partsUsed: { include: { sparePart: true } } }
      });
      const parts: any[] = [];
      repairs.forEach((r) => {
        parts.push(...r.partsUsed);
      });

      console.log('Generating service report PDF...');
      const result = await PdfService.generateServiceReportPdf(report, report.job, tests || {}, parts);
      console.log(`Service Report PDF successfully generated! Saved at: ${result}`);
    } else {
      console.log('No service report found.');
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
