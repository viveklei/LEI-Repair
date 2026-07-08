import { Router } from 'express';
import { ApiController } from '../controllers/api.controller';
import { authenticateJWT, requireRoles } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

// --- PUBLIC AUTH ROUTES ---
router.post('/auth/login', ApiController.login);
router.post('/auth/refresh', ApiController.refreshToken);
router.post('/portal/login', ApiController.customerPortalLogin);
router.get('/public/track/:trackId', ApiController.getPublicJobStatus);

// --- AUTHENTICATED PROFILE ---
router.get('/auth/profile', authenticateJWT, ApiController.getProfile);
router.put('/auth/profile', authenticateJWT, ApiController.updateProfile);

// --- SEARCH & INTELLIGENCE ---
router.get('/search', authenticateJWT, ApiController.globalSearch);
router.get('/laser/verify/:serialNumber', authenticateJWT, ApiController.verifySerialNumber);
router.post('/ocr/scan', authenticateJWT, upload.single('image'), ApiController.scanNameplate);

// --- CUSTOMERS ---
router.get('/customers', authenticateJWT, requireRoles(['SUPPORT', 'ACCOUNTS', 'ADMIN']), ApiController.listCustomers);
router.get('/customers/:id/history', authenticateJWT, ApiController.getCustomerHistory);
router.post('/customers', authenticateJWT, requireRoles(['SUPPORT', 'ADMIN']), ApiController.createCustomer);
router.delete('/customers/:id', authenticateJWT, requireRoles(['ADMIN']), ApiController.deleteCustomer);
router.get('/zoho/customers', authenticateJWT, requireRoles(['SUPPORT', 'ACCOUNTS', 'ADMIN']), ApiController.searchZohoCustomers);
router.get('/zoho/customers/:id', authenticateJWT, requireRoles(['SUPPORT', 'ACCOUNTS', 'ADMIN']), ApiController.getZohoCustomerDetails);
router.get('/zoho/vendors', authenticateJWT, requireRoles(['SUPPORT', 'ACCOUNTS', 'ADMIN', 'ENGINEER']), ApiController.searchZohoVendors);
router.get('/zoho/vendors/:id', authenticateJWT, requireRoles(['SUPPORT', 'ACCOUNTS', 'ADMIN', 'ENGINEER']), ApiController.getZohoVendorDetails);
router.post('/zoho/spares/sync', authenticateJWT, requireRoles(['ADMIN', 'ACCOUNTS']), ApiController.syncZohoSpares);
router.get('/zoho/items', authenticateJWT, requireRoles(['ADMIN', 'ACCOUNTS', 'SUPPORT']), ApiController.searchZohoItems);

// --- SERVICE JOBS ---
router.get('/jobs', authenticateJWT, ApiController.listJobs);
router.get('/jobs/:id', authenticateJWT, ApiController.getJobDetail);
router.get('/jobs/track/:trackId', authenticateJWT, ApiController.getJobIdByTrackId);
router.post('/jobs/:id/whatsapp', authenticateJWT, ApiController.sendManualWhatsAppUpdate);
router.post('/jobs', authenticateJWT, requireRoles(['SUPPORT', 'ADMIN']), upload.array('photos', 5), ApiController.createJob);
router.delete('/jobs/:id', authenticateJWT, requireRoles(['ADMIN']), ApiController.deleteJob);
router.patch('/jobs/:id/priority', authenticateJWT, requireRoles(['ADMIN']), ApiController.updateJobPriority);
router.patch('/jobs/:id/assign', authenticateJWT, requireRoles(['SUPPORT', 'ADMIN', 'ENGINEER']), ApiController.assignEngineer);
router.get('/engineers', authenticateJWT, ApiController.listEngineers);
router.post('/jobs/:id/comments', authenticateJWT, ApiController.addJobComment);
router.post('/jobs/:id/upload', authenticateJWT, upload.single('file'), ApiController.uploadJobFile);
router.post('/jobs/:id/bypass-stage', authenticateJWT, requireRoles(['SUPPORT', 'ADMIN', 'ACCOUNTS']), ApiController.bypassStage);

// --- WORKFLOW EXECUTION PANELS ---
// 1. Inspection (Engineer only)
router.post('/inspection', authenticateJWT, requireRoles(['ENGINEER', 'ADMIN']), upload.array('photos', 5), ApiController.submitInspection);

