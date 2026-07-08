import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import logoImg from '../assets/logo.png';

// ─── Company Constants ────────────────────────────────────────────────────────
const COMPANY_NAME = 'LASER EXPERTS INDIA LLP';
const COMPANY_ADDRESS = 'No. 27/3, Anumepalli, Begapalli Road, Zuzuvadi, Hosur, Tamil Nadu – 635 126';
const COMPANY_GST = 'GST: 33AAGFL9943F1Z6';
const COMPANY_PHONE = 'Ph: +91 93810 72240';
const COMPANY_EMAIL = 'Email: laserexpertsindia@gmail.com';

// ─── Color Palette ────────────────────────────────────────────────────────────
const PRIMARY = '0F172A';     // Slate-900
const ACCENT  = '1D4ED8';     // Blue-700
const HEADER_BG = 'EFF6FF';   // Blue-50
const ALT_ROW = 'F8FAFC';     // Slate-50
const BORDER_COLOR = 'CBD5E1';// Slate-300
const WHITE   = 'FFFFFF';

// ─── Helper ───────────────────────────────────────────────────────────────────
function border(color = BORDER_COLOR): Partial<ExcelJS.Border> {
  return { style: 'thin', color: { argb: `FF${color}` } };
}

function allBorders(color = BORDER_COLOR): Partial<ExcelJS.Borders> {
  const b = border(color);
  return { top: b, left: b, bottom: b, right: b };
}

