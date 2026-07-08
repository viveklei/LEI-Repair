"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const api_controller_1 = require("../controllers/api.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
// --- PUBLIC AUTH ROUTES ---
router.post('/auth/login', api_controller_1.ApiController.login);
router.post('/auth/refresh', api_controller_1.ApiController.refreshToken);
router.post('/portal/login', api_controller_1.ApiController.customerPortalLogin);
router.post('/portal/check-email', api_controller_1.ApiController.checkEmailAddress);
router.get('/public/track/:trackId', api_controller_1.ApiController.getPublicJobStatus);
// --- AUTHENTICATED PROFILE ---
router.get('/auth/profile', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getProfile);
router.put('/auth/profile', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.updateProfile);
// --- SEARCH & INTELLIGENCE ---
router.get('/search', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.globalSearch);
router.get('/laser/verify/:serialNumber', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.verifySerialNumber);
router.post('/ocr/scan', auth_middleware_1.authenticateJWT, upload_middleware_1.upload.single('image'), api_controller_1.ApiController.scanNameplate);
// --- CUSTOMERS ---
router.get('/customers', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ACCOUNTS', 'ADMIN']), api_controller_1.ApiController.listCustomers);
router.get('/customers/:id/history', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getCustomerHistory);
router.post('/customers', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ADMIN']), api_controller_1.ApiController.createCustomer);
router.delete('/customers/:id', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.deleteCustomer);
router.get('/zoho/customers', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ACCOUNTS', 'ADMIN']), api_controller_1.ApiController.searchZohoCustomers);
router.get('/zoho/customers/:id', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ACCOUNTS', 'ADMIN']), api_controller_1.ApiController.getZohoCustomerDetails);
router.get('/zoho/vendors', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ACCOUNTS', 'ADMIN', 'ENGINEER']), api_controller_1.ApiController.searchZohoVendors);
router.get('/zoho/vendors/:id', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ACCOUNTS', 'ADMIN', 'ENGINEER']), api_controller_1.ApiController.getZohoVendorDetails);
router.post('/zoho/spares/sync', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN', 'ACCOUNTS']), api_controller_1.ApiController.syncZohoSpares);
router.get('/zoho/items', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN', 'ACCOUNTS', 'SUPPORT']), api_controller_1.ApiController.searchZohoItems);
// --- SERVICE JOBS ---
router.get('/jobs', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.listJobs);
router.get('/jobs/:id', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getJobDetail);
router.get('/jobs/track/:trackId', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getJobIdByTrackId);
router.post('/jobs/:id/whatsapp', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.sendManualWhatsAppUpdate);
router.post('/jobs', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ADMIN']), upload_middleware_1.upload.array('photos', 5), api_controller_1.ApiController.createJob);
router.delete('/jobs/:id', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.deleteJob);
router.patch('/jobs/:id/priority', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.updateJobPriority);
router.patch('/jobs/:id/assign', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ADMIN', 'ENGINEER']), api_controller_1.ApiController.assignEngineer);
router.get('/engineers', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.listEngineers);
router.post('/jobs/:id/comments', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.addJobComment);
router.post('/jobs/:id/upload', auth_middleware_1.authenticateJWT, upload_middleware_1.upload.single('file'), api_controller_1.ApiController.uploadJobFile);
router.post('/jobs/:id/bypass-stage', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ADMIN', 'ACCOUNTS']), api_controller_1.ApiController.bypassStage);
// --- WORKFLOW EXECUTION PANELS ---
// 1. Inspection (Engineer only)
router.post('/inspection', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ENGINEER', 'ADMIN']), upload_middleware_1.upload.array('photos', 5), api_controller_1.ApiController.submitInspection);
// 2. Quotation (Accounts only)
router.post('/quotation', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ACCOUNTS', 'ADMIN']), api_controller_1.ApiController.submitQuotation);
router.get('/quotation/:id/pdf', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.downloadQuotationPdf);
router.post('/quotation/:id/approve', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.handleQuotationApproval);
router.post('/quotation/:id/undo', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN', 'SUPPORT']), api_controller_1.ApiController.undoQuotationDecision);
// 3. Repair (Engineer only)
router.post('/repair/step', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ENGINEER', 'ADMIN']), api_controller_1.ApiController.submitRepairStep);
router.post('/repair/complete', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ENGINEER', 'ADMIN']), api_controller_1.ApiController.completeRepair);
// 4. Testing & Burn-In (Engineer only)
router.post('/testing', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ENGINEER', 'ADMIN']), upload_middleware_1.upload.array('photos', 5), api_controller_1.ApiController.submitTestResults);
// 5. Service Report Compilation
router.post('/report', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ENGINEER', 'ADMIN', 'SUPPORT', 'ACCOUNTS']), api_controller_1.ApiController.createServiceReport);
// --- QC ASSESSMENT ---
router.get('/qc-assessment/:jobId', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getQcAssessment);
router.post('/qc-assessment', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ENGINEER', 'ADMIN']), api_controller_1.ApiController.submitQcAssessment);
router.post('/qc-assessment/verification', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ENGINEER', 'ADMIN', 'SUPPORT', 'ACCOUNTS']), api_controller_1.ApiController.submitVerification);
router.post('/qc-assessment/verification/approve', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.approveVerificationRequest);
router.get('/qc-assessment/verification/list', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.listVerificationRequests);
// 6. Payment Logging (Accounts & Support)
router.post('/payment', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ACCOUNTS', 'SUPPORT', 'ADMIN']), api_controller_1.ApiController.submitPayment);
// 7. Dispatching (Support & Accounts & Engineers)
router.post('/dispatch', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ACCOUNTS', 'ADMIN', 'ENGINEER']), api_controller_1.ApiController.submitDispatch);
router.post('/dispatch/close', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['SUPPORT', 'ADMIN', 'ENGINEER']), api_controller_1.ApiController.closeJob);
// --- SPARE PARTS MANAGEMENT ---
router.get('/spare-parts', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.listSpareParts);
router.post('/spare-parts', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.createSparePart);
router.put('/spare-parts/:id', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.updateSparePartStock);
router.post('/spare-parts/low-stock/pdf', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ACCOUNTS', 'ADMIN']), api_controller_1.ApiController.downloadLowStockPdf);
router.get('/spare-parts/:id/logs', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getSparePartLogs);
router.delete('/spare-parts/:id', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.deleteSparePart);
// --- DASHBOARD & ANALYTICS ---
router.get('/dashboard/stats', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getDashboardStats);
router.get('/notifications', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.listNotifications);
router.get('/reports/data', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getReportData);
router.get('/reports/ai-insights', auth_middleware_1.authenticateJWT, api_controller_1.ApiController.getAiAnalyticsInsights);
// --- ADMIN USER MANAGEMENT ---
router.get('/users', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.listUsers);
router.post('/users', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.createUser);
router.put('/users/:id', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.updateUser);
router.post('/users/reset-password', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRoles)(['ADMIN']), api_controller_1.ApiController.resetPassword);
exports.default = router;
