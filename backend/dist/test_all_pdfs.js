"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./config/db"));
const pdf_service_1 = require("./services/pdf.service");
async function test() {
    try {
        console.log('Fetching a quotation...');
        const quotation = await db_1.default.quotation.findFirst({
            include: { items: true }
        });
        if (quotation) {
            console.log(`Found quotation ID: ${quotation.id}. Fetching associated job...`);
            const job = await db_1.default.serviceJob.findUnique({
                where: { id: quotation.jobId },
                include: { customer: true, laserSource: true }
            });
            if (job) {
                console.log('Generating quotation PDF...');
                const result = await pdf_service_1.PdfService.generateQuotationPdf(quotation, job, quotation.items);
                console.log(`Quotation PDF successfully generated! Saved at: ${result}`);
            }
        }
        else {
            console.log('No quotation found.');
        }
        console.log('Fetching a service report...');
        const report = await db_1.default.serviceReport.findFirst({
            include: { job: { include: { customer: true, laserSource: true } }, engineer: true }
        });
        if (report) {
            console.log(`Found service report ID: ${report.id}. Querying test results & parts...`);
            const tests = await db_1.default.testResult.findFirst({
                where: { jobId: report.jobId, result: 'PASS' }
            });
            const repairs = await db_1.default.repair.findMany({
                where: { jobId: report.jobId },
                include: { partsUsed: { include: { sparePart: true } } }
            });
            const parts = [];
            repairs.forEach((r) => {
                parts.push(...r.partsUsed);
            });
            console.log('Generating service report PDF...');
            const result = await pdf_service_1.PdfService.generateServiceReportPdf(report, report.job, tests || {}, parts);
            console.log(`Service Report PDF successfully generated! Saved at: ${result}`);
        }
        else {
            console.log('No service report found.');
        }
    }
    catch (err) {
        console.error('Error during test:', err);
    }
    finally {
        await db_1.default.$disconnect();
    }
}
test();
