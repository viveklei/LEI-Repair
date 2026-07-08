import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoImg from '../assets/logo.png';

// --- Company Constants ---------------------------------------------------------
const CO_NAME    = 'LASER EXPERTS INDIA LLP';
const CO_ADDRESS = 'No. 18/5, Trustpuram 1st Cross, Kodambakkam, Chennai - 600 024';
const CO_GST     = 'GSTIN: 33AAGFL9943F1Z6';
const CO_PHONE   = '+91 93810 72240';
const CO_EMAIL   = 'laserexpertsindia@gmail.com';
const CO_WEB     = 'www.laserexpertsindia.com';

const C = {
  primary:  [15, 23, 42]   as [number,number,number],
  accent:   [29, 78, 216]  as [number,number,number],
  accentLt: [219,234,254]  as [number,number,number],
  emerald:  [5, 150, 105]  as [number,number,number],
  amber:    [217,119, 6]   as [number,number,number],
  rose:     [225, 29, 72]  as [number,number,number],
  cyan:     [6, 182, 212]  as [number,number,number],
  slate4:   [100,116,139]  as [number,number,number],
  slate2:   [203,213,225]  as [number,number,number],
  white:    [255,255,255]  as [number,number,number],
  bg:       [248,250,252]  as [number,number,number],
};

const PIE_COLORS = ['#1D4ED8','#06B6D4','#10B981','#F59E0B','#F43F5E','#8B5CF6','#0EA5E9'];

async function logoBase64(): Promise<string | null> {
  try {
    const res = await fetch(logoImg);
    const blob = await res.blob();
    return new Promise(resolve => {
      const rd = new FileReader();
      rd.onloadend = () => resolve(rd.result as string);
      rd.readAsDataURL(blob);
    });
  } catch { return null; }
}

function nowStr() {
  return new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
}

async function drawHeader(doc: jsPDF, title: string): Promise<number> {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, pw, 8, 'F');

  const logo = await logoBase64();
  let logoEndX = 14;
  if (logo) {
    try { doc.addImage(logo, 'PNG', 12, 12, 28, 16); logoEndX = 44; }
    catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.primary);
  doc.text(CO_NAME, logoEndX + 2, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.slate4);
  doc.text(`${CO_ADDRESS}   |   ${CO_GST}`, logoEndX + 2, 24);
  doc.text(`${CO_PHONE}   |   ${CO_EMAIL}   |   ${CO_WEB}`, logoEndX + 2, 29);

  doc.setFontSize(7);
  doc.setTextColor(...C.slate4);
  doc.text(`Generated: ${nowStr()}`, pw - 14, 18, { align: 'right' });

  doc.setDrawColor(...C.slate2);
  doc.setLineWidth(0.3);
  doc.line(12, 34, pw - 12, 34);

  doc.setFillColor(...C.primary);
  doc.roundedRect(12, 38, pw - 24, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text(title.toUpperCase(), pw / 2, 46, { align: 'center' });

  return 58;
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.accent);
    doc.rect(0, ph - 8, pw, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(`${CO_NAME} - Confidential Report. Do not distribute.`, 14, ph - 3);
    doc.text(`Page ${i} of ${totalPages}`, pw - 14, ph - 3, { align: 'right' });
  }
}

function drawKpiRow(doc: jsPDF, y: number, cards: { label: string; value: string; color: [number,number,number] }[]): number {
  const pw  = doc.internal.pageSize.getWidth();
  const gap = 4;
  const w   = (pw - 24 - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, i) => {
    const x = 12 + i * (w + gap);
    doc.setFillColor(...card.color);
    doc.roundedRect(x, y, w, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.white);
    doc.text(card.value, x + w / 2, y + 10.5, { align: 'center' });
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label.toUpperCase(), x + w / 2, y + 15.5, { align: 'center' });
  });
  return y + 23;
}

