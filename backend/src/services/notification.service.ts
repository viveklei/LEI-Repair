import fs from 'fs';
import path from 'path';
import prisma from '../config/db';

const NOTIFICATIONS_LOG_PATH = path.join(__dirname, '..', '..', 'public', 'notifications.log');

// Ensure log directory exists
const dir = path.dirname(NOTIFICATIONS_LOG_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export class NotificationService {
  private static logNotification(type: 'WHATSAPP' | 'EMAIL', recipient: string, message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] To: ${recipient} | Message: ${message}\n`;
    fs.appendFileSync(NOTIFICATIONS_LOG_PATH, logEntry);
    console.log(`\n📢 [MOCK NOTIFICATION - ${type}] To: ${recipient}\nMessage: ${message}\n`);
  }

  static async sendWhatsAppUpdate(jobId: string, status: string, customerName: string, trackId: string, mobileNumber: string) {
    const portalUrl = `http://localhost:5173/portal?trackId=${trackId}`;
    let message = `Hello ${customerName}, your fiber laser source repair job (${trackId}) status is now: ${status.replace('_', ' ')}. `;
    
    if (status === 'RECEIVED') {
      message += `We have successfully received your laser source. You can track progress here: ${portalUrl}`;
    } else if (status === 'VISUAL_INSPECTION' || status === 'INITIAL_DIAGNOSIS') {
      message += `Our service engineers are currently inspecting the laser source. Check real-time timeline: ${portalUrl}`;
    } else if (status === 'QUOTATION_GENERATED') {
      message += `A quotation has been generated. Please review and approve it on the customer portal: ${portalUrl}`;
    } else if (status === 'CUSTOMER_APPROVAL') {
      message += `Your job is awaiting approval. Review quote here: ${portalUrl}`;
    } else if (status === 'REPAIR_INITIATED' || status === 'UNDER_REPAIR') {
      message += `Repair work has started. Our engineer is working on the optical/diodes alignment. Status link: ${portalUrl}`;
    } else if (status === 'WAITING_SPARE_PARTS') {
      message += `⚠️ Repair is on hold waiting for spare parts to arrive. We will notify you once parts are received. Status link: ${portalUrl}`;
    } else if (status === 'TESTING_BURN_IN') {
      message += `Repair completed! The source is now undergoing our mandatory 6-step testing & burn-in phase. Progress: ${portalUrl}`;
    } else if (status === 'READY_FOR_DISPATCH') {
      message += `Your laser source has successfully passed all burn-in tests! It is ready for dispatch pending payment clearance. portal: ${portalUrl}`;
    } else if (status === 'DISPATCHED') {
      message += `🚀 Your repaired laser source has been dispatched! Track courier shipment details here: ${portalUrl}`;
    } else {
      message += `Job is updated. Track live status: ${portalUrl}`;
    }

    // Write to DB
    await prisma.notification.create({
      data: {
        jobId,
        type: 'WHATSAPP',
        recipient: mobileNumber,
        message,
        sentStatus: 'SENT',
      },
    });

    this.logNotification('WHATSAPP', mobileNumber, message);
  }

  static async sendEmailUpdate(jobId: string, email: string, subject: string, htmlContent: string) {
    // Write to DB
    await prisma.notification.create({
      data: {
        jobId,
        type: 'EMAIL',
        recipient: email,
        message: `${subject} - [HTML content simulation]`,
        sentStatus: 'SENT',
      },
    });

    this.logNotification('EMAIL', email, `${subject}\nContent: ${htmlContent.substring(0, 150)}...`);
  }
}
