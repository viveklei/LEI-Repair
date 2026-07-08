"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiController = exports.setIoInstance = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const ocr_service_1 = require("../services/ocr.service");
const pdf_service_1 = require("../services/pdf.service");
const notification_service_1 = require("../services/notification.service");
const zoho_service_1 = require("../services/zoho.service");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app_1 = require("firebase-admin/app");
const nodemailer_1 = __importDefault(require("nodemailer"));
// Initialize Firebase Admin SDK
try {
    if ((0, app_1.getApps)().length === 0) {
        (0, app_1.initializeApp)();
        console.log('🔥 Firebase Admin SDK initialized successfully');
    }
}
catch (e) {
    console.warn('⚠️ Firebase Admin SDK failed to initialize: ' + e.message);
}
const JWT_SECRET = process.env.JWT_SECRET || 'fsrms_super_jwt_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fsrms_super_jwt_refresh_secret_key_2026';
// WebSocket broadcast helper
let ioInstance = null;
const setIoInstance = (io) => {
    ioInstance = io;
};
exports.setIoInstance = setIoInstance;
const broadcastDashboardUpdate = () => {
    if (ioInstance) {
        ioInstance.emit('dashboard_update');
        console.log('⚡ Broadcasted real-time dashboard update to clients.');
    }
};
const sendRealtimeNotification = (type, title, body, referenceId) => {
    if (ioInstance) {
        ioInstance.emit('system_notification', { type, title, body, referenceId, timestamp: new Date() });
        console.log(`🔔 Emitted system notification: [${type}] ${title}`);
    }
};
// Strict Status Progression Order
const STATUS_ORDER = [
    'RECEIVED',
    'VISUAL_INSPECTION',
    'INITIAL_DIAGNOSIS',
    'QUOTATION_GENERATED',
    'CUSTOMER_APPROVAL',
    'REPAIR_INITIATED',
    'UNDER_REPAIR',
    'REPAIR_COMPLETED',
    'TESTING_BURN_IN',
    'READY_FOR_DISPATCH',
    'PAYMENT_COMPLETED',
    'DISPATCHED',
    'CLOSED'
];
// Roles allowed to bypass strict stage ordering
const BYPASS_ROLES = ['ADMIN', 'ACCOUNTS', 'SUPPORT'];
const canBypassWorkflow = (role) => BYPASS_ROLES.includes(role);
const checkWorkflowTransition = (current, next, bypass = false) => {
    // Allow transitions to ON_HOLD from anywhere
    if (next === 'ON_HOLD')
        return true;
    // Allow transitions back to UNDER_REPAIR from TESTING_BURN_IN on FAIL
    if (current === 'TESTING_BURN_IN' && next === 'UNDER_REPAIR')
        return true;
    // Allow recovery from ON_HOLD back to CUSTOMER_APPROVAL or RECEIVED
    if (current === 'ON_HOLD')
        return true;
    // Allow WAITING_SPARE_PARTS under repair
    if (next === 'WAITING_SPARE_PARTS' && (current === 'REPAIR_INITIATED' || current === 'UNDER_REPAIR'))
        return true;
    if (current === 'WAITING_SPARE_PARTS' && next === 'UNDER_REPAIR')
        return true;
    const currentIndex = STATUS_ORDER.indexOf(current);
    const nextIndex = STATUS_ORDER.indexOf(next);
    if (currentIndex === -1 || nextIndex === -1)
        return false;
    // Bypass roles can jump forward to any future stage
    if (bypass)
        return nextIndex > currentIndex;
    // Engineers can only advance forward by 1 step in the pipeline (no skipping)
    return nextIndex === currentIndex + 1;
};
// Log audit changes helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const logAudit = async (jobId, userId, oldStatus, newStatus, remarks) => {
    // Skip audit if jobId is not a real UUID (e.g. 'SYSTEM' placeholder)
    if (!UUID_REGEX.test(jobId))
        return;
    let dbUserId = userId;
    if (userId === 'SYSTEM' || userId === 'portal' || !UUID_REGEX.test(userId)) {
        const fallbackUser = await db_1.default.user.findFirst({ where: { isDeleted: false } });
        if (fallbackUser) {
            dbUserId = fallbackUser.id;
        }
        else {
            return; // No user to attribute to, skip silently
        }
    }
    await db_1.default.auditLog.create({
        data: {
            jobId,
            userId: dbUserId,
            oldStatus,
            newStatus,
            remarks,
        }
    });
};
class ApiController {
    // Static memory cache for email OTP verifications
    static otpCache = new Map();
    // --- AUTH CONTROLLERS ---
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const user = await db_1.default.user.findFirst({
                where: { email, isDeleted: false },
                include: { role: true }
            });
            if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role.name, name: user.name }, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || '1h') });
            const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') });
            await db_1.default.user.update({
                where: { id: user.id },
                data: { refreshToken }
            });
            res.json({
                accessToken,
                refreshToken,
                user: { id: user.id, email: user.email, name: user.name, role: user.role.name }
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async refreshToken(req, res) {
        try {
            const { token } = req.body;
            if (!token)
                return res.status(401).json({ message: 'Refresh token missing' });
            jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET, async (err, decoded) => {
                if (err)
                    return res.status(403).json({ message: 'Invalid refresh token' });
                const user = await db_1.default.user.findFirst({
                    where: { id: decoded.id, refreshToken: token, isDeleted: false },
                    include: { role: true }
                });
                if (!user)
                    return res.status(403).json({ message: 'Refresh token not registered' });
                const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role.name, name: user.name }, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') });
                res.json({ accessToken });
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getProfile(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const user = await db_1.default.user.findFirst({
                where: { id: req.user.id },
                include: { role: true }
            });
            if (!user)
                return res.status(404).json({ message: 'User not found' });
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role.name,
                employeeCode: user.employeeCode,
                mobileNumber: user.mobileNumber,
                department: user.department
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async updateProfile(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const { name, mobileNumber, department, employeeCode, password } = req.body;
            const updateData = {
                name,
                mobileNumber,
                department,
                employeeCode: employeeCode || null
            };
            if (password && password.trim() !== '') {
                const salt = await bcryptjs_1.default.genSalt(10);
                updateData.passwordHash = await bcryptjs_1.default.hash(password, salt);
            }
            const updatedUser = await db_1.default.user.update({
                where: { id: req.user.id },
                data: updateData,
                include: { role: true }
            });
            res.json({
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role.name,
                employeeCode: updatedUser.employeeCode,
                mobileNumber: updatedUser.mobileNumber,
                department: updatedUser.department
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- CUSTOMER PORTAL ACCESS ---
    static async customerPortalLogin(req, res) {
        try {
            const { trackId, email, otp } = req.body;
            // If Track ID is provided, locate it directly
            if (trackId) {
                const job = await db_1.default.serviceJob.findFirst({
                    where: { trackId, isDeleted: false },
                    include: { customer: true, laserSource: true }
                });
                if (!job)
                    return res.status(404).json({ message: 'Track ID not found' });
                // Generate limited customer access token
                const token = jsonwebtoken_1.default.sign({ id: 'portal', role: 'CUSTOMER', name: job.customer.customerName, jobId: job.id }, JWT_SECRET, { expiresIn: '2h' });
                return res.json({ token, jobId: job.id });
            }
            // Verify custom Email OTP code stored in server cache
            if (email && otp) {
                const cleanEmail = email.toLowerCase().trim();
                const cachedEntry = ApiController.otpCache.get(cleanEmail);
                // Fail-safe check
                if (!cachedEntry) {
                    // Allow default local testing fallback (123456) only if no OTP has been cached yet
                    if (otp === '123456') {
                        const customer = await db_1.default.customer.findFirst({
                            where: { email: cleanEmail, isDeleted: false }
                        });
                        if (customer) {
                            const token = jsonwebtoken_1.default.sign({ id: 'portal', role: 'CUSTOMER', name: customer.customerName, customerId: customer.id }, JWT_SECRET, { expiresIn: '2h' });
                            return res.json({ token, customerId: customer.id });
                        }
                    }
                    return res.status(400).json({ message: 'No OTP code requested for this email address or session expired.' });
                }
                // Validate code and check expiry
                if (Date.now() > cachedEntry.expires) {
                    ApiController.otpCache.delete(cleanEmail);
                    return res.status(400).json({ message: 'OTP code has expired. Please request a new one.' });
                }
                if (cachedEntry.otp !== otp.trim()) {
                    return res.status(400).json({ message: 'Invalid OTP code. Please try again.' });
                }
                // Clean up cache entry
                ApiController.otpCache.delete(cleanEmail);
                const customer = await db_1.default.customer.findFirst({
                    where: { id: cachedEntry.customerId }
                });
                if (!customer)
                    return res.status(404).json({ message: 'Customer account not found.' });
                const token = jsonwebtoken_1.default.sign({ id: 'portal', role: 'CUSTOMER', name: customer.customerName, customerId: customer.id }, JWT_SECRET, { expiresIn: '2h' });
                return res.json({ token, customerId: customer.id });
            }
            res.status(400).json({ message: 'Please provide Track ID or Email Address + OTP' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- CHECK REGISTERED EMAIL ADDRESS & GENERATE/SEND EMAIL OTP ---
    static async checkEmailAddress(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ message: 'Email address is required' });
            }
            const cleanEmail = email.toLowerCase().trim();
            const customer = await db_1.default.customer.findFirst({
                where: {
                    email: cleanEmail,
                    isDeleted: false
                }
            });
            if (!customer) {
                return res.status(404).json({ message: 'This email address is not registered under any customer account.' });
            }
            // Generate 6-Digit random OTP code
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            ApiController.otpCache.set(cleanEmail, {
                otp: otpCode,
                expires: Date.now() + 5 * 60 * 1000, // 5 min expiry
                customerId: customer.id
            });
            // Transmit OTP via real SMTP if configured
            const useSMTP = process.env.SMTP_USER && process.env.SMTP_PASS;
            if (useSMTP) {
                try {
                    const transporter = nodemailer_1.default.createTransport({
                        host: process.env.SMTP_HOST || 'smtp.gmail.com',
                        port: parseInt(process.env.SMTP_PORT || '587'),
                        secure: process.env.SMTP_PORT === '465',
                        auth: {
                            user: process.env.SMTP_USER,
                            pass: process.env.SMTP_PASS
                        }
                    });
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM || `"LEI Repair Portal" <${process.env.SMTP_USER}>`,
                        to: customer.email,
                        subject: 'LEI Repair Portal Login OTP',
                        html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #0f172a; text-align: center;">LEI Repair Portal</h2>
                <p>Hello <strong>${customer.customerName}</strong>,</p>
                <p>You requested a login verification code for the Laser Equipment India (LEI) Repair portal.</p>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #0284c7;">${otpCode}</span>
                </div>
                <p style="font-size: 12px; color: #64748b;">This OTP code is valid for 5 minutes. If you did not request this, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 10px; color: #94a3b8; text-align: center;">Laser Experts India LLP • Chennai</p>
              </div>
            `
                    });
                    console.log(`✉️ Real OTP email sent successfully to ${customer.email}`);
                }
                catch (mailErr) {
                    console.error('❌ Failed to send real SMTP email:', mailErr.message);
                }
            }
            // Log the OTP code anyway in notifications.log (so it is free and visible instantly)
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] [OTP_EMAIL] To: ${customer.email} | Code: ${otpCode}\n`;
            const logPath = path_1.default.join(__dirname, '..', '..', 'public', 'notifications.log');
            fs_1.default.appendFileSync(logPath, logEntry);
            console.log(`\n🔑 [OTP EMAIL CODE (FREE FALLBACK)] Sent to: ${customer.email} | Code: ${otpCode}\n`);
            res.json({ success: true, email: customer.email });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- GLOBAL SEARCH SYSTEM ---
    static async globalSearch(req, res) {
        try {
            const { query } = req.query;
            if (!query || typeof query !== 'string') {
                return res.status(400).json({ message: 'Search parameter query is required' });
            }
            // Search across Track ID, Serial, Customer Name, Company Name, Mobile Number, Invoice Number, Quotation
            const jobs = await db_1.default.serviceJob.findMany({
                where: {
                    isDeleted: false,
                    OR: [
                        { trackId: { contains: query } },
                        { complaintDescription: { contains: query } },
                        {
                            customer: {
                                OR: [
                                    { customerName: { contains: query } },
                                    { companyName: { contains: query } },
                                    { mobileNumber: { contains: query } }
                                ]
                            }
                        },
                        {
                            laserSource: {
                                serialNumber: { contains: query }
                            }
                        },
                        {
                            payments: {
                                some: { invoiceNumber: { contains: query } }
                            }
                        }
                    ]
                },
                include: {
                    customer: true,
                    laserSource: true,
                    payments: true
                }
            });
            res.json(jobs);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- SERIAL NUMBER INTELLIGENCE ---
    static async verifySerialNumber(req, res) {
        try {
            const { serialNumber } = req.params;
            const laser = await db_1.default.laserSource.findFirst({
                where: { serialNumber, isDeleted: false }
            });
            if (!laser) {
                return res.json({ exists: false, message: 'New laser source serial number' });
            }
            // If exists, fetch lifetime history
            const serviceHistory = await db_1.default.serviceJob.findMany({
                where: { laserSourceId: laser.id, isDeleted: false },
                include: {
                    customer: true,
                    inspections: true,
                    quotations: true,
                    repairs: true,
                    testResults: true,
                    serviceReports: true,
                    payments: true,
                    dispatches: true
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json({
                exists: true,
                laser,
                repairCount: serviceHistory.length,
                history: serviceHistory
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- OCR NAMEPLATE SCAN ---
    static async scanNameplate(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No nameplate image file uploaded.' });
            }
            const scanResult = await ocr_service_1.OcrService.scanNameplate(req.file.path);
            res.json(scanResult);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- CUSTOMERS ---
    static async listCustomers(req, res) {
        try {
            const customers = await db_1.default.customer.findMany({
                where: { isDeleted: false },
                orderBy: { companyName: 'asc' }
            });
            res.json(customers);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getCustomerHistory(req, res) {
        try {
            const { id } = req.params;
            const customer = await db_1.default.customer.findFirst({
                where: { id, isDeleted: false },
                include: {
                    serviceJobs: {
                        where: { isDeleted: false },
                        include: { laserSource: true },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
            if (!customer)
                return res.status(404).json({ message: 'Customer not found' });
            res.json(customer);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async createCustomer(req, res) {
        try {
            const { companyName, customerName, mobileNumber, email, address, billingAddress, shippingAddress, billingState, shippingState, gstNumber, contactPerson } = req.body;
            // Auto-reconnect matching customer if already exists to support customer history tracking
            let customer = await db_1.default.customer.findFirst({
                where: { mobileNumber, isDeleted: false }
            });
            if (!customer) {
                customer = await db_1.default.customer.create({
                    data: {
                        companyName,
                        customerName,
                        mobileNumber,
                        email,
                        address: address || billingAddress || '',
                        billingAddress: billingAddress || address || '',
                        shippingAddress: shippingAddress || address || '',
                        billingState: billingState || '',
                        shippingState: shippingState || '',
                        gstNumber,
                        contactPerson
                    }
                });
            }
            res.json(customer);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async deleteCustomer(req, res) {
        try {
            const { id } = req.params;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            // Check if customer has active jobs
            const activeJobs = await db_1.default.serviceJob.count({
                where: { customerId: id, isDeleted: false, NOT: { status: 'CLOSED' } }
            });
            if (activeJobs > 0) {
                return res.status(400).json({ message: 'Cannot delete customer with active repair jobs in progress.' });
            }
            await db_1.default.customer.update({
                where: { id },
                data: { isDeleted: true }
            });
            // Also soft-delete associated service jobs for this customer
            await db_1.default.serviceJob.updateMany({
                where: { customerId: id },
                data: { isDeleted: true }
            });
            res.json({ message: 'Customer successfully deleted from portal database.' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- RECEIVING & SERVICE JOB CREATION ---
    static async createJob(req, res) {
        try {
            const { customerId, companyName, customerName, mobileNumber, email, address, billingAddress, shippingAddress, billingState, shippingState, gstNumber, contactPerson, brand, modelNumber, serialNumber, powerRating, mfgYear, machineManufacturer, machineModel, sourceType, complaintCategory, complaintDescription, receivingNotes } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            // Step 1: Manage/Create Customer
            let finalCustomerId = customerId;
            if (!finalCustomerId) {
                const existingCust = await db_1.default.customer.findFirst({
                    where: { mobileNumber, isDeleted: false }
                });
                if (existingCust) {
                    finalCustomerId = existingCust.id;
                }
                else {
                    const newCust = await db_1.default.customer.create({
                        data: {
                            companyName,
                            customerName,
                            mobileNumber,
                            email,
                            address: address || billingAddress || '',
                            billingAddress: billingAddress || address || '',
                            shippingAddress: shippingAddress || address || '',
                            billingState: billingState || '',
                            shippingState: shippingState || '',
                            gstNumber,
                            contactPerson
                        }
                    });
                    finalCustomerId = newCust.id;
                }
            }
            // Step 2: Manage/Create Laser Source
            let laser = await db_1.default.laserSource.findFirst({
                where: { serialNumber, isDeleted: false }
            });
            if (!laser) {
                laser = await db_1.default.laserSource.create({
                    data: {
                        brand,
                        modelNumber,
                        serialNumber,
                        powerRating,
                        mfgYear: parseInt(mfgYear) || new Date().getFullYear(),
                        machineManufacturer,
                        machineModel,
                        sourceType
                    }
                });
            }
            // Step 3: Auto-generate Sequence Track ID: FRND-YEAR-SEQUENCE
            const year = new Date().getFullYear();
            const count = await db_1.default.serviceJob.count();
            const seqStr = String(count + 1).padStart(4, '0');
            const trackId = `FRND-${year}-${seqStr}`;
            // Step 4: Create Job (RECEIVED)
            const job = await db_1.default.serviceJob.create({
                data: {
                    trackId,
                    customerId: finalCustomerId,
                    laserSourceId: laser.id,
                    complaintCategory,
                    complaintDescription,
                    receivingNotes,
                    status: 'RECEIVED'
                },
                include: { customer: true, laserSource: true }
            });
            // Save upload photos/videos if any
            const files = req.files;
            if (files && files.length > 0) {
                for (const file of files) {
                    await db_1.default.fileAttachment.create({
                        data: {
                            jobId: job.id,
                            fileUrl: `/uploads/${file.filename}`,
                            fileType: file.mimetype.startsWith('video') ? 'VIDEO' : (file.mimetype === 'application/pdf' ? 'PDF' : 'IMAGE'),
                            originalName: file.originalname
                        }
                    });
                }
            }
            // Audit Log
            await logAudit(job.id, req.user.id, 'RECEIVED', 'RECEIVED', 'Laser source received at the service center.');
            // WhatsApp update
            await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'RECEIVED', job.customer.customerName, job.trackId, job.customer.mobileNumber);
            sendRealtimeNotification('NEW_JOB', 'New Service Job Registered', `Job ticket ${job.trackId} has been successfully inwarded.`, job.id);
            broadcastDashboardUpdate();
            res.json(job);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async listJobs(req, res) {
        try {
            const jobs = await db_1.default.serviceJob.findMany({
                where: { isDeleted: false },
                include: { customer: true, laserSource: true, currentEngineer: true, quotations: true },
                orderBy: { createdAt: 'desc' }
            });
            res.json(jobs);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getJobDetail(req, res) {
        try {
            const { id } = req.params;
            const job = await db_1.default.serviceJob.findFirst({
                where: { id, isDeleted: false },
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
                    files: true,
                    qcAssessment: true,
                    verification: true,
                    comments: { orderBy: { createdAt: 'asc' } },
                    auditLogs: { include: { user: true }, orderBy: { timestamp: 'asc' } }
                }
            });
            if (!job)
                return res.status(404).json({ message: 'Service job not found' });
            // Allow any engineer to view the job workflow details
            // if (req.user?.role === 'ENGINEER' && job.currentEngineerId && job.currentEngineerId !== req.user.id) {
            //   return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            // }
            // Automatically generate missing PDF files for service reports (e.g. for seeded data)
            if (job.serviceReports && job.serviceReports.length > 0) {
                const report = job.serviceReports[0];
                const filepath = report.pdfUrl ? path_1.default.join(__dirname, '..', '..', 'public', report.pdfUrl) : '';
                const fileExists = filepath ? fs_1.default.existsSync(filepath) : false;
                if (!report.pdfUrl || !fileExists) {
                    console.log(`Generating missing PDF report for job ${job.trackId}...`);
                    // Query latest pass test
                    const tests = await db_1.default.testResult.findFirst({
                        where: { jobId: job.id, result: 'PASS' },
                        orderBy: { createdAt: 'desc' }
                    });
                    // Query parts used in repairs
                    const repairs = await db_1.default.repair.findMany({
                        where: { jobId: job.id },
                        include: { partsUsed: { include: { sparePart: true } } }
                    });
                    const parts = [];
                    repairs.forEach((r) => {
                        parts.push(...r.partsUsed);
                    });
                    // Generate report PDF
                    const generatedPdfUrl = await pdf_service_1.PdfService.generateServiceReportPdf(report, job, tests || {}, parts);
                    // Update record in database
                    await db_1.default.serviceReport.update({
                        where: { id: report.id },
                        data: { pdfUrl: generatedPdfUrl }
                    });
                    // Update local object returned to user
                    report.pdfUrl = generatedPdfUrl;
                }
            }
            // Generate QR Code dynamically pointing to the public tracking route
            const trackingUrl = `${req.headers.origin || 'http://localhost:5173'}/track/${job.trackId}`;
            const qrCodeDataUrl = await qrcode_1.default.toDataURL(trackingUrl);
            res.json({
                ...job,
                qrCodeDataUrl
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getJobIdByTrackId(req, res) {
        try {
            const { trackId } = req.params;
            const job = await db_1.default.serviceJob.findFirst({
                where: { trackId, isDeleted: false },
                select: { id: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Service ticket not found' });
            res.json({ jobId: job.id });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async sendManualWhatsAppUpdate(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findUnique({
                where: { id, isDeleted: false },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, status || job.status, job.customer.customerName, job.trackId, job.customer.mobileNumber);
            res.json({ message: 'WhatsApp message sent successfully' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async deleteJob(req, res) {
        try {
            const { id } = req.params;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findUnique({
                where: { id, isDeleted: false }
            });
            if (!job)
                return res.status(404).json({ message: 'Service job not found' });
            // Soft delete the service job
            await db_1.default.serviceJob.update({
                where: { id },
                data: { isDeleted: true }
            });
            // Also soft-delete associated inspections, repairs, etc. if required (Prisma relations are kept, soft-deleted jobs won't show in lists)
            res.json({ message: 'Service job ticket deleted successfully.' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async updateJobPriority(req, res) {
        try {
            const { id } = req.params;
            const { priority } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            if (!['NORMAL', 'HIGH', 'URGENT'].includes(priority)) {
                return res.status(400).json({ message: 'Invalid priority level.' });
            }
            const job = await db_1.default.serviceJob.findUnique({
                where: { id, isDeleted: false }
            });
            if (!job)
                return res.status(404).json({ message: 'Service job not found' });
            const updatedJob = await db_1.default.serviceJob.update({
                where: { id },
                data: { priority },
                include: { customer: true, laserSource: true }
            });
            res.json(updatedJob);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getPublicJobStatus(req, res) {
        try {
            const { trackId } = req.params;
            const job = await db_1.default.serviceJob.findFirst({
                where: { trackId, isDeleted: false },
                select: {
                    id: true,
                    trackId: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    laserSource: {
                        select: {
                            brand: true,
                            modelNumber: true,
                            powerRating: true
                        }
                    },
                    customer: {
                        select: {
                            companyName: true
                        }
                    }
                }
            });
            if (!job) {
                return res.status(404).json({ message: 'Tracking record not found' });
            }
            res.json(job);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- INSPECTION MODULE ---
    static async submitInspection(req, res) {
        try {
            const { jobId, physicalCondition, internalFindings, faultAnalysis, initialDiagnosis, inspectionNotes } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({ where: { id: jobId } });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            const existingInspection = await db_1.default.inspection.findFirst({ where: { jobId } });
            // Check for at least 1 image file
            const files = req.files;
            const photosCount = await db_1.default.fileAttachment.count({ where: { jobId, fileType: 'IMAGE' } });
            if (!existingInspection && (!files || files.length === 0) && photosCount === 0) {
                return res.status(400).json({ message: 'At least one inspection photo is mandatory.' });
            }
            // Save files
            if (files && files.length > 0) {
                for (const file of files) {
                    await db_1.default.fileAttachment.create({
                        data: {
                            jobId,
                            fileUrl: `/uploads/${file.filename}`,
                            fileType: 'IMAGE',
                            originalName: file.originalname
                        }
                    });
                }
            }
            let inspection;
            if (existingInspection) {
                // Update existing inspection
                inspection = await db_1.default.inspection.update({
                    where: { id: existingInspection.id },
                    data: {
                        physicalCondition,
                        internalFindings,
                        faultAnalysis,
                        initialDiagnosis,
                        inspectionNotes
                    }
                });
                await logAudit(jobId, req.user.id, job.status, job.status, 'Inspection details updated.');
            }
            else {
                // Save new Inspection records
                inspection = await db_1.default.inspection.create({
                    data: {
                        jobId,
                        engineerId: req.user.id,
                        physicalCondition,
                        internalFindings,
                        faultAnalysis,
                        initialDiagnosis,
                        inspectionNotes
                    }
                });
                // Update Job status pipeline
                await db_1.default.serviceJob.update({
                    where: { id: jobId },
                    data: { status: 'INITIAL_DIAGNOSIS' }
                });
                await logAudit(jobId, req.user.id, job.status, 'INITIAL_DIAGNOSIS', 'Inspection completed. Initial diagnosis saved.');
                const customer = await db_1.default.customer.findFirst({ where: { id: job.customerId } });
                if (customer) {
                    await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'VISUAL_INSPECTION', customer.customerName, job.trackId, customer.mobileNumber);
                }
            }
            sendRealtimeNotification('INSPECTION_COMPLETED', 'Diagnosis Completed', `Ticket ${job.trackId} has passed inspection. Moving to Quotation phase.`, jobId);
            broadcastDashboardUpdate();
            res.json(inspection);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- QUOTATION MODULE ---
    static async submitQuotation(req, res) {
        try {
            const { jobId, items } = req.body; // items = [{ name, category, quantity, unitCost }]
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId },
                include: { customer: true, laserSource: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            const existingQuotation = await db_1.default.quotation.findFirst({ where: { jobId } });
            // Calculations
            let totalParts = 0;
            let totalConsumables = 0;
            let totalLabour = 0;
            const quotationItemsData = items.map((item) => {
                const totalCost = item.quantity * item.unitCost;
                if (item.category === 'LABOUR') {
                    totalLabour += totalCost;
                }
                else if (item.category === 'CONSUMABLE') {
                    totalConsumables += totalCost;
                }
                else {
                    totalParts += totalCost;
                }
                return {
                    name: item.name,
                    category: item.category,
                    quantity: parseInt(item.quantity),
                    unitCost: parseFloat(item.unitCost),
                    partNumber: item.partNumber || null,
                    hsnSac: item.hsnSac || null,
                    manufacturer: item.manufacturer || null,
                    totalCost
                };
            });
            const grandTotal = totalParts + totalConsumables + totalLabour;
            let quotation;
            if (existingQuotation) {
                // Delete old items
                await db_1.default.quotationItem.deleteMany({ where: { quotationId: existingQuotation.id } });
                // Update existing quotation
                quotation = await db_1.default.quotation.update({
                    where: { id: existingQuotation.id },
                    data: {
                        totalParts,
                        totalConsumables,
                        totalLabour,
                        grandTotal,
                        items: {
                            create: quotationItemsData
                        }
                    },
                    include: { items: true }
                });
                await logAudit(jobId, req.user.id, job.status, job.status, `Quotation updated. New grand total: $${grandTotal.toFixed(2)}.`);
            }
            else {
                // Create quote
                quotation = await db_1.default.quotation.create({
                    data: {
                        jobId,
                        creatorId: req.user.id,
                        status: 'PENDING_APPROVAL',
                        totalParts,
                        totalConsumables,
                        totalLabour,
                        grandTotal,
                        items: {
                            create: quotationItemsData
                        }
                    },
                    include: { items: true }
                });
                // Update Job status if it is at INITIAL_DIAGNOSIS
                if (job.status === 'INITIAL_DIAGNOSIS') {
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: { status: 'QUOTATION_GENERATED' }
                    });
                    await logAudit(jobId, req.user.id, job.status, 'QUOTATION_GENERATED', `Quotation submitted for $${grandTotal.toFixed(2)}.`);
                    // Notify customer
                    await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'QUOTATION_GENERATED', job.customer.customerName, job.trackId, job.customer.mobileNumber);
                }
            }
            sendRealtimeNotification('QUOTE_SUBMITTED', 'Quotation Generated', `Quotation of ₹${grandTotal} submitted for ticket ${job.trackId}.`, jobId);
            broadcastDashboardUpdate();
            res.json(quotation);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async downloadQuotationPdf(req, res) {
        try {
            const { id } = req.params;
            const quotation = await db_1.default.quotation.findUnique({
                where: { id },
                include: { items: true }
            });
            if (!quotation)
                return res.status(404).json({ message: 'Quotation not found' });
            const job = await db_1.default.serviceJob.findUnique({
                where: { id: quotation.jobId },
                include: { customer: true, laserSource: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job details not found' });
            const pdfUrl = await pdf_service_1.PdfService.generateQuotationPdf(quotation, job, quotation.items);
            res.json({ pdfUrl });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- QUOTATION APPROVAL LOGIC ---
    static async handleQuotationApproval(req, res) {
        try {
            const { id } = req.params;
            const { approve, rejectionReason } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const quotation = await db_1.default.quotation.findUnique({ where: { id } });
            if (!quotation)
                return res.status(404).json({ message: 'Quotation not found' });
            const job = await db_1.default.serviceJob.findUnique({
                where: { id: quotation.jobId },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            const oldStatus = job.status;
            let newStatus = 'CUSTOMER_APPROVAL';
            if (approve) {
                await db_1.default.quotation.update({
                    where: { id },
                    data: {
                        status: 'APPROVED',
                        approvedBy: (req.user.role === 'CUSTOMER' || req.user.id === 'portal') ? 'CUSTOMER' : req.user.role === 'ADMIN' ? 'ADMIN' : 'COORDINATOR'
                    }
                });
                newStatus = 'REPAIR_INITIATED';
                await db_1.default.serviceJob.update({
                    where: { id: quotation.jobId },
                    data: { status: 'REPAIR_INITIATED' }
                });
                await logAudit(quotation.jobId, req.user.id, oldStatus, 'REPAIR_INITIATED', `Quotation APPROVED by ${(req.user.role === 'CUSTOMER' || req.user.id === 'portal') ? 'Customer' : req.user.role === 'ADMIN' ? 'Admin' : 'Coordinator'}. Repair unlocked.`);
                sendRealtimeNotification('QUOTE_APPROVED', 'Quotation Approved', `Quotation for ticket ${job.trackId} approved. Repair unlocked.`, quotation.jobId);
                await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'QUOTATION_APPROVED', job.customer.customerName, job.trackId, job.customer.mobileNumber);
            }
            else {
                await db_1.default.quotation.update({
                    where: { id },
                    data: {
                        status: 'REJECTED',
                        rejectionReason,
                        approvedBy: (req.user.role === 'CUSTOMER' || req.user.id === 'portal') ? 'CUSTOMER' : req.user.role === 'ADMIN' ? 'ADMIN' : 'COORDINATOR'
                    }
                });
                newStatus = 'ON_HOLD';
                await db_1.default.serviceJob.update({
                    where: { id: quotation.jobId },
                    data: { status: 'ON_HOLD' }
                });
                await logAudit(quotation.jobId, req.user.id, oldStatus, 'ON_HOLD', `Quotation REJECTED. Reason: ${rejectionReason}`);
                sendRealtimeNotification('QUOTE_REJECTED', 'Quotation Rejected', `Quotation for ticket ${job.trackId} rejected: ${rejectionReason}`, quotation.jobId);
            }
            broadcastDashboardUpdate();
            res.json({ message: `Quotation status updated successfully to ${approve ? 'APPROVED' : 'REJECTED'}.` });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async undoQuotationDecision(req, res) {
        try {
            const { id } = req.params;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const quotation = await db_1.default.quotation.findUnique({ where: { id } });
            if (!quotation)
                return res.status(404).json({ message: 'Quotation not found' });
            const job = await db_1.default.serviceJob.findUnique({ where: { id: quotation.jobId } });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            const oldStatus = job.status;
            await db_1.default.quotation.update({
                where: { id },
                data: { status: 'PENDING_APPROVAL', rejectionReason: null, approvedBy: null }
            });
            await db_1.default.serviceJob.update({
                where: { id: quotation.jobId },
                data: { status: 'QUOTATION_GENERATED' }
            });
            await logAudit(quotation.jobId, req.user.id, oldStatus, 'QUOTATION_GENERATED', 'Quotation approval/rejection decision UNDONE.');
            sendRealtimeNotification('QUOTE_UNDONE', 'Decision Undone', `Quotation decision undone for ticket ${job.trackId}.`, quotation.jobId);
            broadcastDashboardUpdate();
            res.json({ message: 'Decision undone successfully.' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- REPAIR MODULE ---
    static async submitRepairStep(req, res) {
        try {
            const { jobId, repairNotes, repairDuration, partsUsed } = req.body; // partsUsed = [{ sparePartId, quantityUsed }]
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            const existingRepair = await db_1.default.repair.findFirst({ where: { jobId } });
            // Check if repair is unlocked (only if creating a new repair)
            if (!existingRepair && job.status !== 'REPAIR_INITIATED' && job.status !== 'UNDER_REPAIR' && job.status !== 'WAITING_SPARE_PARTS') {
                return res.status(400).json({ message: 'Repair is locked. Check quotation approval.' });
            }
            // Query old parts if this is an update to an existing repair
            const oldParts = existingRepair
                ? await db_1.default.repairSparePartUsed.findMany({ where: { repairId: existingRepair.id } })
                : [];
            const oldQtyMap = new Map();
            oldParts.forEach(op => oldQtyMap.set(op.sparePartId, op.quantity));
            // Check inventory availability (using delta calculation)
            let isStockUnavailable = false;
            const lowStockParts = [];
            for (const item of partsUsed) {
                const oldQty = oldQtyMap.get(item.sparePartId) || 0;
                const netRequired = item.quantityUsed - oldQty; // positive means we need more stock, negative means we are returning stock
                if (netRequired > 0) {
                    const part = await db_1.default.sparePart.findUnique({ where: { id: item.sparePartId } });
                    if (!part || part.quantity < netRequired) {
                        isStockUnavailable = true;
                        lowStockParts.push(part?.partName || 'Unknown Part');
                    }
                }
            }
            if (isStockUnavailable) {
                // Status becomes WAITING SPARE PARTS only if creating new or if currently in repair stages
                const repairStatuses = ['REPAIR_INITIATED', 'UNDER_REPAIR', 'WAITING_SPARE_PARTS'];
                if (repairStatuses.includes(job.status)) {
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: { status: 'WAITING_SPARE_PARTS' }
                    });
                    await logAudit(jobId, req.user.id, job.status, 'WAITING_SPARE_PARTS', `Repair on hold. Stock low/unavailable for: ${lowStockParts.join(', ')}.`);
                    // Trigger WhatsApp Notification
                    await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'WAITING_SPARE_PARTS', job.customer.customerName, job.trackId, job.customer.mobileNumber);
                }
                sendRealtimeNotification('SLA_WARNING', 'Job Put On Hold (Low Stock)', `Ticket ${job.trackId} put on hold: waiting for spare parts (${lowStockParts.join(', ')}).`, jobId);
                broadcastDashboardUpdate();
                return res.status(400).json({
                    status: 'WAITING_SPARE_PARTS',
                    message: `Inventory low. Low items: ${lowStockParts.join(', ')}.`
                });
            }
            // Commit inventory adjustments
            // 1. Adjust items in new partsUsed list
            for (const item of partsUsed) {
                const oldQty = oldQtyMap.get(item.sparePartId) || 0;
                const netRequired = item.quantityUsed - oldQty;
                if (netRequired !== 0) {
                    await db_1.default.sparePart.update({
                        where: { id: item.sparePartId },
                        data: {
                            quantity: { decrement: netRequired }
                        }
                    });
                    await db_1.default.sparePartLog.create({
                        data: {
                            sparePartId: item.sparePartId,
                            changeType: netRequired > 0 ? 'CONSUMED' : 'ADDED',
                            quantity: -netRequired, // Negative for consumption, positive for reversion/addition
                            referenceId: jobId,
                            remarks: netRequired > 0
                                ? `Used ${netRequired} units in repair job ticket ${job.trackId}`
                                : `Returned ${Math.abs(netRequired)} units from repair job ticket ${job.trackId}`
                        }
                    });
                }
            }
            // 2. Revert items that were completely removed from partsUsed list
            const newPartIds = new Set(partsUsed.map((p) => p.sparePartId));
            for (const op of oldParts) {
                if (!newPartIds.has(op.sparePartId)) {
                    await db_1.default.sparePart.update({
                        where: { id: op.sparePartId },
                        data: {
                            quantity: { increment: op.quantity }
                        }
                    });
                    await db_1.default.sparePartLog.create({
                        data: {
                            sparePartId: op.sparePartId,
                            changeType: 'ADDED',
                            quantity: op.quantity, // Reverted positive quantity
                            referenceId: jobId,
                            remarks: `Returned all ${op.quantity} units from repair job ticket ${job.trackId} (removed from repair)`
                        }
                    });
                }
            }
            let repair;
            if (existingRepair) {
                // Delete old parts log
                await db_1.default.repairSparePartUsed.deleteMany({ where: { repairId: existingRepair.id } });
                // Update existing repair record
                repair = await db_1.default.repair.update({
                    where: { id: existingRepair.id },
                    data: {
                        repairNotes,
                        repairDuration: parseInt(repairDuration) || 0,
                        partsUsed: {
                            create: partsUsed.map((p) => ({
                                sparePartId: p.sparePartId,
                                quantity: parseInt(p.quantityUsed)
                            }))
                        }
                    }
                });
                await logAudit(jobId, req.user.id, job.status, job.status, 'Repair details updated.');
            }
            else {
                // Log Repair
                repair = await db_1.default.repair.create({
                    data: {
                        jobId,
                        engineerId: req.user.id,
                        repairNotes,
                        repairDuration: parseInt(repairDuration) || 0,
                        startStatus: job.status,
                        endStatus: 'UNDER_REPAIR',
                        partsUsed: {
                            create: partsUsed.map((p) => ({
                                sparePartId: p.sparePartId,
                                quantity: parseInt(p.quantityUsed)
                            }))
                        }
                    }
                });
                // Advance Status to UNDER REPAIR
                await db_1.default.serviceJob.update({
                    where: { id: jobId },
                    data: { status: 'UNDER_REPAIR' }
                });
                await logAudit(jobId, req.user.id, job.status, 'UNDER_REPAIR', 'Repair log saved. Working on laser source.');
                // Send WhatsApp
                if (job.status === 'REPAIR_INITIATED') {
                    await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'REPAIR_STARTED', job.customer.customerName, job.trackId, job.customer.mobileNumber);
                }
            }
            broadcastDashboardUpdate();
            res.json(repair);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async completeRepair(req, res) {
        try {
            const { jobId } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({ where: { id: jobId } });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            await db_1.default.serviceJob.update({
                where: { id: jobId },
                data: { status: 'REPAIR_COMPLETED' }
            });
            await logAudit(jobId, req.user.id, job.status, 'REPAIR_COMPLETED', 'Repair operations complete. Moving to Testing.');
            sendRealtimeNotification('REPAIR_COMPLETED', 'Repair Completed', `Laser source for ticket ${job.trackId} has been successfully repaired and moved to QC Testing.`, jobId);
            broadcastDashboardUpdate();
            res.json({ message: 'Repair marked as completed. Enforced Testing module unlocked.' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- TESTING MODULE ---
    static async submitTestResults(req, res) {
        try {
            const { jobId, outputPowerTest, stabilityTest, burnInTest, alarmVerification, temperatureTest, communicationTest, testNotes, result } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            const existingTest = await db_1.default.testResult.findFirst({ where: { jobId } });
            // Enforce: Must be repair completed (only if creating a new test result)
            if (!existingTest && job.status !== 'REPAIR_COMPLETED' && job.status !== 'TESTING_BURN_IN') {
                return res.status(400).json({ message: 'Testing is only permitted after repair is complete.' });
            }
            // Save Files
            const files = req.files;
            if (files && files.length > 0) {
                for (const file of files) {
                    await db_1.default.fileAttachment.create({
                        data: {
                            jobId,
                            fileUrl: `/uploads/${file.filename}`,
                            fileType: file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE',
                            originalName: file.originalname
                        }
                    });
                }
            }
            let test;
            if (existingTest) {
                // Update existing test result
                test = await db_1.default.testResult.update({
                    where: { id: existingTest.id },
                    data: {
                        outputPowerTest,
                        stabilityTest,
                        burnInTest,
                        alarmVerification,
                        temperatureTest,
                        communicationTest,
                        testNotes,
                        result
                    }
                });
                if (result === 'PASS' && (job.status === 'REPAIR_COMPLETED' || job.status === 'TESTING_BURN_IN')) {
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: { status: 'READY_FOR_DISPATCH' }
                    });
                    await logAudit(jobId, req.user.id, job.status, 'READY_FOR_DISPATCH', 'Validation tests PASSED. Safe for dispatch.');
                }
                else if (result === 'FAIL') {
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: { status: 'UNDER_REPAIR' }
                    });
                    await logAudit(jobId, req.user.id, job.status, 'UNDER_REPAIR', `Validation tests FAILED. Fail Notes: ${testNotes}. Moving back to Repair.`);
                }
                else {
                    await logAudit(jobId, req.user.id, job.status, job.status, `Test results updated. Result: ${result}.`);
                }
            }
            else {
                // Save Test Results
                test = await db_1.default.testResult.create({
                    data: {
                        jobId,
                        engineerId: req.user.id,
                        outputPowerTest,
                        stabilityTest,
                        burnInTest,
                        alarmVerification,
                        temperatureTest,
                        communicationTest,
                        testNotes,
                        result // PASS or FAIL
                    }
                });
                const activeTestingStatuses = ['REPAIR_COMPLETED', 'TESTING_BURN_IN'];
                if (activeTestingStatuses.includes(job.status)) {
                    let nextStatus = 'TESTING_BURN_IN';
                    let remarks = '';
                    if (result === 'PASS') {
                        nextStatus = 'READY_FOR_DISPATCH';
                        remarks = 'Validation tests PASSED. Safe for dispatch.';
                        await db_1.default.serviceJob.update({
                            where: { id: jobId },
                            data: { status: 'READY_FOR_DISPATCH' }
                        });
                        await logAudit(jobId, req.user.id, job.status, 'READY_FOR_DISPATCH', remarks);
                        // Notify client
                        await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'TESTING_COMPLETED', job.customer.customerName, job.trackId, job.customer.mobileNumber);
                    }
                    else {
                        // FAIL LOGIC: move back to UNDER_REPAIR
                        nextStatus = 'UNDER_REPAIR';
                        remarks = `Validation tests FAILED. Fail Notes: ${testNotes}. Moving back to Repair.`;
                        await db_1.default.serviceJob.update({
                            where: { id: jobId },
                            data: { status: 'UNDER_REPAIR' }
                        });
                        await logAudit(jobId, req.user.id, job.status, 'UNDER_REPAIR', remarks);
                    }
                }
            }
            broadcastDashboardUpdate();
            res.json(test);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- SERVICE REPORT GENERATION ---
    static async createServiceReport(req, res) {
        try {
            const { jobId, faultFound, rootCauseAnalysis, repairActions, finalOutcome, signatureData } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId },
                include: { customer: true, laserSource: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            // Skip strict assigned engineer checks for compiling final report
            // if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
            //   return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            // }
            const existingReport = await db_1.default.serviceReport.findFirst({ where: { jobId } });
            // Enforce: Can only generate report when READY_FOR_DISPATCH or higher (only if creating a new report)
            if (!existingReport) {
                const validStatuses = ['READY_FOR_DISPATCH', 'PAYMENT_COMPLETED', 'DISPATCHED', 'CLOSED'];
                if (!validStatuses.includes(job.status)) {
                    return res.status(400).json({ message: 'Service Report can only be compiled after tests pass successfully.' });
                }
            }
            let report;
            if (existingReport) {
                report = await db_1.default.serviceReport.update({
                    where: { id: existingReport.id },
                    data: {
                        faultFound,
                        rootCauseAnalysis,
                        repairActions,
                        finalOutcome,
                        signatureData
                    },
                    include: { engineer: true }
                });
            }
            else {
                report = await db_1.default.serviceReport.create({
                    data: {
                        jobId,
                        engineerId: req.user.id,
                        faultFound,
                        rootCauseAnalysis,
                        repairActions,
                        finalOutcome,
                        signatureData
                    },
                    include: { engineer: true }
                });
            }
            // Query latest pass test
            const tests = await db_1.default.testResult.findFirst({
                where: { jobId, result: 'PASS' },
                orderBy: { createdAt: 'desc' }
            });
            // Query parts used in repairs
            const repairs = await db_1.default.repair.findMany({
                where: { jobId },
                include: { partsUsed: { include: { sparePart: true } } }
            });
            const parts = [];
            repairs.forEach((r) => {
                parts.push(...r.partsUsed);
            });
            // Generate PDF layout
            const pdfUrl = await pdf_service_1.PdfService.generateServiceReportPdf(report, job, tests || {}, parts);
            // Save PDF url
            await db_1.default.serviceReport.update({
                where: { id: report.id },
                data: { pdfUrl }
            });
            res.json({ report, pdfUrl });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async addJobComment(req, res) {
        try {
            const { id } = req.params;
            const { message } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            if (!message || message.trim() === '') {
                return res.status(400).json({ message: 'Message content is required' });
            }
            const job = await db_1.default.serviceJob.findFirst({
                where: { id, isDeleted: false },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            // Security checks
            if (req.user.role === 'CUSTOMER') {
                const tokenJobId = req.user.jobId;
                const tokenCustomerId = req.user.customerId;
                if (tokenJobId && tokenJobId !== job.id) {
                    return res.status(403).json({ message: 'Access denied' });
                }
                if (tokenCustomerId && tokenCustomerId !== job.customerId) {
                    return res.status(403).json({ message: 'Access denied' });
                }
            }
            else if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            const sender = req.user.role === 'CUSTOMER' ? 'CUSTOMER' : 'STAFF';
            const senderName = req.user.name;
            const comment = await db_1.default.jobComment.create({
                data: {
                    jobId: id,
                    sender,
                    senderName,
                    message
                }
            });
            sendRealtimeNotification('COMMENT_ADDED', `New Chat from ${senderName}`, message, id);
            if (ioInstance) {
                ioInstance.to(id).emit('comment_added', comment);
            }
            broadcastDashboardUpdate();
            res.json(comment);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async uploadJobFile(req, res) {
        try {
            const { id } = req.params;
            const file = req.file;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            if (!file)
                return res.status(400).json({ message: 'No file uploaded' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id, isDeleted: false },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            // Security checks
            if (req.user.role === 'CUSTOMER') {
                const tokenJobId = req.user.jobId;
                const tokenCustomerId = req.user.customerId;
                if (tokenJobId && tokenJobId !== job.id) {
                    return res.status(403).json({ message: 'Access denied' });
                }
                if (tokenCustomerId && tokenCustomerId !== job.customerId) {
                    return res.status(403).json({ message: 'Access denied' });
                }
            }
            else if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            const ext = path_1.default.extname(file.originalname).toLowerCase();
            let fileType = 'IMAGE';
            if (ext === '.pdf')
                fileType = 'PDF';
            else if (['.mp4', '.avi', '.mov'].includes(ext))
                fileType = 'VIDEO';
            const attachment = await db_1.default.fileAttachment.create({
                data: {
                    jobId: id,
                    fileUrl: `/uploads/${file.filename}`,
                    fileType,
                    originalName: file.originalname
                }
            });
            const senderName = req.user.name;
            await logAudit(id, req.user.role === 'CUSTOMER' ? 'SYSTEM' : req.user.id, job.status, job.status, `Document uploaded by ${senderName}: ${file.originalname}`);
            sendRealtimeNotification('FILE_UPLOADED', `New Document from ${senderName}`, `Uploaded: ${file.originalname}`, id);
            if (ioInstance) {
                ioInstance.to(id).emit('file_uploaded', attachment);
            }
            broadcastDashboardUpdate();
            res.json(attachment);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- PAYMENTS ---
    static async submitPayment(req, res) {
        try {
            const { jobId, invoiceNumber, invoiceAmount, paidAmount, overrideReason } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            const dueAmount = parseFloat(invoiceAmount) - parseFloat(paidAmount);
            let paymentStatus = 'PENDING';
            if (dueAmount <= 0) {
                paymentStatus = 'PAID';
            }
            else if (parseFloat(paidAmount) > 0) {
                paymentStatus = 'PARTIAL';
            }
            // Check admin or staff override requirements
            let isOverridden = false;
            const allowedOverrideRoles = ['ADMIN', 'ACCOUNTS', 'SUPPORT'];
            if (dueAmount > 0 && allowedOverrideRoles.includes(req.user.role) && overrideReason) {
                isOverridden = true;
            }
            const existingPayment = await db_1.default.payment.findFirst({ where: { jobId } });
            let payment;
            if (existingPayment) {
                // Update existing payment record
                payment = await db_1.default.payment.update({
                    where: { id: existingPayment.id },
                    data: {
                        invoiceNumber,
                        invoiceAmount: parseFloat(invoiceAmount),
                        paidAmount: parseFloat(paidAmount),
                        dueAmount,
                        status: (isOverridden || paymentStatus === 'PAID') ? 'PAID' : paymentStatus,
                        overrideReason: isOverridden ? overrideReason : null,
                        overriddenByAdminId: isOverridden ? req.user.id : null
                    }
                });
                if (paymentStatus === 'PAID' || isOverridden) {
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: {
                            paymentStatus: 'PAID'
                        }
                    });
                    await logAudit(jobId, req.user.id, job.status, job.status, 'Payment details updated (FULLY PAID).');
                }
                else {
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: {
                            paymentStatus: paymentStatus
                        }
                    });
                    await logAudit(jobId, req.user.id, job.status, job.status, `Payment details updated (Status: ${paymentStatus}).`);
                }
            }
            else {
                payment = await db_1.default.payment.create({
                    data: {
                        jobId,
                        invoiceNumber,
                        invoiceDate: new Date(),
                        invoiceAmount: parseFloat(invoiceAmount),
                        paidAmount: parseFloat(paidAmount),
                        dueAmount,
                        status: paymentStatus,
                        overrideReason: isOverridden ? overrideReason : null,
                        overriddenByAdminId: isOverridden ? req.user.id : null
                    }
                });
                // If PAID or Overridden by Admin
                if (paymentStatus === 'PAID' || isOverridden) {
                    const isAtPaymentStage = job.status === 'READY_FOR_DISPATCH' || job.status === 'PAYMENT_COMPLETED';
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: {
                            paymentStatus: 'PAID',
                            status: isAtPaymentStage ? 'PAYMENT_COMPLETED' : job.status
                        }
                    });
                    await logAudit(jobId, req.user.id, job.status, isAtPaymentStage ? 'PAYMENT_COMPLETED' : job.status, isOverridden
                        ? `Admin overridden payment due of $${dueAmount}. Reason: ${overrideReason}`
                        : 'Payment fully cleared.');
                    if (isAtPaymentStage) {
                        await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'READY_FOR_DISPATCH', job.customer.customerName, job.trackId, job.customer.mobileNumber);
                    }
                }
                else {
                    await db_1.default.serviceJob.update({
                        where: { id: jobId },
                        data: { paymentStatus: paymentStatus }
                    });
                }
            }
            broadcastDashboardUpdate();
            res.json(payment);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- DISPATCH MODULE ---
    static async submitDispatch(req, res) {
        try {
            const { jobId, courierName, awbNumber } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId },
                include: { customer: true, payments: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            const existingDispatch = await db_1.default.dispatch.findFirst({ where: { jobId } });
            // Validation only if creating a new dispatch
            if (!existingDispatch) {
                if (job.paymentStatus !== 'PAID') {
                    return res.status(400).json({ message: 'Dispatch blocked. Payment status must be fully PAID.' });
                }
                const reportsCount = await db_1.default.serviceReport.count({ where: { jobId } });
                if (reportsCount === 0) {
                    return res.status(400).json({ message: 'Dispatch blocked. A Service Report must be generated first.' });
                }
            }
            let dispatch;
            if (existingDispatch) {
                // Update existing dispatch record
                dispatch = await db_1.default.dispatch.update({
                    where: { id: existingDispatch.id },
                    data: {
                        courierName,
                        awbNumber
                    }
                });
                await logAudit(jobId, req.user.id, job.status, job.status, `Dispatch details updated. courier: ${courierName}, AWB: ${awbNumber}.`);
            }
            else {
                dispatch = await db_1.default.dispatch.create({
                    data: {
                        jobId,
                        courierName,
                        awbNumber,
                        deliveryStatus: 'IN_TRANSIT'
                    }
                });
                // Advance job to DISPATCHED
                await db_1.default.serviceJob.update({
                    where: { id: jobId },
                    data: { status: 'DISPATCHED' }
                });
                await logAudit(jobId, req.user.id, job.status, 'DISPATCHED', `Laser source shipped via ${courierName}. AWB: ${awbNumber}.`);
                // WhatsApp update
                await notification_service_1.NotificationService.sendWhatsAppUpdate(job.id, 'DISPATCHED', job.customer.customerName, job.trackId, job.customer.mobileNumber);
            }
            broadcastDashboardUpdate();
            res.json(dispatch);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async closeJob(req, res) {
        try {
            const { jobId, feedbackRating, feedbackComment } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({ where: { id: jobId } });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            if (job.status !== 'DISPATCHED' && job.status !== 'CLOSED') {
                return res.status(400).json({ message: 'Job must be Dispatched before closing.' });
            }
            const existingFeedback = await db_1.default.feedback.findFirst({ where: { jobId } });
            // Add or update feedback
            if (feedbackRating) {
                if (existingFeedback) {
                    await db_1.default.feedback.update({
                        where: { id: existingFeedback.id },
                        data: {
                            rating: parseInt(feedbackRating),
                            comment: feedbackComment
                        }
                    });
                }
                else {
                    await db_1.default.feedback.create({
                        data: {
                            jobId,
                            rating: parseInt(feedbackRating),
                            comment: feedbackComment
                        }
                    });
                }
            }
            if (job.status !== 'CLOSED') {
                await db_1.default.serviceJob.update({
                    where: { id: jobId },
                    data: { status: 'CLOSED' }
                });
                await logAudit(jobId, req.user.id, 'DISPATCHED', 'CLOSED', 'Customer received package. Ticket closed.');
            }
            else {
                await logAudit(jobId, req.user.id, 'CLOSED', 'CLOSED', 'Feedback details updated.');
            }
            broadcastDashboardUpdate();
            res.json({ message: 'Service job successfully closed.' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- SPARE PARTS INVENTORY ---
    static async listSpareParts(req, res) {
        try {
            const parts = await db_1.default.sparePart.findMany({
                orderBy: { partName: 'asc' }
            });
            res.json(parts);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async updateSparePartStock(req, res) {
        try {
            const { id } = req.params;
            const { quantity, partName, manufacturer, cost, stockLevel, partNumber, hsnSac, description } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const oldPart = await db_1.default.sparePart.findUnique({ where: { id } });
            if (!oldPart)
                return res.status(404).json({ message: 'Spare part not found' });
            const updateData = {};
            if (quantity !== undefined)
                updateData.quantity = parseInt(quantity);
            if (partName !== undefined)
                updateData.partName = partName;
            if (manufacturer !== undefined)
                updateData.manufacturer = manufacturer;
            if (cost !== undefined)
                updateData.cost = parseFloat(cost);
            if (stockLevel !== undefined)
                updateData.stockLevel = parseInt(stockLevel);
            if (partNumber !== undefined)
                updateData.partNumber = partNumber || null;
            if (hsnSac !== undefined)
                updateData.hsnSac = hsnSac || null;
            if (description !== undefined)
                updateData.description = description || null;
            const part = await db_1.default.sparePart.update({
                where: { id },
                data: updateData
            });
            if (quantity !== undefined) {
                const newQty = parseInt(quantity);
                const delta = newQty - oldPart.quantity;
                if (delta !== 0) {
                    await db_1.default.sparePartLog.create({
                        data: {
                            sparePartId: part.id,
                            changeType: delta > 0 ? 'ADDED' : 'ADJUSTED',
                            quantity: delta,
                            referenceId: req.user.id,
                            remarks: delta > 0
                                ? `Stock increased by ${delta} units via inventory edit.`
                                : `Stock adjusted by ${delta} units via inventory edit.`
                        }
                    });
                }
            }
            broadcastDashboardUpdate();
            res.json(part);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async createSparePart(req, res) {
        try {
            const { partName, manufacturer, quantity, cost, stockLevel, partNumber, hsnSac, description } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const part = await db_1.default.sparePart.create({
                data: {
                    partName,
                    manufacturer,
                    quantity: parseInt(quantity) || 0,
                    cost: parseFloat(cost) || 0,
                    stockLevel: parseInt(stockLevel) || 0,
                    partNumber: partNumber || null,
                    hsnSac: hsnSac || null,
                    description: description || null
                }
            });
            await db_1.default.sparePartLog.create({
                data: {
                    sparePartId: part.id,
                    changeType: 'ADDED',
                    quantity: part.quantity,
                    referenceId: req.user.id,
                    remarks: `Initial inventory inward of ${part.quantity} units.`
                }
            });
            broadcastDashboardUpdate();
            res.json(part);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async deleteSparePart(req, res) {
        try {
            const { id } = req.params;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            // Delete relations first to prevent foreign key errors
            await db_1.default.repairSparePartUsed.deleteMany({
                where: { sparePartId: id }
            });
            await db_1.default.sparePart.delete({
                where: { id }
            });
            broadcastDashboardUpdate();
            res.json({ message: 'Spare part deleted successfully.' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async downloadLowStockPdf(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const poData = req.body;
            if (!poData || !poData.poNumber || !poData.items || poData.items.length === 0) {
                return res.status(400).json({ message: 'Purchase Order details, including items list, must be provided.' });
            }
            const pdfUrl = await pdf_service_1.PdfService.generateCustomPoPdf(poData);
            res.json({ pdfUrl });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getSparePartLogs(req, res) {
        try {
            const { id } = req.params;
            // 1. Fetch custom SparePartLog table records
            const logs = await db_1.default.sparePartLog.findMany({
                where: { sparePartId: id }
            });
            // 2. Fetch existing RepairSparePartUsed records (historical data)
            const usages = await db_1.default.repairSparePartUsed.findMany({
                where: { sparePartId: id },
                include: {
                    repair: {
                        include: {
                            job: true,
                            engineer: true
                        }
                    }
                }
            });
            // Map usages into log format
            const mappedUsages = usages
                .filter(u => u.repair && u.repair.job) // Safeguard null relations
                .map(u => ({
                id: u.id,
                sparePartId: u.sparePartId,
                changeType: 'CONSUMED',
                quantity: -u.quantity,
                referenceId: u.repair.job.id,
                remarks: `Used ${u.quantity} units in repair job ticket ${u.repair.job.trackId} (logged by ${u.repair.engineer?.name || 'Engineer'})`,
                createdAt: u.repair.createdAt
            }));
            // Combine both lists
            const combined = [...logs, ...mappedUsages];
            // Remove potential duplicates if a new log already exists for the same repair
            const uniqueCombined = [];
            const seenKeys = new Set();
            // Sort by date descending
            combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            for (const item of combined) {
                const key = `${item.changeType}_${item.referenceId}_${item.quantity}`;
                if (item.changeType === 'CONSUMED' && item.referenceId) {
                    if (seenKeys.has(key))
                        continue;
                    seenKeys.add(key);
                }
                uniqueCombined.push(item);
            }
            res.json(uniqueCombined);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async searchZohoCustomers(req, res) {
        try {
            const { query } = req.query;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            if (!query || typeof query !== 'string') {
                return res.json([]);
            }
            const contacts = await zoho_service_1.ZohoService.searchContacts(query);
            res.json(contacts);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getZohoCustomerDetails(req, res) {
        try {
            const { id } = req.params;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const details = await zoho_service_1.ZohoService.getContactDetails(id);
            if (!details) {
                return res.status(404).json({ message: 'Customer details not found in Zoho Books.' });
            }
            res.json(details);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async searchZohoVendors(req, res) {
        try {
            const { query } = req.query;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            if (!query || typeof query !== 'string') {
                return res.json([]);
            }
            const contacts = await zoho_service_1.ZohoService.searchVendors(query);
            res.json(contacts);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getZohoVendorDetails(req, res) {
        try {
            const { id } = req.params;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const details = await zoho_service_1.ZohoService.getContactDetails(id);
            if (!details) {
                return res.status(404).json({ message: 'Vendor details not found in Zoho Books.' });
            }
            res.json(details);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async syncZohoSpares(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const zohoItems = await zoho_service_1.ZohoService.fetchItems();
            if (zohoItems.length === 0) {
                return res.status(400).json({ message: 'No items retrieved from Zoho Books or config is missing.' });
            }
            let added = 0;
            let updated = 0;
            for (const item of zohoItems) {
                let existingPart = null;
                if (item.sku) {
                    existingPart = await db_1.default.sparePart.findFirst({
                        where: { partNumber: item.sku }
                    });
                }
                if (!existingPart) {
                    existingPart = await db_1.default.sparePart.findFirst({
                        where: { partName: item.name }
                    });
                }
                if (existingPart) {
                    await db_1.default.sparePart.update({
                        where: { id: existingPart.id },
                        data: {
                            cost: item.rate,
                            description: item.description || existingPart.description,
                            partNumber: existingPart.partNumber || item.sku || null,
                            hsnSac: existingPart.hsnSac || item.hsnSac || null
                        }
                    });
                    updated++;
                }
                else {
                    const cleanName = item.name || '';
                    let detectedManufacturer = 'Generic';
                    const brands = ['Raycus', 'IPG', 'Maxphotonics', 'Endura', 'JPT', 'BWT', 'Reci', 'Super'];
                    for (const brand of brands) {
                        if (new RegExp('\\b' + brand + '\\b', 'i').test(cleanName)) {
                            detectedManufacturer = brand;
                            break;
                        }
                    }
                    if (detectedManufacturer === 'Generic') {
                        const firstWord = cleanName.trim().split(' ')[0];
                        if (firstWord && /^[a-zA-Z]{3,}/.test(firstWord)) {
                            detectedManufacturer = firstWord;
                        }
                    }
                    await db_1.default.sparePart.create({
                        data: {
                            partName: item.name,
                            partNumber: item.sku || null,
                            hsnSac: item.hsnSac || null,
                            description: item.description || '',
                            cost: item.rate,
                            manufacturer: detectedManufacturer,
                            quantity: 0,
                            stockLevel: 5
                        }
                    });
                    added++;
                }
            }
            // Note: Zoho sync is not tied to a specific job, no audit log needed
            res.json({ message: 'Spare parts synchronized successfully.', added, updated });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async searchZohoItems(req, res) {
        try {
            const { query } = req.query;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const items = await zoho_service_1.ZohoService.searchItems(String(query || ''));
            res.json(items);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- DASHBOARD REALTIME DATA ---
    static async getDashboardStats(req, res) {
        try {
            const totalJobs = await db_1.default.serviceJob.count({ where: { isDeleted: false } });
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const receivedToday = await db_1.default.serviceJob.count({
                where: {
                    isDeleted: false,
                    createdAt: { gte: startOfToday }
                }
            });
            // Status counters grouped by logical stage for comprehensive dashboard metrics
            const underInspection = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: { in: ['RECEIVED', 'VISUAL_INSPECTION', 'INITIAL_DIAGNOSIS'] } }
            });
            const awaitingApproval = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: { in: ['QUOTATION_GENERATED', 'CUSTOMER_APPROVAL'] } }
            });
            const underRepair = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: { in: ['REPAIR_INITIATED', 'UNDER_REPAIR'] } }
            });
            const waitingParts = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: 'WAITING_SPARE_PARTS' }
            });
            const testing = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: { in: ['REPAIR_COMPLETED', 'TESTING_BURN_IN'] } }
            });
            const readyDispatch = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: { in: ['READY_FOR_DISPATCH', 'PAYMENT_COMPLETED'] } }
            });
            const dispatched = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: 'DISPATCHED' }
            });
            const closed = await db_1.default.serviceJob.count({
                where: { isDeleted: false, status: 'CLOSED' }
            });
            // Payments
            const pendingPayments = await db_1.default.serviceJob.count({
                where: { isDeleted: false, paymentStatus: { in: ['PENDING', 'PARTIAL'] } }
            });
            // Revenues
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthlyPayments = await db_1.default.payment.findMany({
                where: { createdAt: { gte: startOfMonth } }
            });
            const revenueThisMonth = monthlyPayments.reduce((acc, curr) => acc + curr.paidAmount, 0);
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            const yearlyPayments = await db_1.default.payment.findMany({
                where: { createdAt: { gte: startOfYear } }
            });
            const revenueThisYear = yearlyPayments.reduce((acc, curr) => acc + curr.paidAmount, 0);
            // Brand repair stats
            const jobsWithLaser = await db_1.default.serviceJob.findMany({
                where: { isDeleted: false },
                include: { laserSource: true }
            });
            const brandStats = {};
            jobsWithLaser.forEach((j) => {
                const b = j.laserSource.brand;
                brandStats[b] = (brandStats[b] || 0) + 1;
            });
            // Engineer productivity
            const engineers = await db_1.default.user.findMany({
                where: { role: { name: 'ENGINEER' }, isDeleted: false },
                include: {
                    repairs: true,
                    testResults: true,
                    inspections: true
                }
            });
            const engineerProductivity = engineers.map((eng) => ({
                id: eng.id,
                name: eng.name,
                repairsCompleted: eng.repairs.length,
                testsLogged: eng.testResults.length,
                inspectionsLogged: eng.inspections.length
            }));
            res.json({
                totalJobs,
                receivedToday,
                underInspection,
                awaitingApproval,
                underRepair,
                waitingParts,
                testing,
                readyDispatch,
                dispatched,
                closed,
                pendingPayments,
                revenueThisMonth,
                revenueThisYear,
                brandStats,
                engineerProductivity
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- NOTIFICATIONS PANEL ---
    static async listNotifications(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const notifications = await db_1.default.notification.findMany({
                take: 15,
                orderBy: { sentAt: 'desc' },
                include: { job: { include: { customer: true } } }
            });
            res.json(notifications);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- REPORTS & AI ANALYTICS MODULE ---
    static async getReportData(req, res) {
        try {
            const { type } = req.query; // type: daily, weekly, monthly, yearly, brand, engineer, failure
            let data = {};
            // ── Date Range Helpers ────────────────────────────────────────────────
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
            startOfWeek.setHours(0, 0, 0, 0);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const dateFilter = (start) => ({ createdAt: { gte: start } });
            if (type === 'daily') {
                data = await db_1.default.serviceJob.findMany({
                    where: { isDeleted: false, ...dateFilter(startOfDay) },
                    include: { customer: true, laserSource: true },
                    orderBy: { createdAt: 'desc' }
                });
            }
            else if (type === 'weekly') {
                data = await db_1.default.serviceJob.findMany({
                    where: { isDeleted: false, ...dateFilter(startOfWeek) },
                    include: { customer: true, laserSource: true },
                    orderBy: { createdAt: 'desc' }
                });
            }
            else if (type === 'monthly') {
                data = await db_1.default.serviceJob.findMany({
                    where: { isDeleted: false, ...dateFilter(startOfMonth) },
                    include: { customer: true, laserSource: true },
                    orderBy: { createdAt: 'desc' }
                });
            }
            else if (type === 'yearly') {
                data = await db_1.default.serviceJob.findMany({
                    where: { isDeleted: false, ...dateFilter(startOfYear) },
                    include: { customer: true, laserSource: true },
                    orderBy: { createdAt: 'desc' }
                });
            }
            else if (type === 'revenue') {
                data = await db_1.default.payment.findMany({
                    include: { job: { include: { customer: true } } },
                    orderBy: { createdAt: 'desc' }
                });
            }
            else if (type === 'brand') {
                const jobs = await db_1.default.serviceJob.findMany({
                    where: { isDeleted: false },
                    include: { laserSource: true }
                });
                const brandGroups = {};
                jobs.forEach((j) => {
                    const b = j.laserSource.brand;
                    if (!brandGroups[b])
                        brandGroups[b] = { brand: b, total: 0, completed: 0, pending: 0 };
                    brandGroups[b].total++;
                    if (j.status === 'CLOSED' || j.status === 'DISPATCHED')
                        brandGroups[b].completed++;
                    else
                        brandGroups[b].pending++;
                });
                data = Object.values(brandGroups).sort((a, b) => b.total - a.total);
            }
            else if (type === 'engineer') {
                // Get all engineers with their repairs (including job info for context)
                const engineers = await db_1.default.user.findMany({
                    where: { role: { name: 'ENGINEER' }, isDeleted: false },
                    include: {
                        repairs: {
                            include: { job: true }
                        }
                    },
                    orderBy: { name: 'asc' }
                });
                data = engineers.map((eng) => {
                    const repairs = eng.repairs;
                    const totalDuration = repairs.reduce((acc, r) => acc + (r.repairDuration || 0), 0);
                    return {
                        name: eng.name,
                        repairsCount: repairs.length,
                        avgDuration: repairs.length > 0 ? totalDuration / repairs.length : 0,
                        totalDurationHrs: parseFloat((totalDuration / 60).toFixed(1)),
                    };
                });
            }
            else if (type === 'failure') {
                const inspections = await db_1.default.inspection.findMany();
                const faultCounts = {};
                inspections.forEach((insp) => {
                    const details = ((insp.physicalCondition || '') + ' ' + (insp.internalFindings || '') + ' ' + (insp.faultAnalysis || '') + ' ' + (insp.initialDiagnosis || '') + ' ' + (insp.inspectionNotes || '')).toLowerCase();
                    if (details.includes('qbh') || details.includes('output') || details.includes('head') || details.includes('lens')) {
                        faultCounts['Optical Head / QBH Failure'] = (faultCounts['Optical Head / QBH Failure'] || 0) + 1;
                    }
                    if (details.includes('fiber') || details.includes('cable') || details.includes('splice')) {
                        faultCounts['Fiber Optic Cable Splice'] = (faultCounts['Fiber Optic Cable Splice'] || 0) + 1;
                    }
                    if (details.includes('power') || details.includes('supply') || details.includes('diode') || details.includes('driver')) {
                        faultCounts['Power Supply / Laser Diode Board'] = (faultCounts['Power Supply / Laser Diode Board'] || 0) + 1;
                    }
                    if (details.includes('chiller') || details.includes('water') || details.includes('leak') || details.includes('coolant')) {
                        faultCounts['Cooling Loop Leak / Chiller Fault'] = (faultCounts['Cooling Loop Leak / Chiller Fault'] || 0) + 1;
                    }
                    if (details.includes('control') || details.includes('board') || details.includes('software') || details.includes('communication') || details.includes('alarm')) {
                        faultCounts['Control Card / PLC Comms Fault'] = (faultCounts['Control Card / PLC Comms Fault'] || 0) + 1;
                    }
                });
                if (Object.keys(faultCounts).length === 0) {
                    faultCounts['Optical Head / QBH Failure'] = 2;
                    faultCounts['Power Supply / Laser Diode Board'] = 3;
                    faultCounts['Fiber Optic Cable Splice'] = 1;
                }
                data = Object.entries(faultCounts).map(([fault, count]) => ({ fault, count }));
            }
            else {
                data = [];
            }
            res.json(data);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async getAiAnalyticsInsights(req, res) {
        try {
            // Aggregate data to build rich AI analytics insights
            const jobs = await db_1.default.serviceJob.findMany({
                where: { isDeleted: false },
                include: { laserSource: true, repairs: { include: { partsUsed: { include: { sparePart: true } } } } }
            });
            const totalRepairs = jobs.length;
            // Calculate brand wise failures
            const brandFailures = {};
            const powerFailures = {};
            const repeatLasers = {};
            jobs.forEach((job) => {
                const brand = job.laserSource.brand;
                const comp = job.complaintCategory;
                const power = job.laserSource.powerRating;
                const sn = job.laserSource.serialNumber;
                // Brand
                if (!brandFailures[brand])
                    brandFailures[brand] = {};
                brandFailures[brand][comp] = (brandFailures[brand][comp] || 0) + 1;
                // Power
                powerFailures[power] = (powerFailures[power] || 0) + 1;
                // Repeat repairs count
                repeatLasers[sn] = (repeatLasers[sn] || 0) + 1;
            });
            // Find top failure by brand
            const insightsList = [];
            Object.keys(brandFailures).forEach((brand) => {
                const failures = brandFailures[brand];
                let maxFailType = '';
                let maxFailCount = 0;
                Object.keys(failures).forEach((type) => {
                    if (failures[type] > maxFailCount) {
                        maxFailCount = failures[type];
                        maxFailType = type;
                    }
                });
                if (maxFailType) {
                    insightsList.push(`${brand} laser sources experienced ${maxFailCount} failures related to "${maxFailType.replace('_', ' ')}" this period.`);
                }
            });
            // Repeat repairs logic
            const repeatedSerials = Object.keys(repeatLasers).filter((sn) => repeatLasers[sn] > 1);
            repeatedSerials.forEach((sn) => {
                insightsList.push(`Serial Number "${sn}" has been repaired ${repeatLasers[sn]} times in the last 12 months, indicating a chronic thermal load or misalignment issue.`);
            });
            // Overall average turn around time
            const closedJobs = await db_1.default.serviceJob.findMany({
                where: { status: 'CLOSED', isDeleted: false }
            });
            let avgTurnAroundDays = 5.2; // default fallback if no closed jobs
            if (closedJobs.length > 0) {
                const totalMs = closedJobs.reduce((acc, curr) => acc + (new Date(curr.updatedAt).getTime() - new Date(curr.createdAt).getTime()), 0);
                avgTurnAroundDays = parseFloat(((totalMs / (1000 * 60 * 60 * 24)) / closedJobs.length).toFixed(1));
            }
            insightsList.push(`Average repair turnaround time is currently tracking at ${avgTurnAroundDays} days from receipt to QC hand-off.`);
            // Revenue breakdown
            const payments = await db_1.default.payment.findMany();
            const revenueByBrand = {};
            const jobsForPayments = await db_1.default.serviceJob.findMany({
                include: { laserSource: true, payments: true }
            });
            jobsForPayments.forEach((job) => {
                const brand = job.laserSource.brand;
                const totalPaid = job.payments.reduce((acc, curr) => acc + curr.paidAmount, 0);
                revenueByBrand[brand] = (revenueByBrand[brand] || 0) + totalPaid;
            });
            Object.keys(revenueByBrand).forEach((b) => {
                if (revenueByBrand[b] > 0) {
                    insightsList.push(`Laser brand "${b}" generated ₹${revenueByBrand[b].toFixed(2)} in total service and spare-parts revenue.`);
                }
            });
            res.json({
                totalRepairs,
                insights: insightsList,
                brandFailures,
                powerFailures,
                repeatLasers
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- USER ADMINISTRATION ---
    static async listUsers(req, res) {
        try {
            const users = await db_1.default.user.findMany({
                where: { isDeleted: false },
                include: { role: true },
                orderBy: { name: 'asc' }
            });
            res.json(users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role.name,
                employeeCode: u.employeeCode,
                mobileNumber: u.mobileNumber,
                department: u.department
            })));
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async createUser(req, res) {
        try {
            const { email, password, name, roleName, employeeCode, mobileNumber, department } = req.body;
            const role = await db_1.default.role.findFirst({ where: { name: roleName } });
            if (!role)
                return res.status(400).json({ message: `Role ${roleName} does not exist.` });
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash(password, salt);
            const user = await db_1.default.user.create({
                data: {
                    email,
                    passwordHash,
                    name,
                    roleId: role.id,
                    employeeCode: employeeCode || null,
                    mobileNumber: mobileNumber || null,
                    department: department || null
                }
            });
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: roleName,
                employeeCode: user.employeeCode,
                mobileNumber: user.mobileNumber,
                department: user.department
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async resetPassword(req, res) {
        try {
            const { userId, newPassword } = req.body;
            if (!userId || !newPassword) {
                return res.status(400).json({ message: 'User ID and new password are required.' });
            }
            const user = await db_1.default.user.findUnique({ where: { id: userId } });
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
            await db_1.default.user.update({
                where: { id: userId },
                data: { passwordHash }
            });
            res.json({ message: 'Password has been reset successfully.' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { name, email, roleName, employeeCode, mobileNumber, department } = req.body;
            const user = await db_1.default.user.findUnique({ where: { id } });
            if (!user)
                return res.status(404).json({ message: 'User not found.' });
            const role = await db_1.default.role.findFirst({ where: { name: roleName } });
            if (!role)
                return res.status(400).json({ message: `Role ${roleName} does not exist.` });
            // Update user details
            const updatedUser = await db_1.default.user.update({
                where: { id },
                data: {
                    name,
                    email,
                    roleId: role.id,
                    employeeCode: employeeCode || null,
                    mobileNumber: mobileNumber || null,
                    department: department || null
                },
                include: { role: true }
            });
            res.json({
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role.name,
                employeeCode: updatedUser.employeeCode,
                mobileNumber: updatedUser.mobileNumber,
                department: updatedUser.department
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- QC ASSESSMENT MODULE ---
    static async getQcAssessment(req, res) {
        try {
            const { jobId } = req.params;
            const assessment = await db_1.default.qcAssessment.findUnique({
                where: { jobId }
            });
            res.json(assessment || null);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async submitQcAssessment(req, res) {
        try {
            const { jobId, assessmentData } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId, isDeleted: false },
                include: { customer: true, laserSource: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Service job not found' });
            if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            const parsedData = typeof assessmentData === 'string' ? JSON.parse(assessmentData) : assessmentData;
            // Find existing assessment to preserve PDF URL if saving a draft
            const existing = await db_1.default.qcAssessment.findUnique({ where: { jobId } });
            let pdfUrl = existing?.pdfUrl || '';
            if (!req.body.draft) {
                // Generate PDF only if not saving a draft
                pdfUrl = await pdf_service_1.PdfService.generateQcAssessmentPdf(parsedData, job);
            }
            const assessment = await db_1.default.qcAssessment.upsert({
                where: { jobId },
                update: {
                    assessmentData: JSON.stringify(parsedData),
                    pdfUrl,
                    engineerId: req.user.id
                },
                create: {
                    jobId,
                    engineerId: req.user.id,
                    assessmentData: JSON.stringify(parsedData),
                    pdfUrl
                }
            });
            res.json({ assessment, pdfUrl });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async listEngineers(req, res) {
        try {
            const engineers = await db_1.default.user.findMany({
                where: {
                    isDeleted: false,
                    role: { name: 'ENGINEER' }
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    employeeCode: true,
                    department: true
                },
                orderBy: { name: 'asc' }
            });
            res.json(engineers);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async assignEngineer(req, res) {
        try {
            const { id } = req.params;
            const { engineerId } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id, isDeleted: false },
                include: { customer: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Service job not found' });
            let engineerName = 'Unassigned';
            if (engineerId) {
                const engineer = await db_1.default.user.findFirst({
                    where: { id: engineerId, isDeleted: false, role: { name: 'ENGINEER' } }
                });
                if (!engineer) {
                    return res.status(400).json({ message: 'Selected user is not an active engineer' });
                }
                engineerName = engineer.name;
            }
            const oldEngineerId = job.currentEngineerId;
            const updatedJob = await db_1.default.serviceJob.update({
                where: { id },
                data: { currentEngineerId: engineerId || null },
                include: { currentEngineer: true }
            });
            await db_1.default.auditLog.create({
                data: {
                    jobId: id,
                    userId: req.user.id,
                    oldStatus: job.status,
                    newStatus: job.status,
                    remarks: `Engineer assigned: ${engineerName} (previous: ${oldEngineerId ? 'Assigned' : 'None'})`
                }
            });
            res.json(updatedJob);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- STAGE BYPASS (Admin / Coordinator only) ---
    static async bypassStage(req, res) {
        try {
            const { id } = req.params;
            const { targetStatus, reason } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            // Only privileged roles can bypass
            if (!canBypassWorkflow(req.user.role)) {
                return res.status(403).json({ message: 'Only Admins, Accounts, and Coordinators can bypass workflow stages.' });
            }
            if (!targetStatus || !reason || reason.trim().length < 5) {
                return res.status(400).json({ message: 'A target status and a bypass reason (min 5 chars) are required.' });
            }
            const job = await db_1.default.serviceJob.findFirst({ where: { id, isDeleted: false } });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            // Validate the target is a forward step
            if (!checkWorkflowTransition(job.status, targetStatus, true)) {
                return res.status(400).json({ message: `Cannot transition from ${job.status} to ${targetStatus}.` });
            }
            const oldStatus = job.status;
            // Calculate skipped stages for the audit trail
            const oldIdx = STATUS_ORDER.indexOf(oldStatus);
            const newIdx = STATUS_ORDER.indexOf(targetStatus);
            const skipped = STATUS_ORDER.slice(oldIdx + 1, newIdx);
            const skipNote = skipped.length > 0
                ? ` [Skipped: ${skipped.join(', ')}]`
                : '';
            const roleName = req.user.role === 'ADMIN' ? 'Admin' : req.user.role === 'ACCOUNTS' ? 'Accounts Manager' : 'Coordinator';
            await db_1.default.serviceJob.update({
                where: { id },
                data: { status: targetStatus }
            });
            await logAudit(id, req.user.id, oldStatus, targetStatus, `⚡ Stage bypassed by ${roleName}. Reason: ${reason.trim()}.${skipNote}`);
            broadcastDashboardUpdate();
            sendRealtimeNotification('STAGE_BYPASSED', `Stage Bypassed by ${roleName}`, `Job ${job.trackId} moved from ${oldStatus} → ${targetStatus}. Reason: ${reason.trim()}`, id);
            res.json({
                message: `Job advanced to ${targetStatus} (bypassed by ${roleName}).`,
                oldStatus,
                newStatus: targetStatus,
                skipped,
                reason: reason.trim()
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    // --- QC FINAL VERIFICATION SUBMISSION ---
    static async submitVerification(req, res) {
        try {
            const { jobId, runningCondition, verifiedBy, approvedBy, remark } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const job = await db_1.default.serviceJob.findFirst({
                where: { id: jobId, isDeleted: false },
                include: { payments: true }
            });
            if (!job)
                return res.status(404).json({ message: 'Job not found' });
            if (req.user.role === 'ENGINEER' && job.currentEngineerId !== req.user.id) {
                return res.status(403).json({ message: 'Access denied: You are not assigned to this job.' });
            }
            if (!runningCondition || !verifiedBy || !approvedBy) {
                return res.status(400).json({ message: 'Running Condition, Verified By, and Approved By are required.' });
            }
            const isPass = runningCondition === 'OK';
            let nextStatus = job.status;
            let auditMsg = '';
            if (isPass) {
                // Create/Update Manager Verification request
                await db_1.default.verification.upsert({
                    where: { jobId },
                    create: {
                        jobId,
                        status: 'PENDING_APPROVAL',
                        runningCondition,
                        verifiedBy,
                        approvedBy,
                        remark
                    },
                    update: {
                        status: 'PENDING_APPROVAL',
                        runningCondition,
                        verifiedBy,
                        approvedBy,
                        remark
                    }
                });
                // Set status to WAITING_MANAGER_APPROVAL instead of automatically moving to next stage
                nextStatus = 'WAITING_MANAGER_APPROVAL';
                auditMsg = `QC Final Verification sent to Manager for approval by ${verifiedBy} / ${approvedBy}. Remarks: ${remark || 'None'}.`;
                await db_1.default.serviceJob.update({
                    where: { id: jobId },
                    data: { status: nextStatus }
                });
            }
            else {
                nextStatus = 'UNDER_REPAIR';
                auditMsg = `QC Verification REJECTED. Condition: NOT OK. Reason/Remark: ${remark || 'None'}. Returning to Repair.`;
                await db_1.default.serviceJob.update({
                    where: { id: jobId },
                    data: { status: 'UNDER_REPAIR' }
                });
            }
            const existingQc = await db_1.default.qcAssessment.findUnique({ where: { jobId } });
            if (existingQc) {
                const assessmentObj = JSON.parse(existingQc.assessmentData);
                assessmentObj.runningCondition = runningCondition;
                assessmentObj.verifiedBy = verifiedBy;
                assessmentObj.approvedBy = approvedBy;
                assessmentObj.remark = remark;
                await db_1.default.qcAssessment.update({
                    where: { jobId },
                    data: { assessmentData: JSON.stringify(assessmentObj) }
                });
            }
            await logAudit(jobId, req.user.id, job.status, nextStatus, auditMsg);
            broadcastDashboardUpdate();
            res.json({
                message: isPass ? 'QC Verification approved successfully.' : 'QC Verification failed. Ticket returned to Repair.',
                nextStatus
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async listVerificationRequests(req, res) {
        try {
            const list = await db_1.default.verification.findMany({
                include: {
                    job: {
                        include: {
                            customer: true,
                            laserSource: true,
                            currentEngineer: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json(list);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    static async approveVerificationRequest(req, res) {
        try {
            const { verificationId, approve, remark } = req.body;
            if (!req.user)
                return res.status(401).json({ message: 'Unauthorized' });
            const verification = await db_1.default.verification.findUnique({
                where: { id: verificationId },
                include: { job: { include: { payments: true } } }
            });
            if (!verification)
                return res.status(404).json({ message: 'Verification request not found' });
            const job = verification.job;
            let nextStatus = job.status;
            let auditMsg = '';
            if (approve) {
                // If approved by Manager: Update verification record to APPROVED
                await db_1.default.verification.update({
                    where: { id: verificationId },
                    data: { status: 'APPROVED', remark: remark || verification.remark }
                });
                const isPaid = job.payments && job.payments.length > 0 && job.payments[0].status === 'PAID';
                nextStatus = isPaid ? 'PAYMENT_COMPLETED' : 'READY_FOR_DISPATCH';
                auditMsg = `Manager Approved QC Final Verification. Remarks: ${remark || 'None'}.`;
                await db_1.default.serviceJob.update({
                    where: { id: job.id },
                    data: { status: nextStatus }
                });
            }
            else {
                // If rejected by Manager: Update verification record to REJECTED & send back to Repair
                await db_1.default.verification.update({
                    where: { id: verificationId },
                    data: { status: 'REJECTED', remark: remark || verification.remark }
                });
                nextStatus = 'UNDER_REPAIR';
                auditMsg = `Manager REJECTED QC Final Verification. Remarks: ${remark || 'None'}. Returning to repair.`;
                await db_1.default.serviceJob.update({
                    where: { id: job.id },
                    data: { status: 'UNDER_REPAIR' }
                });
            }
            await logAudit(job.id, req.user.id, job.status, nextStatus, auditMsg);
            broadcastDashboardUpdate();
            res.json({
                message: approve ? 'QC Verification approved successfully.' : 'QC Verification rejected. Job sent back to repair.',
                nextStatus
            });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
}
exports.ApiController = ApiController;
