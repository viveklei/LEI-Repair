import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import nodemailer from 'nodemailer';

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

  /** Helper to send a real SMTP email with HTML template styling */
  private static async sendSMTPHtmlEmail(email: string, subject: string, htmlContent: string) {
    const useSMTP = process.env.SMTP_USER && process.env.SMTP_PASS;
    if (!useSMTP) {
      console.log('⚠️ SMTP credentials not configured. Skipping SMTP transmission.');
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png');
      const hasLogo = fs.existsSync(logoPath);

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"LEI Service Centre" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        attachments: hasLogo ? [{
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo'
        }] : [],
        html: htmlContent
      });
      console.log(`✉️ SMTP HTML Email sent successfully to ${email}`);
    } catch (err: any) {
      console.error('❌ SMTP Email delivery failed:', err.message);
    }
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
        message: `${subject} - [HTML Content]`,
        sentStatus: 'SENT',
      },
    });

    this.logNotification('EMAIL', email, `${subject}\nContent Summary: ${htmlContent.substring(0, 150)}...`);
    await this.sendSMTPHtmlEmail(email, subject, htmlContent);
  }

  /** Formats an advanced HTML email template for inward job creation notifications */
  static getJobInwardHtmlTemplate(customerName: string, companyName: string, trackId: string, laserBrand: string, laserPower: string, complaintCategory: string, websiteUrl: string, customerEmail: string): string {
    const portalUrl = `${websiteUrl}/portal?trackId=${trackId}`;
    const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png');
    const hasLogo = fs.existsSync(logoPath);

    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #334155; line-height: 1.6;">
        <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
          
          <!-- HEADER -->
          <div style="background-color: #0f172a; padding: 24px 30px; text-align: center; border-bottom: 3px solid #3b82f6;">
            ${hasLogo ? '<img src="cid:logo" alt="Laser Experts India Logo" style="height: 48px; width: auto; vertical-align: middle; margin-bottom: 8px;" />' : ''}
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Laser Source Inward Registered</h2>
          </div>

          <!-- CONTENT BODY -->
          <div style="padding: 40px 35px;">
            <p style="margin-top: 0; font-size: 16px; color: #1e293b;">Dear <strong>${customerName}</strong> (<em>${companyName}</em>),</p>
            <p style="font-size: 15px; color: #475569;">We have successfully logged and inward-registered your fiber laser source at the <strong>Laser Experts India</strong> service hub.</p>
            
            <!-- TICKET SPEC DETAILS -->
            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 40%;">Tracking ID:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${trackId}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Laser Source:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${laserBrand} | ${laserPower}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Reported Issue:</td>
                  <td style="padding: 4px 0; color: #be123c; font-weight: 700;">${complaintCategory}</td>
                </tr>
              </table>
            </div>

            <!-- PORTAL TRACKING DETAILS -->
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px dashed #3b82f6; padding: 24px; border-radius: 12px; text-align: center; margin: 30px 0;">
              <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #2563eb; font-weight: 700; margin-bottom: 12px;">Access Live Tracking Portal</div>
              <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: 700; font-size: 13px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.25);">
                Track Repair Timeline
              </a>
              <div style="font-size: 11px; color: #475569; margin-top: 14px;">
                Alternatively, you can login on our portal using your registered email: <strong>${customerEmail}</strong> & requesting a secure Login OTP code.
              </div>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">Our service engineers will initiate the physical inspection & diagnostic sweeps. We will keep you updated in real-time as stages progress.</p>
          </div>

          <!-- FOOTER -->
          <div style="background-color: #f1f5f9; padding: 30px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">LASER EXPERTS INDIA LLP</div>
            <div style="margin-bottom: 12px; line-height: 1.4;">
              <strong>Hosur Service Center:</strong><br/>
              No. 27/3, Anumepalli, Begapalli Road, Hosur, Tamil Nadu - 635 126
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-top: 12px;">
              <strong>Support:</strong> 📞 +91 93810 72240 | ✉️ laserexpertsindiaglobal@gmail.com
            </div>
          </div>

        </div>
      </div>
    `;
  }

  /** Formats an advanced HTML email template for dispatched job completion notifications */
  static getJobDispatchedHtmlTemplate(customerName: string, companyName: string, trackId: string, laserBrand: string, laserPower: string, courierName: string, awbNumber: string, websiteUrl: string): string {
    const portalUrl = `${websiteUrl}/portal?trackId=${trackId}`;
    const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png');
    const hasLogo = fs.existsSync(logoPath);

    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #334155; line-height: 1.6;">
        <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
          
          <!-- HEADER -->
          <div style="background-color: #0f172a; padding: 24px 30px; text-align: center; border-bottom: 3px solid #10b981;">
            ${hasLogo ? '<img src="cid:logo" alt="Laser Experts India Logo" style="height: 48px; width: auto; vertical-align: middle; margin-bottom: 8px;" />' : ''}
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">🚀 Your Repaired Laser is Dispatched</h2>
          </div>

          <!-- CONTENT BODY -->
          <div style="padding: 40px 35px;">
            <p style="margin-top: 0; font-size: 16px; color: #1e293b;">Dear <strong>${customerName}</strong> (<em>${companyName}</em>),</p>
            <p style="font-size: 15px; color: #475569;">Great news! Repair verification is complete, payment clearance has been confirmed, and your fiber laser source has been securely packaged and dispatched back to you.</p>
            
            <!-- SHIPMENT SPEC DETAILS -->
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #bbf7d0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 4px 0; color: #166534; font-weight: 600; width: 40%;">Tracking ID:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${trackId}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #166534; font-weight: 600;">Laser Spec:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${laserBrand} | ${laserPower}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #166534; font-weight: 600;">Courier Service:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${courierName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #166534; font-weight: 600;">AWB tracking No:</td>
                  <td style="padding: 4px 0; color: #2563eb; font-weight: 700;">${awbNumber}</td>
                </tr>
              </table>
            </div>

            <!-- PORTAL TRACKING DETAILS -->
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px dashed #10b981; padding: 24px; border-radius: 12px; text-align: center; margin: 30px 0;">
              <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; font-weight: 700; margin-bottom: 12px;">Track Shipment Live</div>
              <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; font-weight: 700; font-size: 13px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.25);">
                Open Live Timeline
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">Thank you for trusting Laser Experts India LLP with your industrial fiber laser source repairs. Please inspect the package upon arrival and let us know if you require any installation support.</p>
          </div>

          <!-- FOOTER -->
          <div style="background-color: #f1f5f9; padding: 30px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">LASER EXPERTS INDIA LLP</div>
            <div style="margin-bottom: 12px; line-height: 1.4;">
              <strong>Hosur Service Hub:</strong><br/>
              No. 27/3, Anumepalli, Begapalli Road, Hosur, Tamil Nadu - 635 126
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-top: 12px;">
              <strong>Support Hotline:</strong> 📞 +91 93810 72240 | ✉️ laserexpertsindiaglobal@gmail.com
            </div>
          </div>

        </div>
      </div>
    `;
  }

  /** Formats a summary digest list email of all currently pending manager approvals */
  static getManagerApprovalsDigestHtmlTemplate(pendingItems: Array<{ trackId: string; companyName: string; brand: string; powerRating: string; verifiedBy: string; daysPending: number }>, websiteUrl: string): string {
    const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png');
    const hasLogo = fs.existsSync(logoPath);
    
    let tableRows = '';
    for (const item of pendingItems) {
      tableRows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 8px; font-weight: 700; color: #2563eb; font-size: 13px;">${item.trackId}</td>
          <td style="padding: 12px 8px; font-size: 13px; font-weight: 600; color: #0f172a;">${item.companyName}</td>
          <td style="padding: 12px 8px; font-size: 12px; color: #475569;">${item.brand} (${item.powerRating})</td>
          <td style="padding: 12px 8px; font-size: 12px; color: #475569;">${item.verifiedBy}</td>
          <td style="padding: 12px 8px; text-align: center;"><span style="background-color: #ffe4e6; color: #e11d48; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">${item.daysPending} days</span></td>
        </tr>
      `;
    }

    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #334155; line-height: 1.6;">
        <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
          
          <!-- HEADER -->
          <div style="background-color: #e11d48; padding: 24px 30px; text-align: center; border-bottom: 3px solid #be123c;">
            ${hasLogo ? '<img src="cid:logo" alt="Laser Experts India Logo" style="height: 48px; width: auto; vertical-align: middle; margin-bottom: 8px;" />' : ''}
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">⚠️ Action Required: Pending QC Approvals Digest</h2>
          </div>

          <!-- CONTENT BODY -->
          <div style="padding: 35px 30px;">
            <p style="margin-top: 0; font-size: 15px; color: #1e293b;">Dear <strong>Service Manager</strong>,</p>
            <p style="font-size: 14px; color: #475569;">This is a daily reminder that the following <strong>${pendingItems.length} QC verifications</strong> are waiting for your approval to proceed with customer quotation release or shipping dispatch:</p>
            
            <div style="margin: 24px 0; overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Track ID</th>
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Company</th>
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Laser Specs</th>
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Verified By</th>
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: center;">Age</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
            </div>

            <!-- PORTAL LINK -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${websiteUrl}/approvals" target="_blank" style="display: inline-block; background-color: #e11d48; color: #ffffff; padding: 12px 28px; font-weight: 700; font-size: 13px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(225, 29, 72, 0.25);">
                Review Approvals Dashboard
              </a>
            </div>

            <p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 0;">This email is auto-generated daily until all pending approvals are cleared.</p>
          </div>

          <!-- FOOTER -->
          <div style="background-color: #f1f5f9; padding: 30px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">LASER EXPERTS INDIA LLP</div>
            <div style="margin-bottom: 12px; line-height: 1.4;">
              <strong>Hosur Service Hub:</strong><br/>
              No. 27/3, Anumepalli, Begapalli Road, Hosur, Tamil Nadu - 635 126
            </div>
          </div>

        </div>
      </div>
    `;
  }
}