function drawBarChart(labels: string[], values: number[], color: string, title: string): string {
  const canvas = document.createElement('canvas');
  canvas.width  = 520;
  canvas.height = 240;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = { top: 36, right: 20, bottom: 54, left: 52 };
  const chartW = canvas.width - pad.left - pad.right;
  const chartH = canvas.height - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 22);

  const steps = 5;
  for (let s = 0; s <= steps; s++) {
    const yPos = pad.top + chartH - (s / steps) * chartH;
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.left, yPos); ctx.lineTo(pad.left + chartW, yPos); ctx.stroke();
    ctx.fillStyle = '#64748B';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round((s / steps) * maxVal)), pad.left - 5, yPos + 3);
  }

  const barW  = (chartW / labels.length) * 0.55;
  const barGap = chartW / labels.length;
  labels.forEach((lbl, i) => {
    const barH = (values[i] / maxVal) * chartH;
    const x = pad.left + i * barGap + (barGap - barW) / 2;
    const y = pad.top + chartH - barH;
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '88');
    ctx.fillStyle = grad;
    ctx.beginPath();
    (ctx as any).roundRect(x, y, barW, barH, 4);
    ctx.fill();
    ctx.fillStyle = '#1D4ED8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(values[i]), x + barW / 2, y - 4);
    const shortLbl = lbl.length > 10 ? lbl.substring(0, 10) + '...' : lbl;
    ctx.fillStyle = '#475569';
    ctx.font = '8px sans-serif';
    ctx.save();
    ctx.translate(x + barW / 2, pad.top + chartH + 10);
    ctx.rotate(-Math.PI / 5);
    ctx.fillText(shortLbl, 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH);
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

function drawPieChart(labels: string[], values: number[], title: string): string {
  const canvas = document.createElement('canvas');
  canvas.width  = 300;
  canvas.height = 280;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 20);

  const total = values.reduce((a, b) => a + b, 0);
  const cx = canvas.width / 2, cy = 130, r = 80, inner = 44;
  let startAngle = -Math.PI / 2;

  values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    startAngle += slice;
  });

  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = '#F8FAFC'; ctx.fill();

  ctx.fillStyle = '#0F172A'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(String(total), cx, cy + 5);
  ctx.font = '8px sans-serif'; ctx.fillStyle = '#64748B';
  ctx.fillText('TOTAL', cx, cy + 15);

  const legendY = cy + r + 16;
  const colW = canvas.width / 2;
  labels.forEach((lbl, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = col * colW + 12, ly = legendY + row * 16;
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
    ctx.beginPath(); ctx.arc(lx + 5, ly, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#475569'; ctx.font = '8px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${lbl.length > 16 ? lbl.substring(0, 16) + '...' : lbl} (${values[i]})`, lx + 13, ly + 4);
  });

  return canvas.toDataURL('image/png');
}