// 2. Quotation (Accounts only)
router.post('/quotation', authenticateJWT, requireRoles(['ACCOUNTS', 'ADMIN']), ApiController.submitQuotation);
router.get('/quotation/:id/pdf', authenticateJWT, ApiController.downloadQuotationPdf);
router.post('/quotation/:id/approve', authenticateJWT, ApiController.handleQuotationApproval);
router.post('/quotation/:id/undo', authenticateJWT, requireRoles(['ADMIN', 'SUPPORT']), ApiController.undoQuotationDecision);

// 3. Repair (Engineer only)
router.post('/repair/step', authenticateJWT, requireRoles(['ENGINEER', 'ADMIN']), ApiController.submitRepairStep);
router.post('/repair/complete', authenticateJWT, requireRoles(['ENGINEER', 'ADMIN']), ApiController.completeRepair);

// 4. Testing & Burn-In (Engineer only)
router.post('/testing', authenticateJWT, requireRoles(['ENGINEER', 'ADMIN']), upload.array('photos', 5), ApiController.submitTestResults);

// 5. Service Report Compilation
router.post('/report', authenticateJWT, requireRoles(['ENGINEER', 'ADMIN', 'SUPPORT', 'ACCOUNTS']), ApiController.createServiceReport);

// --- QC ASSESSMENT ---
router.get('/qc-assessment/:jobId', authenticateJWT, ApiController.getQcAssessment);
router.post('/qc-assessment', authenticateJWT, requireRoles(['ENGINEER', 'ADMIN']), ApiController.submitQcAssessment);
router.post('/qc-assessment/verification', authenticateJWT, requireRoles(['ENGINEER', 'ADMIN', 'SUPPORT', 'ACCOUNTS']), ApiController.submitVerification);
router.post('/qc-assessment/verification/approve', authenticateJWT, requireRoles(['ADMIN']), ApiController.approveVerificationRequest);
router.get('/qc-assessment/verification/list', authenticateJWT, ApiController.listVerificationRequests);

// 6. Payment Logging (Accounts & Support)
router.post('/payment', authenticateJWT, requireRoles(['ACCOUNTS', 'SUPPORT', 'ADMIN']), ApiController.submitPayment);

// 7. Dispatching (Support & Accounts & Engineers)
router.post('/dispatch', authenticateJWT, requireRoles(['SUPPORT', 'ACCOUNTS', 'ADMIN', 'ENGINEER']), ApiController.submitDispatch);
router.post('/dispatch/close', authenticateJWT, requireRoles(['SUPPORT', 'ADMIN', 'ENGINEER']), ApiController.closeJob);

// --- SPARE PARTS MANAGEMENT ---
router.get('/spare-parts', authenticateJWT, ApiController.listSpareParts);
router.post('/spare-parts', authenticateJWT, requireRoles(['ADMIN']), ApiController.createSparePart);
router.put('/spare-parts/:id', authenticateJWT, requireRoles(['ADMIN']), ApiController.updateSparePartStock);
router.post('/spare-parts/low-stock/pdf', authenticateJWT, requireRoles(['ACCOUNTS', 'ADMIN']), ApiController.downloadLowStockPdf);
router.get('/spare-parts/:id/logs', authenticateJWT, ApiController.getSparePartLogs);
router.delete('/spare-parts/:id', authenticateJWT, requireRoles(['ADMIN']), ApiController.deleteSparePart);

// --- DASHBOARD & ANALYTICS ---
router.get('/dashboard/stats', authenticateJWT, ApiController.getDashboardStats);
router.get('/notifications', authenticateJWT, ApiController.listNotifications);
router.get('/reports/data', authenticateJWT, ApiController.getReportData);
router.get('/reports/ai-insights', authenticateJWT, ApiController.getAiAnalyticsInsights);

// --- ADMIN USER MANAGEMENT ---
router.get('/users', authenticateJWT, requireRoles(['ADMIN']), ApiController.listUsers);
router.post('/users', authenticateJWT, requireRoles(['ADMIN']), ApiController.createUser);
router.put('/users/:id', authenticateJWT, requireRoles(['ADMIN']), ApiController.updateUser);
router.post('/users/reset-password', authenticateJWT, requireRoles(['ADMIN']), ApiController.resetPassword);

export default router;
