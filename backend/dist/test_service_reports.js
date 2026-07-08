"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./config/db"));
async function test() {
    try {
        console.log('Fetching all service reports...');
        const reports = await db_1.default.serviceReport.findMany({
            include: {
                job: true,
                engineer: true
            }
        });
        console.log(`Found ${reports.length} service reports:`);
        for (const r of reports) {
            console.log(`- ID: ${r.id}, Job Track ID: ${r.job.trackId}, Engineer: ${r.engineer.name}, pdfUrl: ${r.pdfUrl}`);
        }
    }
    catch (err) {
        console.error('Error fetching service reports:', err);
    }
    finally {
        await db_1.default.$disconnect();
    }
}
test();