/** Fetches the company logo as a base64 string */
async function fetchLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch(logoImg);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // strip "data:image/png;base64,"
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Draw the branded header rows (rows 1–8) and return the next data row index */
async function drawHeader(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  colCount: number,
  reportLabel: string,
  exportedAt: string
): Promise<number> {
  // ── Logo image ──────────────────────────────────────────────────────────────
  const logoB64 = await fetchLogoBase64();
  if (logoB64) {
    const imgId = wb.addImage({ base64: logoB64, extension: 'png' });
    ws.addImage(imgId, {
      tl: { col: 0, row: 0 },
      ext: { width: 110, height: 60 },
    });
  }

  // ── Row 1: Company name (starts col B so logo sits in A) ───────────────────
  ws.getRow(1).height = 28;
  const nameCell = ws.getCell(1, 2);
  nameCell.value = COMPANY_NAME;
  nameCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: `FF${PRIMARY}` } };
  nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(1, 2, 1, colCount);

  // ── Row 2: Address ─────────────────────────────────────────────────────────
  ws.getRow(2).height = 15;
  const addrCell = ws.getCell(2, 2);
  addrCell.value = COMPANY_ADDRESS;
  addrCell.font = { name: 'Calibri', size: 9, color: { argb: `FF64748B` } };
  addrCell.alignment = { vertical: 'middle' };
  ws.mergeCells(2, 2, 2, colCount);

  // ── Row 3: GST / Phone / Email ─────────────────────────────────────────────
  ws.getRow(3).height = 14;
  const contactCell = ws.getCell(3, 2);
  contactCell.value = `${COMPANY_GST}   |   ${COMPANY_PHONE}   |   ${COMPANY_EMAIL}`;
  contactCell.font = { name: 'Calibri', size: 8, color: { argb: `FF94A3B8` } };
  contactCell.alignment = { vertical: 'middle' };
  ws.mergeCells(3, 2, 3, colCount);

  // ── Row 4: Spacer ──────────────────────────────────────────────────────────
  ws.getRow(4).height = 6;

  // ── Row 5: Accent divider bar ──────────────────────────────────────────────
  ws.getRow(5).height = 5;
  for (let c = 1; c <= colCount; c++) {
    ws.getCell(5, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
  }

  // ── Row 6: Report title ────────────────────────────────────────────────────
  ws.getRow(6).height = 22;
  const titleCell = ws.getCell(6, 1);
  titleCell.value = reportLabel.toUpperCase();
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${ACCENT}` } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(6, 1, 6, Math.max(1, colCount - 1));

  // ── Row 6 last col: export date ────────────────────────────────────────────
  const dateCell = ws.getCell(6, colCount);
  dateCell.value = `Exported: ${exportedAt}`;
  dateCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: `FF94A3B8` } };
  dateCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // ── Row 7: Spacer ──────────────────────────────────────────────────────────
  ws.getRow(7).height = 6;

  return 8; // Column-header row starts here
}

/** Style a column-header row */
function styleColumnHeader(ws: ExcelJS.Worksheet, rowIdx: number, colCount: number) {
  const row = ws.getRow(rowIdx);
  row.height = 18;
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(rowIdx, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${WHITE}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = allBorders(PRIMARY);
  }
}

/** Style an alternating data row */
function styleDataRow(ws: ExcelJS.Worksheet, rowIdx: number, colCount: number, isAlt: boolean) {
  const row = ws.getRow(rowIdx);
  row.height = 16;
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(rowIdx, c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isAlt ? `FF${ALT_ROW}` : `FF${WHITE}` },
    };
    cell.font = { name: 'Calibri', size: 9 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = allBorders();
  }
}

/** Draw footer rows */
function drawFooter(ws: ExcelJS.Worksheet, nextRow: number, colCount: number) {
  // Thin accent line
  ws.getRow(nextRow).height = 4;
  for (let c = 1; c <= colCount; c++) {
    ws.getCell(nextRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
  }
  nextRow++;

  ws.getRow(nextRow).height = 14;
  const foot = ws.getCell(nextRow, 1);
  foot.value = `This report is system-generated by FSRMS – Fiber Laser Source Repair Management System. Confidential – ${COMPANY_NAME}.`;
  foot.font = { name: 'Calibri', size: 8, italic: true, color: { argb: `FF94A3B8` } };
  foot.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.mergeCells(nextRow, 1, nextRow, colCount);
}

// ─── Main export function ─────────────────────────────────────────────────────
export async function exportAdvancedExcel(
  reportType: string,
  reportLabel: string,
  reportData: any[]
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  wb.lastModifiedBy = COMPANY_NAME;
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet(reportLabel.substring(0, 31), {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddHeader: `&L&"Calibri,Bold"&10${COMPANY_NAME}&R&"Calibri,Regular"&8${reportLabel}`,
      oddFooter: `&L&"Calibri,Regular"&8Confidential – FSRMS&C&P of &N&R&"Calibri,Regular"&8${new Date().toLocaleDateString('en-IN')}`,
    },
    views: [{ showGridLines: false }],
  });

  const exportedAt = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

  // ── Build columns depending on report type ─────────────────────────────────
  let columns: { header: string; key: string; width: number; numFmt?: string }[] = [];
  let rows: any[][] = [];

  if (reportType === 'revenue') {
    columns = [
      { header: 'Invoice Number', key: 'inv', width: 20 },
      { header: 'Client Company',  key: 'co',  width: 35 },
      { header: 'Invoice Amount (₹)', key: 'amt', width: 20, numFmt: '#,##0.00' },
      { header: 'Amount Cleared (₹)', key: 'paid', width: 20, numFmt: '#,##0.00' },
      { header: 'Balance Due (₹)', key: 'due', width: 18, numFmt: '#,##0.00' },
      { header: 'Invoice Date', key: 'date', width: 18 },
    ];
    rows = reportData.map((r: any) => [
      r.invoiceNumber,
      r.job?.customer?.companyName || '',
      r.invoiceAmount,
      r.paidAmount,
      r.dueAmount,
      new Date(r.invoiceDate).toLocaleDateString('en-IN'),
    ]);
  } else if (reportType === 'brand') {
    columns = [
      { header: 'Laser Brand', key: 'brand', width: 30 },
      { header: 'Total Inward Repairs', key: 'total', width: 22 },
      { header: 'Completed & Closed', key: 'completed', width: 22 },
      { header: 'Active / On-Hold', key: 'pending', width: 20 },
    ];
    rows = reportData.map((r: any) => [r.brand, r.total, r.completed, r.pending]);
  } else if (reportType === 'engineer') {
    columns = [
      { header: 'Service Engineer', key: 'name', width: 30 },
      { header: 'Total Repairs Completed', key: 'count', width: 25 },
      { header: 'Avg Repair Time (Min)', key: 'avg', width: 24, numFmt: '#,##0.0' },
    ];
    rows = reportData.map((r: any) => [r.name, r.repairsCount, parseFloat(r.avgDuration.toFixed(1))]);
  } else if (reportType === 'failure') {
    columns = [
      { header: 'Failure / Fault Description', key: 'fault', width: 40 },
      { header: 'Incidents Logged', key: 'count', width: 20 },
    ];
    rows = reportData.map((r: any) => [r.fault, r.count]);
  } else {
    // daily / weekly / monthly
    columns = [
      { header: 'Track ID', key: 'tid', width: 20 },
      { header: 'Company Name', key: 'co', width: 35 },
      { header: 'Laser Brand', key: 'brand', width: 20 },
      { header: 'Power Rating', key: 'power', width: 16 },
      { header: 'Failure Category', key: 'fail', width: 28 },
      { header: 'Current Status', key: 'status', width: 22 },
    ];
    rows = reportData.map((r: any) => [
      r.trackId,
      r.customer?.companyName || '',
      r.laserSource?.brand || '',
      r.laserSource?.powerRating || '',
      r.complaintCategory || '',
      (r.status || '').replace(/_/g, ' '),
    ]);
  }

  const colCount = columns.length;

  // Set column widths
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // ── Header section ─────────────────────────────────────────────────────────
  const colHeaderRow = await drawHeader(ws, wb, colCount, reportLabel, exportedAt);

  // ── Column headers ─────────────────────────────────────────────────────────
  const headerRow = ws.getRow(colHeaderRow);
  columns.forEach((c, idx) => {
    headerRow.getCell(idx + 1).value = c.header;
  });
  styleColumnHeader(ws, colHeaderRow, colCount);

  // ── Data rows ──────────────────────────────────────────────────────────────
  rows.forEach((rowData, i) => {
    const rowIdx = colHeaderRow + 1 + i;
    const dataRow = ws.getRow(rowIdx);
    rowData.forEach((val, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = val;
      // Apply number format for numeric columns
      if (columns[ci].numFmt) {
        cell.numFmt = columns[ci].numFmt!;
      }
      // Highlight Track ID column blue
      if (columns[ci].key === 'tid') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${ACCENT}` } };
      }
      // Color status badges
      if (columns[ci].key === 'status') {
        const status = String(val).toUpperCase();
        let color = '64748B';
        if (status.includes('CLOSED')) color = '059669';
        else if (status.includes('REPAIR')) color = 'D97706';
        else if (status.includes('DISPATCH')) color = '7C3AED';
        else if (status.includes('RECEIVED')) color = '0284C7';
        cell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: `FF${color}` } };
      }
      // Color negative due amounts red
      if (columns[ci].key === 'due' && typeof val === 'number' && val > 0) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFE11D48' } };
      }
    });
    styleDataRow(ws, rowIdx, colCount, i % 2 !== 0);
  });

  // ── Summary row ────────────────────────────────────────────────────────────
  if (reportType === 'revenue' && rows.length > 0) {
    const sumRowIdx = colHeaderRow + 1 + rows.length;
    const sumRow = ws.getRow(sumRowIdx);
    sumRow.height = 18;
    sumRow.getCell(1).value = 'TOTAL';
    sumRow.getCell(1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${WHITE}` } };
    sumRow.getCell(3).value = reportData.reduce((s: number, r: any) => s + r.invoiceAmount, 0);
    sumRow.getCell(3).numFmt = '#,##0.00';
    sumRow.getCell(4).value = reportData.reduce((s: number, r: any) => s + r.paidAmount, 0);
    sumRow.getCell(4).numFmt = '#,##0.00';
    sumRow.getCell(5).value = reportData.reduce((s: number, r: any) => s + r.dueAmount, 0);
    sumRow.getCell(5).numFmt = '#,##0.00';
    for (let c = 1; c <= colCount; c++) {
      const cell = sumRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY}` } };
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${WHITE}` } };
      cell.border = allBorders(PRIMARY);
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
    }
    drawFooter(ws, sumRowIdx + 2, colCount);
  } else {
    drawFooter(ws, colHeaderRow + 1 + rows.length + 2, colCount);
  }

  // ── Freeze panes ───────────────────────────────────────────────────────────
  ws.views = [{ state: 'frozen', ySplit: colHeaderRow, showGridLines: false }];

  // ── Auto-filter on column headers ──────────────────────────────────────────
  ws.autoFilter = {
    from: { row: colHeaderRow, column: 1 },
    to:   { row: colHeaderRow, column: colCount },
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `LEILLP_${reportType.toUpperCase()}_REPORT_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}