async function revenueReport(doc: jsPDF, data: any[]) {
  let y = await drawHeader(doc, 'Financial Revenue Report');
  const pw = doc.internal.pageSize.getWidth();
  const totalInv  = data.reduce((s, r) => s + (r.invoiceAmount || 0), 0);
  const totalPaid = data.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const totalDue  = data.reduce((s, r) => s + (r.dueAmount || 0), 0);
  const cleared   = data.filter(r => r.dueAmount <= 0).length;

  y = drawKpiRow(doc, y, [
    { label: 'Total Invoiced',    value: `Rs.${totalInv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,  color: C.accent },
    { label: 'Amount Collected',  value: `Rs.${totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: C.emerald },
    { label: 'Balance Due',       value: `Rs.${totalDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,  color: C.rose },
    { label: 'Total Invoices',    value: String(data.length), color: C.primary },
    { label: 'Fully Cleared',     value: String(cleared),     color: C.amber },
  ]);

  const top10 = [...data].sort((a, b) => b.invoiceAmount - a.invoiceAmount).slice(0, 10);
  const barImg = drawBarChart(
    top10.map(r => r.job?.customer?.companyName || 'N/A'),
    top10.map(r => r.invoiceAmount),
    '#1D4ED8', 'Invoice Amount by Client (Top 10)'
  );
  doc.addImage(barImg, 'PNG', 12, y, pw - 24, 52);
  y += 56;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Invoice No.', 'Client Company', 'Invoice (Rs.)', 'Paid (Rs.)', 'Due (Rs.)', 'Date']],
    body: data.map((r, i) => [
      i + 1, r.invoiceNumber || '-', r.job?.customer?.companyName || '-',
      (r.invoiceAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      (r.paidAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      (r.dueAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      new Date(r.invoiceDate || r.createdAt).toLocaleDateString('en-IN'),
    ]),
    foot: [['', 'TOTAL', '',
      totalInv.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      totalDue.toLocaleString('en-IN', { maximumFractionDigits: 2 }), '']],
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, textColor: C.primary },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    margin: { left: 12, right: 12 },
  });
}

async function brandReport(doc: jsPDF, data: any[]) {
  let y = await drawHeader(doc, 'Brand Wise Repair Share Report');
  const pw = doc.internal.pageSize.getWidth();
  const totalJobs = data.reduce((s, r) => s + r.total, 0);
  const totalDone = data.reduce((s, r) => s + r.completed, 0);

  y = drawKpiRow(doc, y, [
    { label: 'Total Jobs Received', value: String(totalJobs),            color: C.accent },
    { label: 'Completed & Closed',  value: String(totalDone),            color: C.emerald },
    { label: 'Active / On-Hold',    value: String(totalJobs - totalDone), color: C.amber },
    { label: 'Brands Serviced',     value: String(data.length),          color: C.primary },
  ]);

  const halfW = (pw - 28) / 2;
  const barImg = drawBarChart(data.map(r => r.brand), data.map(r => r.total), '#1D4ED8', 'Total Jobs by Brand');
  const pieImg = drawPieChart(data.map(r => r.brand), data.map(r => r.total), 'Brand Share %');
  doc.addImage(barImg, 'PNG', 12, y, halfW + 10, 52);
  doc.addImage(pieImg, 'PNG', 14 + halfW + 10, y, halfW - 10, 52);
  y += 56;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Laser Brand', 'Total Inward', 'Completed', 'Active / On-Hold', 'Close Rate']],
    body: data.map((r, i) => [
      i + 1, r.brand, r.total, r.completed, r.pending,
      r.total > 0 ? ((r.completed / r.total) * 100).toFixed(1) + '%' : '0%',
    ]),
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, textColor: C.primary },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: {
      2: { halign: 'center', fontStyle: 'bold' },
      3: { halign: 'center', textColor: [5, 150, 105] },
      4: { halign: 'center', textColor: [217, 119, 6] },
      5: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: 12, right: 12 },
  });
}

async function engineerReport(doc: jsPDF, data: any[]) {
  let y = await drawHeader(doc, 'Engineer Workload Performance Report');
  const pw = doc.internal.pageSize.getWidth();
  const totalRepairs = data.reduce((s, r) => s + r.repairsCount, 0);
  const totalHrs     = data.reduce((s, r) => s + (r.totalDurationHrs || 0), 0);
  const topEng       = [...data].sort((a, b) => b.repairsCount - a.repairsCount)[0];

  y = drawKpiRow(doc, y, [
    { label: 'Active Engineers',     value: String(data.length),       color: C.accent },
    { label: 'Total Repairs Logged', value: String(totalRepairs),       color: C.emerald },
    { label: 'Total Hours Invested', value: `${totalHrs.toFixed(1)}h`,  color: C.cyan },
    { label: 'Top Performer',        value: topEng?.name?.split(' ')[0] || '-', color: C.primary },
  ]);

  const barImg = drawBarChart(data.map(r => r.name), data.map(r => r.repairsCount), '#06B6D4', 'Repairs Completed per Engineer');
  doc.addImage(barImg, 'PNG', 12, y, pw - 24, 52);
  y += 56;

  const hrsImg = drawBarChart(data.map(r => r.name), data.map(r => r.totalDurationHrs || 0), '#10B981', 'Total Hours Worked per Engineer');
  doc.addImage(hrsImg, 'PNG', 12, y, pw - 24, 52);
  y += 56;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Service Engineer', 'Repairs Completed', 'Avg Repair Time', 'Total Hours Worked', 'Efficiency Rank']],
    body: data.map((r, i) => {
      const rank = [...data].sort((a, b) => b.repairsCount - a.repairsCount).findIndex(e => e.name === r.name) + 1;
      return [
        i + 1, r.name, r.repairsCount,
        r.repairsCount > 0 ? Number(r.avgDuration).toFixed(0) + ' min' : '-',
        r.totalDurationHrs > 0 ? r.totalDurationHrs + ' hrs' : '-',
        `#${rank}`,
      ];
    }),
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, textColor: C.primary },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: {
      2: { halign: 'center', fontStyle: 'bold' },
      3: { halign: 'center', textColor: [6, 182, 212] },
      4: { halign: 'center', textColor: [5, 150, 105] },
      5: { halign: 'center', fontStyle: 'bold', textColor: [29, 78, 216] },
    },
    margin: { left: 12, right: 12 },
  });
}

