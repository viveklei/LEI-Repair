import prisma from '../src/config/db';
import { NotificationService } from '../src/services/notification.service';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export async function runManagerApprovalCheck() {
  console.log('⏰ Running daily pending manager approvals digest check...');
  
  try {
    // 1. Query all PENDING_APPROVAL verification records
    const pendingVerifications = await prisma.verification.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        job: {
          include: {
            customer: true,
            laserSource: true
          }
        }
      }
    });

    if (pendingVerifications.length === 0) {
      console.log('✅ No pending manager approvals found. Skipping digest transmission.');
      return;
    }

    console.log(`⚠️ Found ${pendingVerifications.length} pending manager approvals. Preparing digest data...`);

    // 2. Format list items for HTML table
    const now = new Date();
    const digestItems = pendingVerifications.map((v) => {
      const createdDate = new Date(v.createdAt);
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const daysPending = Math.floor(diffTime / (1000 * 60 * 60 * 24)) || 1; // Fallback to 1 if < 24h

      return {
        trackId: v.job.trackId,
        companyName: v.job.customer.companyName,
        brand: v.job.laserSource.brand,
        powerRating: v.job.laserSource.powerRating,
        verifiedBy: v.verifiedBy,
        daysPending: daysPending
      };
    });

    // 3. Compile HTML Template
    const websiteUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace(':5000', ':5173') : 'https://frnd.leip.co.in';
    const digestHtml = NotificationService.getManagerApprovalsDigestHtmlTemplate(digestItems, websiteUrl);

    // 4. Fetch all Admin / Manager email recipients
    const adminUsers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN'] }, isDeleted: false }
    });

    const recipientEmails = adminUsers.map(u => u.email).filter(Boolean);
    
    // Add fallback if no admin emails retrieved
    if (recipientEmails.length === 0 && process.env.SMTP_USER) {
      recipientEmails.push(process.env.SMTP_USER);
    }

    if (recipientEmails.length === 0) {
      console.log('⚠️ No active admin/manager recipient emails found. Skipping SMTP dispatch.');
      return;
    }

    console.log(`✉️ Sending pending approvals digest to admins: ${recipientEmails.join(', ')}...`);

    // 5. Send SMTP email
    const useSMTP = process.env.SMTP_USER && process.env.SMTP_PASS;
    if (!useSMTP) {
      console.log('⚠️ SMTP credentials not configured. Skipping SMTP transmission.');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    const hasLogo = require('fs').existsSync(logoPath);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"LEI System Alert" <${process.env.SMTP_USER}>`,
      to: recipientEmails.join(', '),
      subject: `⚠️ Action Required: ${pendingVerifications.length} QC Approvals Pending`,
      attachments: hasLogo ? [{
        filename: 'logo.png',
        path: logoPath,
        cid: 'logo'
      }] : [],
      html: digestHtml
    });

    console.log('✅ Daily pending manager approvals digest sent successfully.');
  } catch (err: any) {
    console.error('❌ Error processing daily pending approvals check:', err.message);
  }
}
