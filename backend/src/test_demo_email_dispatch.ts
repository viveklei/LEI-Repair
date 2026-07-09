import prisma from '../src/config/db';
import { NotificationService } from '../src/services/notification.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environmental variables from production root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runDemoJobEmail() {
  const email = 'samirkrdev@gmail.com';
  console.log(`🚀 Starting demo dispatch job email simulation to ${email}...`);
  console.log(`SMTP Settings: USER=${process.env.SMTP_USER || 'Not Set'} | HOST=${process.env.SMTP_HOST || 'Not Set'}`);

  try {
    // Generate unique Track ID sequence
    const year = new Date().getFullYear();
    const count = await prisma.serviceJob.count();
    const seqStr = String(count + 1).padStart(4, '0');
    const trackId = `FRND-${year}-${seqStr}`;

    console.log(`Generating HTML email template for trackId: ${trackId}...`);
    const dispatchHtml = NotificationService.getJobDispatchedHtmlTemplate(
      'Samir Kumar',                     // Customer Name
      'Samir Dev Testing Lab',           // Company Name
      trackId,                           // Track ID
      'Raycus',                          // Brand
      '3kW',                             // Power
      'DHL Express',                     // Courier
      'AWB9876543210',                  // AWB Number
      'https://frnd.leip.co.in'          // Website URL
    );

    console.log('Dispatching email via NotificationService.sendSMTPHtmlEmail fallback wrapper...');
    
    // We call the sender function directly to test the connection settings
    await (NotificationService as any).sendSMTPHtmlEmail(email, `🚀 Laser Source Dispatched - ${trackId}`, dispatchHtml);
    console.log('✅ Demo dispatch notification email successfully processed and sent.');
  } catch (err: any) {
    console.error('❌ Failed to run demo dispatch email simulation:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runDemoJobEmail();