async function failureReport(doc: jsPDF, data: any[]) {
  let y = await drawHeader(doc, 'Error Code & Failure Category Analysis Report');
  const pw = doc.internal.pageSize.getWidth();
  const totalIncidents = data.reduce((s, r) => s + r.count, 0);
  const topFault = [...data].sort((a, b) => b.count - a.count)[0];

  y = drawKpiRow(doc, y, [
    { label: 'Total Fault Records', value: String(totalIncidents),                        color: C.rose },
    { label: 'Fault Categories',    value: String(data.length),                           color: C.accent },
    { label: 'Most Common Fault',   value: topFault?.fault?.split('/')[0]?.trim() || '-', color: C.amber },
    { label: 'Top Count',           value: String(topFault?.count || 0),                  color: C.primary },
  ]);

  const halfW = (pw - 28) / 2;
  const barImg = drawBarChart(data.map(r => r.fault), data.map(r => r.count), '#F43F5E', 'Fault Incidents by Category');
  const pieImg = drawPieChart(data.map(r => r.fault), data.map(r => r.count), 'Fault Share %');
  doc.addImage(barImg, 'PNG', 12, y, halfW + 10, 52);
  doc.addImage(pieImg, 'PNG', 14 + halfW + 10, y, halfW - 10, 52);
  y += 56;

  doc.setFillColor(...C.accentLt);
  doc.roundedRect(12, y, pw - 24, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.accent);
  const pctTop = totalIncidents > 0 ? ((topFault?.count / totalIncidents) * 100).toFixed(1) : '0';
  doc.text(`Analysis: "${topFault?.fault || '-'}" accounts for ${pctTop}% of all faults. Prioritise preventive maintenance on this category.`, 16, y + 7.5);
  y += 16;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Fault / Failure Description', 'Incidents Logged', 'Share (%)', 'Risk Level']],
    body: data.map((r, i) => {
      const pct  = totalIncidents > 0 ? ((r.count / totalIncidents) * 100).toFixed(1) : '0';
      const risk = r.count > 5 ? 'HIGH' : r.count > 2 ? 'MEDIUM' : 'LOW';
      return [i + 1, r.fault, r.count, `${pct}%`, risk];
    }),
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, textColor: C.primary },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: {
      2: { halign: 'center', fontStyle: 'bold', textColor: [225, 29, 72] },
      3: { halign: 'center' },
      4: { halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.column.index === 4 && hookData.section === 'body') {
        const v = hookData.cell.raw as string;
        if (v === 'HIGH')   hookData.cell.styles.textColor = [225, 29, 72];
        if (v === 'MEDIUM') hookData.cell.styles.textColor = [217, 119, 6];
        if (v === 'LOW')    hookData.cell.styles.textColor = [5, 150, 105];
      }
    },
    margin: { left: 12, right: 12 },
  });
}

export async function exportAdvancedPDF(reportType: string, reportLabel: string, reportData: any[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  if      (reportType === 'revenue')  await revenueReport(doc, reportData);
  else if (reportType === 'brand')    await brandReport(doc, reportData);
  else if (reportType === 'engineer') await engineerReport(doc, reportData);
  else if (reportType === 'failure')  await failureReport(doc, reportData);

  drawFooter(doc);
  doc.save(`LEILLP_${reportType.toUpperCase()}_REPORT_${new Date().toISOString().slice(0, 10)}.pdf`);
}
