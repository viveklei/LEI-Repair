import prisma from '../src/config/db';
import { NotificationService } from '../src/services/notification.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environmental variables from production root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runDemoJobEmail() {
  const email = 'samirkrdev@gmail.com';
  console.log(`🚀 Starting demo job email simulation to ${email}...`);
  console.log(`SMTP Settings: USER=${process.env.SMTP_USER || 'Not Set'} | HOST=${process.env.SMTP_HOST || 'Not Set'}`);

  try {
    // Generate unique Track ID sequence
    const year = new Date().getFullYear();
    const count = await prisma.serviceJob.count();
    const seqStr = String(count + 1).padStart(4, '0');
    const trackId = `FRND-${year}-${seqStr}`;

    console.log(`Generating HTML email template for trackId: ${trackId}...`);
    const inwardHtml = NotificationService.getJobInwardHtmlTemplate(
      'Samir Kumar',                     // Customer Name
      'Samir Dev Testing Lab',           // Company Name
      trackId,                           // Track ID
      'Raycus',                          // Brand
      '3kW',                             // Power
      'Diode Fault (Simulation Test)',   // Complaint Category
      'https://frnd.leip.co.in',         // Website URL
      email                              // Registered email
    );

    console.log('Dispatching email via NotificationService.sendSMTPHtmlEmail fallback wrapper...');
    // Calls sendEmailUpdate internally which records to DB and transmits via nodemailer
    // Create a mock/real job reference if available, or just mock the log write
    const fallbackJobId = 'demo-test-job-uuid-12345';
    
    // We call the sender function directly to test the connection settings
    await (NotificationService as any).sendSMTPHtmlEmail(email, `🛠️ Job Inward Registered - ${trackId}`, inwardHtml);
    console.log('✅ Demo job notification email successfully processed and sent.');
  } catch (err: any) {
    console.error('❌ Failed to run demo job email simulation:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runDemoJobEmail();
