"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfService = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const UPLOADS_DIR = path_1.default.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
class PdfService {
    static async generateQuotationPdf(quotation, job, items) {
        const filename = `quotation_${quotation.id}.pdf`;
        const filepath = path_1.default.join(UPLOADS_DIR, filename);
        const doc = new pdfkit_1.default({ size: 'A4', margin: 15 });
        return new Promise((resolve, reject) => {
            const stream = fs_1.default.createWriteStream(filepath);
            doc.pipe(stream);
            // Register Arial Unicode/Standard if Windows, else fall back to Helvetica
            try {
                const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
                const fontBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
                if (fs_1.default.existsSync(fontPath) && fs_1.default.existsSync(fontBoldPath)) {
                    doc.registerFont('CustomFont', fontPath);
                    doc.registerFont('CustomFont-Bold', fontBoldPath);
                }
                else {
                    doc.registerFont('CustomFont', 'Helvetica');
                    doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
                }
            }
            catch (e) {
                doc.registerFont('CustomFont', 'Helvetica');
                doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
            }
            const isHelvetica = doc.font('CustomFont').name === 'Helvetica';
            const currencySymbol = isHelvetica ? 'Rs. ' : '\u20B9';
            const year = new Date(quotation.createdAt).getFullYear().toString().substring(2);
            const seq = job.trackId.split('-')[2] || '00001';
            const estimateNo = `LEIQ${year}-${seq}`;
            const estimateDate = new Date(quotation.createdAt).toLocaleDateString('en-GB');
            // Resolve Place of Supply
            let placeOfSupply = 'Kerala (32)';
            const gstNo = job.customer.gstNumber || '';
            if (gstNo && gstNo.length >= 2) {
                const code = gstNo.substring(0, 2);
                const stateMap = {
                    '33': 'Tamil Nadu (33)',
                    '32': 'Kerala (32)',
                    '27': 'Maharashtra (27)',
                    '07': 'Delhi (07)',
                    '09': 'Uttar Pradesh (09)',
                    '19': 'West Bengal (19)',
                    '29': 'Karnataka (29)',
                    '36': 'Telangana (36)',
                    '24': 'Gujarat (24)'
                };
                if (stateMap[code]) {
                    placeOfSupply = stateMap[code];
                }
            }
            else if (job.customer.address) {
                const addr = job.customer.address.toLowerCase();
                if (addr.includes('kerala'))
                    placeOfSupply = 'Kerala (32)';
                else if (addr.includes('tamil nadu') || addr.includes('tamilnadu'))
                    placeOfSupply = 'Tamil Nadu (33)';
                else if (addr.includes('maharashtra'))
                    placeOfSupply = 'Maharashtra (27)';
                else if (addr.includes('delhi'))
                    placeOfSupply = 'Delhi (07)';
                else if (addr.includes('karnataka'))
                    placeOfSupply = 'Karnataka (29)';
            }
            // 1. Header Box
            doc.rect(15, 15, 565, 100).strokeColor('#d1d5db').lineWidth(0.8).stroke();
            // Logo
            const logoPath = path_1.default.join(__dirname, '..', '..', 'public', 'logo.png');
            if (fs_1.default.existsSync(logoPath)) {
                doc.image(logoPath, 25, 22, { width: 80, height: 80 });
            }
            // Company Info
            doc.font('CustomFont-Bold').fontSize(11).fillColor('#0f172a');
            doc.text('LASER EXPERTS INDIA LLP', 115, 22);
            doc.font('CustomFont').fontSize(7.5).fillColor('#334155');
            doc.text([
                '27/3 ANUMEPALLI',
                'BEGAPALLI ROAD , ZUZUVADI',
                'HOSUR 635126',
                'TAMIL NADU 33',
                'PAN NO AAGFL9943F',
                'GSTIN 33AAGFL9943F1Z6',
                'UDYAM-TN-11-0000905'
            ].join('\n'), 115, 36, { lineGap: 1.5 });
            // Title on Right
            doc.font('CustomFont-Bold').fontSize(22).fillColor('#0f172a');
            doc.text('QUOTATION', 350, 75, { width: 220, align: 'right' });
            // 2. Metadata Box
            doc.rect(15, 120, 565, 50).strokeColor('#d1d5db').stroke();
            doc.moveTo(297, 120).lineTo(297, 170).stroke();
            let yMeta = 125;
            doc.font('CustomFont').fontSize(8.5).fillColor('#334155');
            doc.text('Estimate#', 20, yMeta);
            doc.text('Estimate Date', 20, yMeta + 14);
            doc.text('Reference#', 20, yMeta + 28);
            doc.font('CustomFont-Bold').fillColor('#0f172a');
            doc.text(`: ${estimateNo}`, 105, yMeta);
            doc.text(`: ${estimateDate}`, 105, yMeta + 14);
            doc.text(': REPAIR CHARGES', 105, yMeta + 28);
            doc.font('CustomFont').fillColor('#334155');
            doc.text('Place Of Supply', 305, yMeta);
            doc.font('CustomFont-Bold').fillColor('#0f172a');
            doc.text(`: ${placeOfSupply}`, 390, yMeta);
            // 3. Bill To / Ship To Box
            doc.rect(15, 175, 565, 110).strokeColor('#d1d5db').stroke();
            doc.moveTo(297, 175).lineTo(297, 285).stroke();
            // Title headers
            doc.rect(15, 175, 282, 16).fill('#f3f4f6');
            doc.rect(297, 175, 283, 16).fill('#f3f4f6');
            doc.fillColor('#0f172a').font('CustomFont-Bold').fontSize(8.5).text('Bill To', 20, 179);
            doc.text('Ship To', 302, 179);
            // Customer info
            const customer = job.customer;
            doc.font('CustomFont-Bold').fontSize(9).fillColor('#0f172a').text(customer.companyName.toUpperCase(), 20, 196);
            doc.font('CustomFont').fontSize(8).fillColor('#334155');
            doc.text(customer.address, 20, 208, { width: 260, lineGap: 1.2 });
            // GSTIN bottom aligned inside box
            const bottomGstY = 265;
            doc.font('CustomFont-Bold').fontSize(8).fillColor('#0f172a').text(customer.gstNumber || 'N/A', 20, bottomGstY);
            // Ship To details (same as customer)
            doc.font('CustomFont-Bold').fontSize(9).fillColor('#0f172a').text(customer.companyName.toUpperCase(), 302, 196);
            doc.font('CustomFont').fontSize(8).fillColor('#334155');
            doc.text(customer.address, 302, 208, { width: 260, lineGap: 1.2 });
            doc.font('CustomFont-Bold').fontSize(8).fillColor('#0f172a').text(customer.gstNumber || 'N/A', 302, bottomGstY);
            // 4. Items Table
            let currentY = 295;
            doc.rect(15, currentY, 565, 30).fill('#f3f4f6');
            doc.rect(15, currentY, 565, 30).strokeColor('#d1d5db').stroke();
            const colX = {
                index: 15,
                desc: 40,
                partNum: 220,
                hsn: 285,
                qty: 340,
                rate: 375,
                igst: 430,
                igstRate: 430,
                igstAmt: 455,
                amount: 505,
                end: 580
            };
            doc.strokeColor('#d1d5db');
            doc.moveTo(colX.desc, currentY).lineTo(colX.desc, currentY + 30).stroke();
            doc.moveTo(colX.partNum, currentY).lineTo(colX.partNum, currentY + 30).stroke();
            doc.moveTo(colX.hsn, currentY).lineTo(colX.hsn, currentY + 30).stroke();
            doc.moveTo(colX.qty, currentY).lineTo(colX.qty, currentY + 30).stroke();
            doc.moveTo(colX.rate, currentY).lineTo(colX.rate, currentY + 30).stroke();
            doc.moveTo(colX.igst, currentY).lineTo(colX.igst, currentY + 30).stroke();
            doc.moveTo(colX.amount, currentY).lineTo(colX.amount, currentY + 30).stroke();
            doc.moveTo(colX.igst, currentY + 13).lineTo(colX.amount, currentY + 13).stroke();
            doc.moveTo(colX.igstAmt, currentY + 13).lineTo(colX.igstAmt, currentY + 30).stroke();
            doc.fillColor('#0f172a').font('CustomFont-Bold').fontSize(8);
            doc.text('#', colX.index, currentY + 11, { width: 25, align: 'center' });
            doc.text('Item & Description', colX.desc + 5, currentY + 11, { width: 170, align: 'left' });
            doc.text('PART NUMBER', colX.partNum, currentY + 11, { width: 65, align: 'center' });
            doc.text('HSN/SAC', colX.hsn, currentY + 11, { width: 55, align: 'center' });
            doc.text('Qty', colX.qty, currentY + 11, { width: 35, align: 'center' });
            doc.text('Rate', colX.rate, currentY + 11, { width: 55, align: 'right' });
            doc.text('IGST', colX.igst, currentY + 3, { width: 75, align: 'center' });
            doc.text('%', colX.igstRate, currentY + 17, { width: 25, align: 'center' });
            doc.text('Amt', colX.igstAmt, currentY + 17, { width: 50, align: 'right' });
            doc.text('Amount', colX.amount, currentY + 11, { width: 70, align: 'right' });
            currentY += 30;
            // Loop through items
            items.forEach((item, idx) => {
                let titleLine = item.name;
                const descLines = [];
                if (item.category === 'LABOUR') {
                    titleLine = 'SOURCE';
                    descLines.push('Fiber Laser Repair Service');
                    descLines.push(`MAKE: ${job.laserSource.brand.toUpperCase()}`);
                    descLines.push(`ML.NO: ${job.laserSource.modelNumber}`);
                    descLines.push(`SL.NO: ${job.laserSource.serialNumber}`);
                    descLines.push(job.complaintCategory ? `${job.complaintCategory} Resolution` : 'Laser Repair Service');
                }
                else if (item.name.toUpperCase().includes('SOURCE')) {
                    titleLine = 'SOURCE';
                    descLines.push('Fiber Laser Cutting Source');
                    descLines.push(`MAKE: ${job.laserSource.brand.toUpperCase()}`);
                    descLines.push(`ML.NO: ${job.laserSource.modelNumber}`);
                    descLines.push(`SL.NO: ${job.laserSource.serialNumber}`);
                    descLines.push(job.complaintCategory ? `${job.complaintCategory} Resolution` : 'Laser Repair Service');
                }
                else {
                    const split = item.name.split('\n');
                    titleLine = split[0];
                    descLines.push(...split.slice(1));
                    if (item.manufacturer) {
                        descLines.push(`MAKE: ${item.manufacturer.toUpperCase()}`);
                    }
                }
                // HSN/SAC
                let hsnSac = item.hsnSac || '';
                if (!hsnSac) {
                    if (item.category === 'LABOUR') {
                        hsnSac = '998719';
                    }
                    else if (item.name.toLowerCase().includes('qbh') || item.name.toLowerCase().includes('cap') || item.name.toLowerCase().includes('lens')) {
                        hsnSac = '90019090';
                    }
                    else {
                        hsnSac = '84669390';
                    }
                }
                // Part Number
                let partNumber = item.partNumber || '';
                if (!partNumber) {
                    if (item.name.toLowerCase().includes('qbh')) {
                        partNumber = 'LEIRYQBHCP';
                    }
                    else if (item.name.toLowerCase().includes('lens')) {
                        partNumber = 'LEILENSOPT';
                    }
                    else if (item.name.toLowerCase().includes('diode')) {
                        partNumber = 'LEIDIODEPM';
                    }
                    else if (item.category === 'LABOUR') {
                        partNumber = 'LEISERVICE';
                    }
                    else {
                        partNumber = 'LEISERVICE';
                    }
                }
                // Measure desc height
                doc.font('CustomFont-Bold').fontSize(8);
                let dHeight = doc.heightOfString(titleLine, { width: 170 });
                if (descLines.length > 0) {
                    doc.font('CustomFont').fontSize(7.5);
                    dHeight += doc.heightOfString(descLines.join('\n'), { width: 170, lineGap: 1.5 }) + 4;
                }
                const rowHeight = Math.max(dHeight + 16, 32);
                // Draw borders
                doc.rect(15, currentY, 565, rowHeight).strokeColor('#d1d5db').stroke();
                // Vertical lines
                doc.moveTo(colX.desc, currentY).lineTo(colX.desc, currentY + rowHeight).stroke();
                doc.moveTo(colX.partNum, currentY).lineTo(colX.partNum, currentY + rowHeight).stroke();
                doc.moveTo(colX.hsn, currentY).lineTo(colX.hsn, currentY + rowHeight).stroke();
                doc.moveTo(colX.qty, currentY).lineTo(colX.qty, currentY + rowHeight).stroke();
                doc.moveTo(colX.rate, currentY).lineTo(colX.rate, currentY + rowHeight).stroke();
                doc.moveTo(colX.igst, currentY).lineTo(colX.igst, currentY + rowHeight).stroke();
                doc.moveTo(colX.igstAmt, currentY).lineTo(colX.igstAmt, currentY + rowHeight).stroke();
                doc.moveTo(colX.amount, currentY).lineTo(colX.amount, currentY + rowHeight).stroke();
                // Text cells
                doc.fillColor('#0f172a').font('CustomFont').fontSize(8);
                doc.text((idx + 1).toString(), colX.index, currentY + 8, { width: 25, align: 'center' });
                doc.font('CustomFont-Bold');
                doc.text(titleLine, colX.desc + 5, currentY + 8, { width: 170, align: 'left' });
                if (descLines.length > 0) {
                    doc.font('CustomFont').fontSize(7.5).fillColor('#334155');
                    doc.text(descLines.join('\n'), colX.desc + 5, doc.y + 2, { width: 170, align: 'left', lineGap: 1.5 });
                }
                doc.fillColor('#0f172a').font('CustomFont').fontSize(8);
                doc.text(partNumber, colX.partNum, currentY + 8, { width: 65, align: 'center' });
                doc.text(hsnSac, colX.hsn, currentY + 8, { width: 55, align: 'center' });
                doc.text(`${item.quantity}\nNos`, colX.qty, currentY + 8, { width: 35, align: 'center', lineGap: 2 });
                doc.text(item.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.rate, currentY + 8, { width: 55, align: 'right' });
                doc.text('18%', colX.igstRate, currentY + 8, { width: 25, align: 'center' });
                const igstAmount = item.totalCost * 0.18;
                doc.text(igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.igstAmt, currentY + 8, { width: 50, align: 'right' });
                doc.text(item.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.amount, currentY + 8, { width: 70, align: 'right' });
                currentY += rowHeight;
            });
            // 5. Totals & Footer Block
            const summaryY = currentY + 10;
            doc.rect(320, summaryY, 260, 60).strokeColor('#d1d5db').stroke();
            doc.moveTo(320, summaryY + 20).lineTo(580, summaryY + 20).stroke();
            doc.moveTo(320, summaryY + 40).lineTo(580, summaryY + 40).stroke();
            doc.font('CustomFont').fontSize(8.5).fillColor('#334155');
            doc.text('Sub Total', 330, summaryY + 5);
            doc.text('IGST18 (18%)', 330, summaryY + 25);
            doc.font('CustomFont-Bold').fillColor('#0f172a');
            doc.text('Total', 330, summaryY + 45);
            doc.font('CustomFont').fillColor('#0f172a');
            doc.text(quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 320, summaryY + 5, { width: 250, align: 'right' });
            doc.text((quotation.grandTotal * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 320, summaryY + 25, { width: 250, align: 'right' });
            doc.font('CustomFont-Bold');
            doc.text(`${currencySymbol}${(quotation.grandTotal * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 320, summaryY + 45, { width: 250, align: 'right' });
            // Left details
            doc.font('CustomFont').fontSize(8).fillColor('#334155');
            doc.text(`Items in Total ${items.length}`, 15, currentY + 10);
            doc.font('CustomFont-Bold').fontSize(8).fillColor('#0f172a').text('Total In Words', 15, currentY + 25);
            const grandTotalWithTax = quotation.grandTotal * 1.18;
            doc.font('CustomFont-Bold').text(numberToWords(grandTotalWithTax), 15, currentY + 36, { width: 290 });
            // Notes
            const notesY = currentY + 75;
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#0f172a').text('Notes', 15, notesY);
            doc.x = 15;
            doc.y = notesY + 12;
            doc.font('CustomFont').fontSize(7.5).fillColor('#334155').text([
                'LASER EXPERTS INDIA LLP',
                'Bank Name: KOTAK MAHINDRA BANK',
                'Account Number : 8825478128',
                'IFSC CODE: KKBK0008771',
                'Branch : Kamaraj Colony, Hosur 635109',
                'We hope our offer is in line with your requirement & awaiting to receive your order.',
                'Looking forward for your business..',
                'Shipping charges at actual.',
                'Boarding & Lodging at customer scope.'
            ].join('\n'), { width: 290, lineGap: 1.5 });
            // Terms & Conditions - determine termsY dynamically to prevent overlap
            const termsY = doc.y + 15;
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#0f172a').text('Terms & Conditions', 15, termsY);
            doc.x = 15;
            doc.y = termsY + 12;
            doc.font('CustomFont').fontSize(7.5).fillColor('#334155').text([
                'Any discrepancies must be notified within 24 hrs of receipt of the materials.',
                'Prices : Ex our works, Hosur, Freight to pay basis',
                'Delivery : within 4 to 6 week from the date of receipt of your Purchase Order along with advance',
                'Payment terms: 100% Advance payment.',
                'For the PO value less than INR 5,000 the payment should be made by DD /RTGS /DEBIT/CARD/CREDIT CARD ONLY. First time customers and International orders must be prepaid.'
            ].join('\n'), { width: 290, lineGap: 1.5 });
            // Authorized Signatory
            doc.rect(320, summaryY + 70, 260, 60).strokeColor('#d1d5db').stroke();
            doc.font('CustomFont').fontSize(8).fillColor('#334155').text('Authorized Signatory', 320, summaryY + 118, { width: 260, align: 'center' });
            // Page Number
            doc.fontSize(7.5).font('CustomFont').text('1', 570, 815);
            doc.end();
            stream.on('finish', () => resolve(`/uploads/${filename}`));
            stream.on('error', (err) => reject(err));
        });
    }
    static async generateLowStockPdf(lowParts) {
        const filename = `low_stock_reorder_${Date.now()}.pdf`;
        const filepath = path_1.default.join(UPLOADS_DIR, filename);
        const doc = new pdfkit_1.default({ size: 'A4', margin: 30 });
        return new Promise((resolve, reject) => {
            const stream = fs_1.default.createWriteStream(filepath);
            doc.pipe(stream);
            // Register Arial Unicode/Standard if Windows, else fall back to Helvetica
            try {
                const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
                const fontBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
                if (fs_1.default.existsSync(fontPath) && fs_1.default.existsSync(fontBoldPath)) {
                    doc.registerFont('CustomFont', fontPath);
                    doc.registerFont('CustomFont-Bold', fontBoldPath);
                }
                else {
                    doc.registerFont('CustomFont', 'Helvetica');
                    doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
                }
            }
            catch (e) {
                doc.registerFont('CustomFont', 'Helvetica');
                doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
            }
            doc.font('CustomFont');
            // Title & Header
            doc.fillColor('#0f172a').fontSize(20).font('CustomFont-Bold').text('SPARE PARTS REORDER REQUIREMENT', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).font('CustomFont').fillColor('#64748b').text(`Generated Date: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString()}`, { align: 'center' });
            doc.moveDown(1.5);
            // Info text
            doc.fontSize(10).fillColor('#334155').font('CustomFont').text('This document is generated automatically by the FSRMS Portal to summarize inventory items that have fallen below the configured minimum healthy stock levels.', { align: 'left' });
            doc.moveDown(1.5);
            // Table Header
            let y = doc.y;
            doc.rect(30, y, 535, 20).fill('#0f172a');
            doc.fillColor('#ffffff').font('CustomFont-Bold').fontSize(9);
            doc.text('Part Number', 35, y + 5);
            doc.text('Description / Part Specification', 120, y + 5);
            doc.text('Manufacturer', 320, y + 5);
            doc.text('Current', 420, y + 5);
            doc.text('Min Limit', 475, y + 5);
            doc.text('Est. Cost', 525, y + 5);
            doc.moveDown(1.5);
            // Table Rows
            let rowColorIndex = 0;
            doc.fillColor('#334155').font('CustomFont').fontSize(8.5);
            lowParts.forEach(part => {
                y = doc.y;
                if (y > 750) {
                    doc.addPage();
                    y = doc.y;
                    // Re-draw table header on new page
                    doc.rect(30, y, 535, 20).fill('#0f172a');
                    doc.fillColor('#ffffff').font('CustomFont-Bold').fontSize(9);
                    doc.text('Part Number', 35, y + 5);
                    doc.text('Description / Part Specification', 120, y + 5);
                    doc.text('Manufacturer', 320, y + 5);
                    doc.text('Current', 420, y + 5);
                    doc.text('Min Limit', 475, y + 5);
                    doc.text('Est. Cost', 525, y + 5);
                    y += 20;
                    doc.fillColor('#334155').font('CustomFont').fontSize(8.5);
                }
                // Draw zebra rows
                if (rowColorIndex % 2 === 1) {
                    doc.rect(30, y, 535, 22).fill('#f8fafc');
                    doc.fillColor('#334155');
                }
                doc.text(part.partNumber || 'N/A', 35, y + 6);
                doc.text(part.partName, 120, y + 6, { width: 190, height: 18 });
                doc.text(part.manufacturer || 'N/A', 320, y + 6);
                doc.fillColor('#dc2626').font('CustomFont-Bold').text(String(part.quantity), 420, y + 6);
                doc.fillColor('#334155').font('CustomFont').text(String(part.stockLevel), 475, y + 6);
                doc.text(`Rs. ${part.cost?.toFixed(0) || '0'}`, 525, y + 6);
                doc.y = y + 22;
                rowColorIndex++;
            });
            // Footer disclaimer
            doc.moveDown(2);
            doc.fontSize(8).fillColor('#94a3b8').text('Confidential - LEI Laser Source Tracker System inventory ledger.', { align: 'center' });
            doc.end();
            stream.on('finish', () => {
                resolve(`/uploads/${filename}`);
            });
            stream.on('error', (err) => {
                reject(err);
            });
        });
    }
    static async generateServiceReportPdf(report, job, tests, parts) {
        const filename = `service_report_${report.id}.pdf`;
        const filepath = path_1.default.join(UPLOADS_DIR, filename);
        const doc = new pdfkit_1.default({ size: 'A4', margin: 15 });
        return new Promise((resolve, reject) => {
            const stream = fs_1.default.createWriteStream(filepath);
            doc.pipe(stream);
            // Register Arial Unicode/Standard if Windows, else fall back to Helvetica
            try {
                const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
                const fontBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
                if (fs_1.default.existsSync(fontPath) && fs_1.default.existsSync(fontBoldPath)) {
                    doc.registerFont('CustomFont', fontPath);
                    doc.registerFont('CustomFont-Bold', fontBoldPath);
                }
                else {
                    doc.registerFont('CustomFont', 'Helvetica');
                    doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
                }
            }
            catch (e) {
                doc.registerFont('CustomFont', 'Helvetica');
                doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
            }
            // 1. Header Box
            doc.rect(15, 15, 565, 100).strokeColor('#d1d5db').lineWidth(0.8).stroke();
            // Logo
            const logoPath = path_1.default.join(__dirname, '..', '..', 'public', 'logo.png');
            if (fs_1.default.existsSync(logoPath)) {
                doc.image(logoPath, 25, 22, { width: 80, height: 80 });
            }
            // Company Info
            doc.font('CustomFont-Bold').fontSize(11).fillColor('#0f172a');
            doc.text('LASER EXPERTS INDIA LLP', 115, 22);
            doc.font('CustomFont').fontSize(7.5).fillColor('#334155');
            doc.text([
                '27/3 ANUMEPALLI',
                'BEGAPALLI ROAD , ZUZUVADI',
                'HOSUR 635126',
                'TAMIL NADU 33',
                'PAN NO AAGFL9943F',
                'GSTIN 33AAGFL9943F1Z6',
                'UDYAM-TN-11-0000905'
            ].join('\n'), 115, 36, { lineGap: 1.5 });
            // Title on Right
            doc.font('CustomFont-Bold').fontSize(22).fillColor('#0f172a');
            doc.text('SERVICE REPORT', 330, 75, { width: 240, align: 'right' });
            // 2. Document Details
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#1e3a8a').text(`Report ID: REP-${report.id.substring(0, 8).toUpperCase()}`, 15, 125);
            doc.font('CustomFont').fontSize(8.5).fillColor('#334155');
            doc.text(`Date of Issue: ${new Date(report.createdAt).toLocaleDateString('en-GB')}`, 15, 138);
            doc.text(`Track ID: ${job.trackId}`, 15, 151);
            // 3. Customer & Equipment Information Box
            const customer = job.customer;
            const laser = job.laserSource;
            doc.rect(15, 170, 565, 100).strokeColor('#d1d5db').stroke();
            doc.moveTo(297, 170).lineTo(297, 270).stroke();
            // Left Column: Customer Information
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#0f172a').text('CUSTOMER INFORMATION', 20, 175);
            doc.font('CustomFont').fontSize(8.5).fillColor('#334155');
            doc.text(`Company: ${customer.companyName}`, 20, 192);
            doc.text(`Contact: ${customer.customerName}`, 20, 206);
            doc.text(`Mobile: ${customer.mobileNumber}`, 20, 220);
            // Right Column: Equipment Specifications
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#0f172a').text('EQUIPMENT SPECIFICATIONS', 302, 175);
            doc.font('CustomFont').fontSize(8.5).fillColor('#334155');
            doc.text(`Brand / Maker: ${laser.brand}`, 302, 192);
            doc.text(`Model: ${laser.modelNumber}`, 302, 206);
            doc.text(`Serial No: ${laser.serialNumber}`, 302, 220);
            doc.text(`Power Rating: ${laser.powerRating}`, 302, 234);
            // 4. Diagnostics & Findings Box
            let nextY = 280;
            doc.rect(15, nextY, 565, 75).strokeColor('#d1d5db').stroke();
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#0f172a').text('DIAGNOSTICS & FINDINGS', 20, nextY + 5);
            doc.font('CustomFont').fontSize(8.5).fillColor('#334155');
            doc.text(`Customer Complaint: ${job.complaintDescription}`, 20, nextY + 22, { width: 550 });
            doc.text(`Fault Found: ${report.faultFound}`, 20, nextY + 38, { width: 550 });
            doc.text(`Root Cause Analysis: ${report.rootCauseAnalysis}`, 20, nextY + 54, { width: 550 });
            // 5. Repair Actions Performed Box
            nextY = 365;
            doc.rect(15, nextY, 565, 55).strokeColor('#d1d5db').stroke();
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#0f172a').text('REPAIR ACTIONS PERFORMED', 20, nextY + 5);
            doc.font('CustomFont').fontSize(8.5).fillColor('#334155').text(report.repairActions, 20, nextY + 20, { width: 550 });
            // 6. Spare Parts Replaced & Validation Tests side-by-side
            doc.rect(15, 430, 565, 120).strokeColor('#d1d5db').stroke();
            doc.moveTo(297, 430).lineTo(297, 550).stroke();
            // Left Column: Spare Parts Replaced
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#0f172a').text('SPARE PARTS REPLACED', 20, 435);
            let partY = 452;
            if (parts.length > 0) {
                doc.font('CustomFont').fontSize(8).fillColor('#334155');
                parts.slice(0, 5).forEach((p) => {
                    doc.text(`- ${p.sparePart.partName} (Qty: ${p.quantity})`, 20, partY);
                    partY += 13;
                });
            }
            else {
                doc.font('CustomFont').fontSize(8).fillColor('#64748b').text('No parts replaced. Service/Adjustments only.', 20, 452);
            }
            // Right Column: Validation Tests
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#0f172a').text('MANDATORY VALIDATION TESTS', 302, 435);
            doc.font('CustomFont').fontSize(7.5).fillColor('#334155');
            doc.text(`1. Output Power Test: ${tests.outputPowerTest || 'N/A'}`, 302, 452);
            doc.text(`2. Stability Test: ${tests.stabilityTest || 'N/A'}`, 302, 465);
            doc.text(`3. Burn-In Test: ${tests.burnInTest || 'N/A'}`, 302, 478);
            doc.text(`4. Alarm Verification: ${tests.alarmVerification || 'N/A'}`, 302, 491);
            doc.text(`5. Temperature Test: ${tests.temperatureTest || 'N/A'}`, 302, 504);
            doc.text(`6. Communication Test: ${tests.communicationTest || 'N/A'}`, 302, 517);
            // 7. Outcome Banner
            nextY = 560;
            doc.rect(15, nextY, 565, 30).fill('#f0fdf4');
            doc.rect(15, nextY, 565, 30).strokeColor('#bbf7d0').stroke();
            doc.font('CustomFont-Bold').fontSize(10.5).fillColor('#16a34a').text(`FINAL TESTING OUTCOME: ${tests.result || 'PASS'}`, 15, nextY + 9, { align: 'center' });
            // 8. Signatures Box
            const sigY = 600;
            doc.rect(15, sigY, 565, 95).strokeColor('#d1d5db').stroke();
            doc.moveTo(297, sigY).lineTo(297, sigY + 95).stroke();
            doc.fillColor('#0f172a').font('CustomFont-Bold').fontSize(8.5);
            doc.text(`Engineer In-Charge: ${report.engineer.name}`, 20, sigY + 10);
            doc.text('Authorized Quality Control Signoff', 302, sigY + 10);
            // Draw signature if exists
            if (report.signatureData && report.signatureData.startsWith('data:image')) {
                try {
                    const base64Data = report.signatureData.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');
                    doc.image(buffer, 302, sigY + 28, { width: 120, height: 40 });
                }
                catch (e) {
                    console.error('Failed to draw signature image on PDF', e);
                }
            }
            // Page Number
            doc.fontSize(7.5).font('CustomFont').text('1', 570, 815);
            doc.end();
            stream.on('finish', () => resolve(`/uploads/${filename}`));
            stream.on('error', (err) => reject(err));
        });
    }
    static async generateQcAssessmentPdf(assessment, job) {
        const filename = `qc_assessment_${job.id}.pdf`;
        const filepath = path_1.default.join(UPLOADS_DIR, filename);
        const doc = new pdfkit_1.default({ size: 'A4', margin: 15 });
        return new Promise((resolve, reject) => {
            const stream = fs_1.default.createWriteStream(filepath);
            doc.pipe(stream);
            // Register Font
            try {
                const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
                const fontBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
                if (fs_1.default.existsSync(fontPath) && fs_1.default.existsSync(fontBoldPath)) {
                    doc.registerFont('CustomFont', fontPath);
                    doc.registerFont('CustomFont-Bold', fontBoldPath);
                }
                else {
                    doc.registerFont('CustomFont', 'Helvetica');
                    doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
                }
            }
            catch (e) {
                doc.registerFont('CustomFont', 'Helvetica');
                doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
            }
            // Checkbox drawing helper
            const drawCheckbox = (x, y, checked, label) => {
                doc.rect(x, y, 8, 8).strokeColor('#000000').lineWidth(0.5).stroke();
                if (checked) {
                    doc.font('CustomFont-Bold').fontSize(7.5).fillColor('#000000').text('X', x + 1, y - 0.5);
                }
                doc.font('CustomFont').fontSize(7.5).fillColor('#000000').text(label, x + 12, y);
            };
            const data = assessment || {};
            // ==========================================
            // PAGE 1: TECHNICAL ASSESSMENT REPORT
            // ==========================================
            // Page 1 Border
            doc.rect(15, 15, 565, 810).strokeColor('#000000').lineWidth(1).stroke();
            // Logo & Title Header
            const logoPath = path_1.default.join(__dirname, '..', '..', 'public', 'logo.png');
            if (fs_1.default.existsSync(logoPath)) {
                doc.image(logoPath, 25, 20, { width: 45, height: 35 });
            }
            doc.font('CustomFont-Bold').fontSize(14).fillColor('#000000').text('LASER SOURCE TECHNICAL ASSESSMENT REPORT', 85, 30);
            doc.moveTo(15, 60).lineTo(580, 60).strokeColor('#000000').stroke();
            // BASIC DETAILS & CUSTOMER DETAILS HEADERS
            doc.rect(15, 60, 282, 15).fill('#e2e8f0');
            doc.rect(297, 60, 283, 15).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#000000').text('BASIC DETAILS', 120, 64);
            doc.text('CUSTOMER DETAILS', 400, 64);
            doc.moveTo(15, 75).lineTo(580, 75).stroke();
            doc.moveTo(297, 60).lineTo(297, 195).stroke(); // Mid vertical divider
            // Rows for Basic & Customer Details
            const detailRows = [
                { labelL: 'TAR NO:', valL: data.tarNo || '', labelR: 'COMPANY NAME:', valR: job.customer.companyName || '' },
                { labelL: 'START DATE:', valL: data.startDate || '', labelR: '', valR: '' },
                { labelL: 'END DATE:', valL: data.endDate || '', labelR: 'CONTACT PERSON:', valR: job.customer.customerName || '' },
                { labelL: 'DEPARTMENT:', valL: data.department || '', labelR: 'CONTACT NUMBER:', valR: job.customer.mobileNumber || '' }
            ];
            let currentY = 75;
            detailRows.forEach((row, idx) => {
                doc.font('CustomFont-Bold').fontSize(7.5).fillColor('#000000').text(row.labelL, 20, currentY + 4);
                doc.font('CustomFont').text(row.valL, 100, currentY + 4);
                doc.font('CustomFont-Bold').text(row.labelR, 305, currentY + 4);
                doc.font('CustomFont').text(row.valR, 400, currentY + 4);
                currentY += 15;
                doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            });
            // SOURCE DETAILS & REPORTED BY HEADERS
            doc.rect(15, 135, 282, 15).fill('#e2e8f0');
            doc.rect(297, 135, 283, 15).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#000000').text('SOURCE DETAILS', 120, 139);
            doc.text('REPORTED BY', 415, 139);
            doc.moveTo(15, 150).lineTo(580, 150).stroke();
            // Rows for Source Details & Reported By
            doc.font('CustomFont-Bold').fontSize(7.5);
            // Make / Name
            doc.text('MAKE:', 20, 154);
            doc.font('CustomFont').text(job.laserSource.brand || '', 100, 154);
            doc.font('CustomFont-Bold').text('NAME:', 305, 154);
            doc.font('CustomFont').text(data.reportedByName || '', 400, 154);
            doc.moveTo(15, 165).lineTo(580, 165).stroke();
            // ML.No / Employee ID
            doc.font('CustomFont-Bold').text('ML.NO:', 20, 169);
            doc.font('CustomFont').text(data.mlNo || '', 100, 169);
            doc.font('CustomFont-Bold').text('EMPLOYEE ID:', 305, 169);
            doc.font('CustomFont').text(data.employeeId || '', 400, 169);
            doc.moveTo(15, 180).lineTo(580, 180).stroke();
            // SL.No / Checkboxes
            doc.font('CustomFont-Bold').text('SL.NO:', 20, 184);
            doc.font('CustomFont').text(job.laserSource.serialNumber || '', 100, 184);
            drawCheckbox(305, 184, data.team === 'TEAM_A', 'TEAM A');
            drawCheckbox(430, 184, data.team === 'TEAM_B', 'TEAM B');
            doc.moveTo(15, 195).lineTo(580, 195).stroke();
            // MFG Date / Checkboxes
            doc.font('CustomFont-Bold').text('MFG DATE:', 20, 199);
            doc.font('CustomFont').text(String(job.laserSource.mfgYear) || '', 100, 199);
            drawCheckbox(305, 199, data.location === 'IN-HOUSE_REPAIR', 'IN-HOUSE REPAIR');
            drawCheckbox(430, 199, data.location === 'ONSITE', 'ONSITE');
            doc.moveTo(15, 210).lineTo(580, 210).stroke();
            // Module Details / UAE
            doc.font('CustomFont-Bold').text('MODULE DETAILS:', 20, 214);
            drawCheckbox(105, 214, data.moduleDetails === 'SINGLE-MODULE', 'SINGLE-MODULE');
            drawCheckbox(180, 214, data.moduleDetails === 'MULTI-MODULE', 'MULTI-MODULE');
            drawCheckbox(305, 214, !!data.uae, 'UAE');
            doc.moveTo(15, 225).lineTo(580, 225).stroke();
            // CUSTOMER REPORTED PROBLEM
            doc.font('CustomFont-Bold').text('CUSTOMER REPORTED PROBLEM:', 20, 229);
            doc.font('CustomFont').fontSize(7.5).text(job.complaintDescription || '', 20, 240, { width: 540, height: 30 });
            doc.moveTo(15, 275).lineTo(580, 275).stroke();
            // TYPES OF PROBLEMS
            doc.rect(15, 275, 565, 15).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#000000').text('TYPES OF PROBLEMS', 250, 279);
            doc.moveTo(15, 290).lineTo(580, 290).stroke();
            drawCheckbox(20, 296, !!data.qbhCableSpot, 'QBH/LOE/QD+/Q+ CABLE SPOT');
            drawCheckbox(305, 296, !!data.lowPower, 'LOW POWER');
            drawCheckbox(20, 311, !!data.combinerProblem, 'COMBINER PROBLEM');
            drawCheckbox(305, 311, !!data.activeFiber, 'ACTIVE FIBER PROBLEM');
            drawCheckbox(20, 326, !!data.psuControlBoard, 'PSU/CONTROL BOARD ISSUE');
            drawCheckbox(305, 326, !!data.othersProblem, 'OTHERS');
            doc.moveTo(15, 340).lineTo(580, 340).stroke();
            // PRE-REPAIR INSPECTION
            doc.rect(15, 340, 565, 15).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#000000').text('PRE-REPAIR INSPECTION', 245, 344);
            doc.moveTo(15, 355).lineTo(580, 355).stroke();
            doc.font('CustomFont-Bold').fontSize(7.5).text('EQUIPMENT/SOURCE CONDITION:', 20, 360);
            drawCheckbox(160, 360, data.condition === 'GOOD', 'GOOD');
            drawCheckbox(220, 360, data.condition === 'FAIR', 'FAIR');
            drawCheckbox(280, 360, data.condition === 'POOR', 'POOR');
            doc.font('CustomFont-Bold').text('PREVIOUS REPAIR DETAILS:', 350, 360);
            drawCheckbox(470, 360, data.previousRepair === 'AVAILABLE', 'AVAILABLE');
            drawCheckbox(530, 360, data.previousRepair === 'NA', 'NA');
            doc.moveTo(15, 375).lineTo(580, 375).stroke();
            drawCheckbox(20, 380, data.warranty === 'UNDER_WARRANTY', 'UNDER WARRANTY');
            drawCheckbox(150, 380, data.warranty === 'NO_WARRANTY', 'NO WARRANTY');
            doc.moveTo(15, 395).lineTo(580, 395).stroke();
            drawCheckbox(20, 400, data.customerType === 'CUSTOMER', 'CUSTOMER');
            drawCheckbox(120, 400, data.customerType === 'DEALER', 'DEALER');
            drawCheckbox(220, 400, data.customerType === 'STANDBY', 'STANDBY');
            drawCheckbox(320, 400, data.customerType === 'FREELANCER', 'FREELANCER');
            doc.moveTo(15, 415).lineTo(580, 415).stroke();
            // INITIAL OBSERVATION BY REPAIR ENGINEERS
            doc.rect(15, 415, 565, 15).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#000000').text('INITIAL OBSERVATION BY REPAIR ENGINEERS', 200, 419);
            doc.moveTo(15, 430).lineTo(580, 430).stroke();
            const initialObs = [
                { label: 'SOURCE PACKAGE CONDITION', opt1: 'OK', val1: data.sourcePackage === 'OK', opt2: 'NOT OK', val2: data.sourcePackage === 'NOT_OK' },
                { label: 'QBH CONDITION', opt1: 'OK', val1: data.qbhCondition === 'OK', opt2: 'NOT OK', val2: data.qbhCondition === 'NOT_OK' },
                { label: 'EXTERNAL DAMAGE', opt1: 'YES', val1: data.externalDamage === 'YES', opt2: 'NO', val2: data.externalDamage === 'NO' },
                { label: 'INTERNAL DAMAGE', opt1: 'YES', val1: data.internalDamage === 'YES', opt2: 'NO', val2: data.internalDamage === 'NO' },
                { label: 'POWER CABLE', opt1: 'YES', val1: data.powerCable === 'YES', opt2: 'NO', val2: data.powerCable === 'NO' },
                { label: 'INTERFACE CABLE', opt1: 'YES', val1: data.interfaceCable === 'YES', opt2: 'NO', val2: data.interfaceCable === 'NO' },
                { label: 'SOURCE KEY', opt1: 'YES', val1: data.sourceKey === 'YES', opt2: 'NO', val2: data.sourceKey === 'NO' }
            ];
            currentY = 430;
            initialObs.forEach(row => {
                doc.font('CustomFont-Bold').fontSize(7.5).text(row.label, 20, currentY + 4);
                drawCheckbox(250, currentY + 4, row.val1, row.opt1);
                drawCheckbox(380, currentY + 4, row.val2, row.opt2);
                currentY += 14;
                doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            });
            doc.font('CustomFont-Bold').fontSize(7.5).text('OTHERS:', 20, currentY + 4);
            doc.font('CustomFont').text(data.othersObservation || '', 80, currentY + 4);
            currentY += 15;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // FUNCTIONAL TEST POINT
            doc.rect(15, currentY, 565, 15).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8.5).fillColor('#000000').text('FUNCTIONAL TEST POINT', 240, currentY + 4);
            currentY += 15;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            doc.font('CustomFont-Bold').fontSize(7.5).text('EMERGENCY SWITCH', 20, currentY + 4);
            drawCheckbox(130, currentY + 4, data.emergencySwitch === 'OK', 'OK');
            drawCheckbox(170, currentY + 4, data.emergencySwitch === 'NOT_OK', 'NOT OK');
            doc.font('CustomFont-Bold').text('LASER BUTTON ON KEY', 305, currentY + 4);
            drawCheckbox(430, currentY + 4, data.laserButtonOnKey === 'OK', 'OK');
            drawCheckbox(470, currentY + 4, data.laserButtonOnKey === 'NOT_OK', 'NOT OK');
            currentY += 14;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            doc.font('CustomFont-Bold').text('SOURCE START KEY', 20, currentY + 4);
            drawCheckbox(130, currentY + 4, data.sourceStartKey === 'OK', 'OK');
            drawCheckbox(170, currentY + 4, data.sourceStartKey === 'NOT_OK', 'NOT OK');
            doc.font('CustomFont-Bold').text('MAIN MCB', 305, currentY + 4);
            drawCheckbox(430, currentY + 4, data.mainMcb === 'OK', 'OK');
            drawCheckbox(470, currentY + 4, data.mainMcb === 'NOT_OK', 'NOT OK');
            currentY += 14;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            doc.font('CustomFont-Bold').text('PROBLEM IN', 20, currentY + 4);
            drawCheckbox(130, currentY + 4, data.problemIn === 'OPTICAL_SECTION', 'OPTICAL SECTION');
            drawCheckbox(230, currentY + 4, data.problemIn === 'ELECTRICAL_SECTION', 'ELECTRICAL SECTION');
            currentY += 14;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            const footerTextBoxes = [
                { label: 'INITIAL OBSERVATION REPORTED BY:', val: data.observationReportedBy || '' },
                { label: 'IMMEDIATE ACTION TAKEN:', val: data.immediateActionTaken || '' },
                { label: 'REQUIRED SPARE PARTS/ TOOLS:', val: data.requiredSpareParts || '' },
                { label: 'ESTIMATED DOWN TIME:', val: data.estimatedDownTime || '' }
            ];
            footerTextBoxes.forEach((box, idx) => {
                doc.font('CustomFont-Bold').fontSize(7.5).text(box.label, 20, currentY + 4);
                doc.font('CustomFont').text(box.val, 20, currentY + 14, { width: 540, height: 20 });
                currentY += 38;
                if (idx !== footerTextBoxes.length - 1) {
                    doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
                }
            });
            // ==========================================
            // PAGE 2: FINAL TEST REPORT
            // ==========================================
            doc.addPage();
            // Page 2 Border
            doc.rect(15, 15, 565, 810).strokeColor('#000000').lineWidth(1).stroke();
            // Page 2 Header
            doc.rect(15, 15, 565, 20).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(9.5).fillColor('#000000').text('FINAL TEST REPORT', 245, 21);
            doc.moveTo(15, 35).lineTo(580, 35).stroke();
            // Redlight visibility
            doc.font('CustomFont-Bold').fontSize(8.5).text('REDLIGHT VISIBILITY', 20, 44);
            drawCheckbox(250, 44, data.redlightVisibility === 'GOOD', 'GOOD');
            drawCheckbox(350, 44, data.redlightVisibility === 'FAIR', 'FAIR');
            drawCheckbox(450, 44, data.redlightVisibility === 'POOR', 'POOR');
            doc.moveTo(15, 58).lineTo(580, 58).stroke();
            // Grid table header for Power & Amps
            doc.moveTo(160, 58).lineTo(160, 128).stroke();
            doc.moveTo(244, 58).lineTo(244, 128).stroke();
            doc.moveTo(328, 58).lineTo(328, 128).stroke();
            doc.moveTo(412, 58).lineTo(412, 128).stroke();
            doc.moveTo(496, 58).lineTo(496, 128).stroke();
            doc.font('CustomFont-Bold').fontSize(7.5);
            doc.text('0%', 190, 62);
            doc.text('25%', 274, 62);
            doc.text('50%', 358, 62);
            doc.text('75%', 442, 62);
            doc.text('100%', 526, 62);
            doc.moveTo(15, 74).lineTo(580, 74).stroke();
            // Output Power
            doc.text('LASER OUTPUT POWER', 20, 79);
            doc.font('CustomFont').text(data.laserOutput0 || '', 170, 79);
            doc.text(data.laserOutput25 || '', 254, 79);
            doc.text(data.laserOutput50 || '', 338, 79);
            doc.text(data.laserOutput75 || '', 422, 79);
            doc.text(data.laserOutput100 || '', 506, 79);
            doc.moveTo(15, 92).lineTo(580, 92).stroke();
            // Power Meter Reading
            doc.font('CustomFont-Bold').text('POWER METER READING', 20, 97);
            doc.font('CustomFont').text(data.powerMeter0 || '', 170, 97);
            doc.text(data.powerMeter25 || '', 254, 97);
            doc.text(data.powerMeter50 || '', 338, 97);
            doc.text(data.powerMeter75 || '', 422, 97);
            doc.text(data.powerMeter100 || '', 506, 97);
            doc.moveTo(15, 110).lineTo(580, 110).stroke();
            // Pump Amps Detail
            doc.font('CustomFont-Bold').text('PUMP AMPS DETAIL', 20, 115);
            doc.font('CustomFont').text(data.pumpAmps0 || '', 170, 115);
            doc.text(data.pumpAmps25 || '', 254, 115);
            doc.text(data.pumpAmps50 || '', 338, 115);
            doc.text(data.pumpAmps75 || '', 422, 115);
            doc.text(data.pumpAmps100 || '', 506, 115);
            doc.moveTo(15, 128).lineTo(580, 128).stroke();
            // Checklist Table Header
            doc.rect(15, 128, 565, 15).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fillColor('#000000').text('CHECKLIST', 60, 132);
            doc.text('OBSERVED VALUE', 205, 132);
            doc.text('MAX VALUE', 315, 132);
            doc.text('STATUS', 450, 132);
            doc.moveTo(15, 143).lineTo(580, 143).stroke();
            // Checklist columns
            doc.moveTo(195, 143).lineTo(195, 278).stroke();
            doc.moveTo(295, 143).lineTo(295, 278).stroke();
            doc.moveTo(375, 143).lineTo(375, 278).stroke();
            const checklistItems = [
                { label: 'OPTICAL SECTION TEMP', val: data.optSecTemp || '', max: '32°C', st: data.optSecTempSt },
                { label: 'ELECTRICAL SECTION TEMP', val: data.elecSecTemp || '', max: '32°C', st: data.elecSecTempSt },
                { label: 'LASER PUMP TEMP', val: data.laserPumpTemp || '', max: '40°C', st: data.laserPumpTempSt },
                { label: 'HUMIDITY (OPTICAL SEC)', val: data.humidityOpt || '', max: '50%', st: data.humidityOptSt },
                { label: 'HUMIDITY (ELECTRICAL SEC)', val: data.humidityElec || '', max: '50%', st: data.humidityElecSt },
                { label: 'WATER FLOW IN QBH', val: data.waterFlowQbh || '', max: '1.4Lpm', st: data.waterFlowQbhSt },
                { label: 'WATER FLOW IN SOURCE', val: data.waterFlowSource || '', max: '4.2Lpm', st: data.waterFlowSourceSt },
                { label: 'TEMP IN SPLICING POINT', val: data.tempSplicing || '', max: '320K', st: data.tempSplicingSt },
                { label: 'TEMP IN QBH CONNECTOR', val: data.tempQbh || '', max: '300K', st: data.tempQbhSt }
            ];
            currentY = 143;
            checklistItems.forEach(item => {
                doc.font('CustomFont-Bold').fontSize(7).text(item.label, 20, currentY + 4);
                doc.font('CustomFont').text(item.val, 200, currentY + 4);
                doc.font('CustomFont-Bold').text(item.max, 305, currentY + 4);
                drawCheckbox(385, currentY + 4, item.st === 'GOOD', 'GOOD');
                drawCheckbox(450, currentY + 4, item.st === 'FAIR', 'FAIR');
                drawCheckbox(515, currentY + 4, item.st === 'POOR', 'POOR');
                currentY += 15;
                doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            });
            // PROBLEM ANALYSIS
            doc.font('CustomFont-Bold').fontSize(7.5).text('PROBLEM ANALYSIS:', 20, currentY + 4);
            doc.font('CustomFont').text(data.problemAnalysis || '', 20, currentY + 14, { width: 540, height: 35 });
            currentY += 55;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // ROOT CAUSE ANALYSIS
            doc.font('CustomFont-Bold').text('ROOT CAUSE ANALYSIS:', 20, currentY + 4);
            doc.font('CustomFont').text(data.rootCauseAnalysis || '', 20, currentY + 14, { width: 540, height: 35 });
            currentY += 55;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // FAILURE TYPE
            doc.rect(15, currentY, 565, 12).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8).fillColor('#000000').text('FAILURE TYPE', 260, currentY + 2);
            currentY += 12;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            drawCheckbox(20, currentY + 4, !!data.failHuman, 'HUMAN ERROR');
            drawCheckbox(305, currentY + 4, !!data.failMechanical, 'MECHANICAL ERROR');
            currentY += 12;
            drawCheckbox(20, currentY + 4, !!data.failElectrical, 'ELECTRICAL ERROR');
            drawCheckbox(305, currentY + 4, !!data.failSoftware, 'SOFTWARE ISSUE');
            currentY += 12;
            drawCheckbox(20, currentY + 4, !!data.failEnvironmental, 'ENVIRONMENTAL ISSUE');
            drawCheckbox(305, currentY + 4, !!data.failSpareLifetime, 'SPARE LIFETIME EXPIRY');
            currentY += 12;
            drawCheckbox(20, currentY + 4, !!data.failExternal, 'EXTERNAL PROBLEM');
            currentY += 15;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // REPAIR AND TESTING
            doc.rect(15, currentY, 565, 12).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8).fillColor('#000000').text('REPAIR AND TESTING', 245, currentY + 2);
            currentY += 12;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            doc.font('CustomFont-Bold').text('REPAIR ACTION TAKEN', 20, currentY + 4);
            drawCheckbox(150, currentY + 4, data.repairActionTaken === 'YES', 'YES');
            drawCheckbox(200, currentY + 4, data.repairActionTaken === 'NO', 'NO');
            doc.font('CustomFont-Bold').text('PARTS REPLACED', 305, currentY + 4);
            drawCheckbox(420, currentY + 4, data.partsReplaced === 'YES', 'YES');
            drawCheckbox(470, currentY + 4, data.partsReplaced === 'NO', 'NO');
            currentY += 14;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            doc.font('CustomFont-Bold').text('POST REPAIR TESTING RESULT', 20, currentY + 4);
            drawCheckbox(150, currentY + 4, data.postRepairTesting === 'PASS', 'PASS');
            drawCheckbox(200, currentY + 4, data.postRepairTesting === 'FAIL', 'FAIL');
            doc.font('CustomFont-Bold').text('TRAIL RUNNING DURATION', 305, currentY + 4);
            doc.font('CustomFont').text(data.trailRunningDuration || '', 425, currentY + 4);
            currentY += 14;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // FINAL VERIFICATION
            doc.rect(15, currentY, 565, 12).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8).fillColor('#000000').text('FINAL VERIFICATION', 245, currentY + 2);
            currentY += 12;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            doc.font('CustomFont-Bold').text('EQUIPMENT RUNNING CONDITION', 20, currentY + 4);
            drawCheckbox(220, currentY + 4, data.runningCondition === 'OK', 'OK');
            drawCheckbox(320, currentY + 4, data.runningCondition === 'NOT_OK', 'NOT OK');
            currentY += 14;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // Signature Block Columns
            doc.moveTo(195, currentY).lineTo(195, currentY + 50).stroke();
            doc.moveTo(375, currentY).lineTo(375, currentY + 50).stroke();
            doc.font('CustomFont-Bold').text('VERIFIED BY:', 20, currentY + 4);
            doc.font('CustomFont').text(data.verifiedBy || '', 20, currentY + 30);
            doc.font('CustomFont-Bold').text('APPROVED BY:', 200, currentY + 4);
            doc.font('CustomFont').text(data.approvedBy || '', 200, currentY + 30);
            doc.font('CustomFont-Bold').text('CUSTOMER SIGN:', 380, currentY + 4);
            currentY += 50;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // REMARK
            doc.font('CustomFont-Bold').text('REMARK:', 20, currentY + 4);
            doc.font('CustomFont').text(data.remark || '', 20, currentY + 14, { width: 540, height: 25 });
            currentY += 45;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // PAYMENT DETAILS
            doc.rect(15, currentY, 565, 12).fill('#e2e8f0');
            doc.font('CustomFont-Bold').fontSize(8).fillColor('#000000').text('PAYMENT DETAILS', 250, currentY + 2);
            currentY += 12;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            drawCheckbox(20, currentY + 4, data.paymentType === 'INVOICE', 'INVOICE');
            drawCheckbox(120, currentY + 4, data.paymentType === 'NON-INVOICE', 'NON-INVOICE');
            doc.font('CustomFont-Bold').text('INVOICE NO:', 305, currentY + 4);
            doc.font('CustomFont').text(data.invoiceNo || '', 380, currentY + 4);
            currentY += 14;
            doc.moveTo(15, currentY).lineTo(580, currentY).stroke();
            // DISPATCH DETAILS
            doc.font('CustomFont-Bold').text('DISPATCH DETAILS:', 20, currentY + 4);
            drawCheckbox(130, currentY + 4, data.dispatchMethod === 'TRANSPORT/COURIER', 'TRANSPORT/COURIER');
            drawCheckbox(270, currentY + 4, data.dispatchMethod === 'CUSTOMER VEHICLE', 'CUSTOMER VEHICLE');
            drawCheckbox(410, currentY + 4, data.dispatchMethod === 'PORTER', 'PORTER');
            doc.end();
            stream.on('finish', () => resolve(`/uploads/${filename}`));
            stream.on('error', (err) => reject(err));
        });
    }
    static async generateCustomPoPdf(poData) {
        const filename = `purchase_order_${poData.poNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
        const filepath = path_1.default.join(UPLOADS_DIR, filename);
        const doc = new pdfkit_1.default({ size: 'A4', margin: 15 });
        return new Promise((resolve, reject) => {
            const stream = fs_1.default.createWriteStream(filepath);
            doc.pipe(stream);
            // Register Arial Unicode/Standard if Windows, else fall back to Helvetica
            try {
                const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
                const fontBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
                if (fs_1.default.existsSync(fontPath) && fs_1.default.existsSync(fontBoldPath)) {
                    doc.registerFont('CustomFont', fontPath);
                    doc.registerFont('CustomFont-Bold', fontBoldPath);
                }
                else {
                    doc.registerFont('CustomFont', 'Helvetica');
                    doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
                }
            }
            catch (e) {
                doc.registerFont('CustomFont', 'Helvetica');
                doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
            }
            doc.font('CustomFont');
            // 1. Draw outer border surrounding the page content
            doc.rect(15, 15, 565, 812).strokeColor('#000000').lineWidth(0.8).stroke();
            // 2. Header Logo and Title
            const logoPath = path_1.default.join(__dirname, '..', '..', 'public', 'logo.png');
            if (fs_1.default.existsSync(logoPath)) {
                doc.image(logoPath, 25, 22, { width: 55 });
            }
            else {
                // Draw elegant placeholder
                doc.circle(52, 50, 26).fill('#1e3a8a');
                doc.fillColor('#ffffff').fontSize(11).font('CustomFont-Bold').text('LEI', 42, 44);
            }
            // Company info
            doc.fillColor('#000000').fontSize(11).font('CustomFont-Bold').text('LASER EXPERTS INDIA LLP', 95, 22);
            doc.fontSize(6.5).font('CustomFont').fillColor('#334155');
            doc.text('27/3 ANUMEPALLI\nBEGAPALLI ROAD, ZUZUVADI\nHOSUR 635126\nTAMIL NADU 33\nPAN NO AAGFL9943F\nGSTIN 33AAGFL9943F1Z6\nUDYAM-TN-11-0000905', 95, 34, { lineGap: 1.0 });
            // Title on right
            doc.fillColor('#0f172a').fontSize(15).font('CustomFont-Bold').text('PURCHASE ORDER', 420, 65);
            // Header bottom border
            doc.moveTo(15, 95).lineTo(580, 95).strokeColor('#000000').lineWidth(0.8).stroke();
            // 3. Metadata Table Block
            // Purchase Order#, Date, Ref#
            doc.fontSize(8.5).font('CustomFont-Bold').fillColor('#000000').text('Purchase Order#', 20, 101);
            doc.font('CustomFont').text(`: ${poData.poNumber}`, 105, 101);
            doc.font('CustomFont-Bold').text('Date', 20, 112);
            doc.font('CustomFont').text(`: ${poData.poDate}`, 105, 112);
            doc.font('CustomFont-Bold').text('Ref#', 20, 123);
            doc.font('CustomFont').text(`: ${poData.refNo || 'N/A'}`, 105, 123);
            // Place of Supply
            doc.font('CustomFont-Bold').text('Place Of Supply', 305, 101);
            doc.font('CustomFont').text(`: ${poData.placeOfSupply}`, 380, 101);
            // Vert separator in meta block
            doc.moveTo(297, 95).lineTo(297, 135).stroke();
            doc.moveTo(15, 135).lineTo(580, 135).stroke();
            // 4. Vendor Details & Deliver To columns
            // Subheader background fill
            doc.rect(15.5, 135.5, 281, 14.5).fill('#f1f5f9');
            doc.rect(297.5, 135.5, 282, 14.5).fill('#f1f5f9');
            doc.fillColor('#000000').font('CustomFont-Bold').fontSize(8.5);
            doc.text('Vendor Address', 20, 139);
            doc.text('Deliver To', 305, 139);
            doc.moveTo(15, 150).lineTo(580, 150).stroke();
            // Column text contents
            // Left Column: Vendor
            doc.fontSize(8).font('CustomFont-Bold').fillColor('#000000').text(poData.vendorName, 20, 156, { width: 260 });
            doc.font('CustomFont').fillColor('#334155').text(poData.vendorAddress, 20, 168, { width: 260, lineGap: 1.8 });
            // Right Column: Deliver To
            doc.font('CustomFont-Bold').fillColor('#000000').text('HOSUR FACTORY', 305, 156);
            doc.font('CustomFont').fillColor('#334155').text('27/3 ANUMEPALLI\nBEGAPALLI ROAD, ZUZUVADI\nHOSUR 635126\nTAMIL NADU 33\nPAN NO AAGFL9943F\nGSTIN 33AAGFL9943F1Z6\nUDYAM-TN-11-0000905', 305, 168, { lineGap: 1.8 });
            doc.moveTo(297, 135).lineTo(297, 255).stroke();
            doc.moveTo(15, 255).lineTo(580, 255).stroke();
            // 5. Items Table
            doc.rect(15.5, 255.5, 564, 16.5).fill('#f1f5f9');
            doc.fillColor('#000000').font('CustomFont-Bold').fontSize(8.5);
            doc.text('#', 20, 260);
            doc.text('Item & Description', 45, 260);
            doc.text('Qty', 395, 260, { width: 40, align: 'right' });
            doc.text('Rate', 455, 260, { width: 50, align: 'right' });
            doc.text('Amount', 520, 260, { width: 55, align: 'right' });
            doc.moveTo(15, 272).lineTo(580, 272).stroke();
            let tableY = 278;
            let totalAmount = 0;
            doc.font('CustomFont').fontSize(8);
            poData.items.forEach((item, idx) => {
                const itemAmt = item.qty * item.rate;
                totalAmount += itemAmt;
                doc.fillColor('#000000').font('CustomFont-Bold').text(String(idx + 1), 20, tableY);
                doc.text(item.name, 45, tableY, { width: 330 });
                if (item.description) {
                    doc.font('CustomFont').fillColor('#475569').text(item.description, 45, doc.y + 2, { width: 330 });
                }
                const rowEnd = Math.max(doc.y + 5, tableY + 16);
                doc.fillColor('#000000').font('CustomFont').text(String(item.qty), 390, tableY, { width: 45, align: 'right' });
                doc.text(item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 440, tableY, { width: 65, align: 'right' });
                doc.text(itemAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 510, tableY, { width: 65, align: 'right' });
                tableY = rowEnd;
            });
            // Draw table outline vertical lines dynamically based on rows
            const tableBottomY = Math.max(380, tableY + 6);
            doc.moveTo(40, 255).lineTo(40, tableBottomY).stroke();
            doc.moveTo(380, 255).lineTo(380, tableBottomY).stroke();
            doc.moveTo(440, 255).lineTo(440, tableBottomY).stroke();
            doc.moveTo(510, 255).lineTo(510, tableBottomY).stroke();
            doc.moveTo(15, tableBottomY).lineTo(580, tableBottomY).stroke();
            // Sub Total & Grand Total lines immediately below table bottom
            doc.fontSize(8.5).font('CustomFont-Bold');
            doc.text('Sub Total', 430, tableBottomY + 5);
            doc.text(totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 510, tableBottomY + 5, { width: 65, align: 'right' });
            doc.moveTo(380, tableBottomY + 16).lineTo(580, tableBottomY + 16).stroke();
            doc.text('Total', 430, tableBottomY + 22);
            doc.text(`$${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 510, tableBottomY + 22, { width: 65, align: 'right' });
            doc.moveTo(380, tableBottomY + 33).lineTo(580, tableBottomY + 33).stroke();
            // 6. Bottom Terms, Watermark, and Signature Block
            // Notes
            let currentY = tableBottomY + 42;
            doc.fillColor('#000000').font('CustomFont-Bold').fontSize(8).text('Notes', 20, currentY);
            doc.font('CustomFont').fillColor('#334155').fontSize(7.5).text(poData.notes || 'Delivery of materials should be made within the said time bound, if not the supplier must take responsibility.\nMention GST no: 33AAGFL9943F1Z6 in Invoice.', 20, currentY + 10, { width: 295, lineGap: 1.5 });
            // Terms & Conditions
            currentY = doc.y + 10;
            doc.fillColor('#000000').font('CustomFont-Bold').fontSize(8).text('Terms & Conditions', 20, currentY);
            const termsText = [
                'GENERAL TERMS AND CONDITIONS',
                '1.  "PURCHASER/ COMPANY" in these conditions means LASER EXPERTS INDIA LLP. "SELLERS / SUPPLIERS" include all Persons, Firms, Companies, Agencies who agree to sell their products/services under this order.',
                '2.  Price mentioned in the order is arrived by mutual agreement by the parties and would hold on until the completion of order. The price inclusive of packaging and delivery charges up to the destination stated overleaf unless otherwise specifically agreed to. Taxes & duties are as applicable at the time of delivery. Suppliers to ensure taxes charged in the invoices are remitted to the appropriate government within due dates specified under relevant laws as applicable, otherwise your payments will be withheld to that extent. Further, any claims or demands raised by the Government for any of reasons like for classification of goods / services including wrong HSN/SAC under the GST or non-payment of tax or wrong rate of tax applied or interest or penalty because of any of the previous reasons would have to be borne by the supplier and LEI will not incur such costs. Any kind of interest / penalty arising as a result of non-uploading of invoices (return)/non-rectification of mis-match from your part, shall be borne strictly by supplier only.',
                '2A. Where Goods and Service Tax ("GST") or tax of similar nature is applicable on supplies under this PO the purchaser shall pay for the GST or tax of similar nature under each invoice provided that the supplier had complied the following: (a) the supplier is duly licensed with relevant authorities to collect GST or tax of similar nature.(b) GST or tax of similar nature is included in the invoice at the time of issuance of invoice and; (c) all invoices provided by the supplier to the purchaser complies with relevant laws relating to GST or tax of similar nature. The supplier is responsible for complying with all laws and regulations including filing of periodical statutory returns under GST/ tax of similar nature. The supplier agrees to keep the purchaser harmless against any claims or penalties that may be imposed on purchaser by the reason of the failure of the supplier to comply with obligations of GST or any other tax of similar nature.',
                '3. Quantity shown in the order is only indicative and actual delivery will be based on market condition. Hence, you are requested to plan your production / supply based on delivery schedules released to you periodically.',
                '4. Order must be acknowledged and order acceptance must be issued within a week from the date of its receipt, along with queries if any relating to its terms and conditions.'
            ].join('\n');
            doc.font('CustomFont').fillColor('#475569').fontSize(5.2).text(termsText, 20, currentY + 10, { width: 295, lineGap: 1.1 });
            // Signature Block
            const sigBlockY = tableBottomY + 45;
            // Signature Block
            doc.rect(335, sigBlockY, 230, 100).strokeColor('#94a3b8').lineWidth(0.5).stroke();
            doc.fontSize(8.5).font('CustomFont-Bold').fillColor('#0f172a').text('Authorized Signature', 335, sigBlockY + 86, { width: 230, align: 'center' });
            doc.end();
            stream.on('finish', () => resolve(`/uploads/${filename}`));
            stream.on('error', (err) => reject(err));
        });
    }
}
exports.PdfService = PdfService;
function numberToWords(num) {
    const a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function g(n) {
        if (n < 20)
            return a[n];
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    }
    function c(n) {
        if (n < 100)
            return g(n);
        const ten = n % 100;
        return a[Math.floor(n / 100)] + ' Hundred' + (ten ? ' and ' + g(ten) : '');
    }
    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);
    let str = '';
    let n = integerPart;
    if (n === 0) {
        str = 'Zero';
    }
    else {
        // Crores
        const cr = Math.floor(n / 10000000);
        n %= 10000000;
        if (cr)
            str += c(cr) + ' Crore ';
        // Lakhs
        const la = Math.floor(n / 100000);
        n %= 100000;
        if (la)
            str += c(la) + ' Lakh ';
        // Thousands
        const th = Math.floor(n / 1000);
        n %= 1000;
        if (th)
            str += c(th) + ' Thousand ';
        // Hundreds & tens
        if (n)
            str += c(n);
    }
    let result = 'Rupees ' + str.trim();
    if (decimalPart > 0) {
        result += ' and ' + g(decimalPart) + ' Paise';
    }
    result += ' Only';
    return result;
}
