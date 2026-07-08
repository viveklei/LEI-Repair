import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { exportAdvancedExcel } from '../utils/exportExcel';
import { exportAdvancedPDF } from '../utils/exportPDF';
import { 
  BarChart3, 
  Download, 
  FileText, 
  BrainCircuit, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  BadgePercent,
  FileSpreadsheet
} from 'lucide-react';

const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('daily');
  const [reportData, setReportData] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'standard' | 'ai'>('standard');

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/data?type=${reportType}`);
      setReportData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async () => {
    try {
      const res = await api.get('/reports/ai-insights');
      setInsights(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'standard') {
      fetchReportData();
    } else {
      fetchInsights();
    }
  }, [reportType, activeTab]);

  const reportLabels: Record<string, string> = {
    daily: 'Daily Job Log',
    weekly: 'Weekly Operational Report',
    monthly: 'Monthly Operations Report',
    yearly: 'Yearly Operations Report',
    revenue: 'Financial Revenue Report',
    brand: 'Brand Wise Repair Share',
    engineer: 'Engineer Workload Performance',
    failure: 'Error Code & Failure Category',
  };

  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Which report types use Excel vs PDF
  const excelTypes = ['daily', 'weekly', 'monthly', 'yearly'];
  const isExcelReport = excelTypes.includes(reportType);

  const handleExportExcel = async () => {
    if (reportData.length === 0) return;
    setExcelLoading(true);
    try {
      await exportAdvancedExcel(reportType, reportLabels[reportType] || reportType, reportData);
    } catch (err) {
      console.error('Excel export failed:', err);
      alert('Failed to generate Excel report. Please try again.');
    } finally {
      setExcelLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (reportData.length === 0) return;
    setPdfLoading(true);
    try {
      await exportAdvancedPDF(reportType, reportLabels[reportType] || reportType, reportData);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reports & Diagnostics Analytics</h1>
          <p className="text-sm text-slate-500">Generate production reports and trace operational metrics using AI insights.</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-slate-200/50 p-1 rounded-xl max-w-sm">
        <button
          onClick={() => setActiveTab('standard')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all ${
            activeTab === 'standard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Standard Reports
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
            activeTab === 'ai' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BrainCircuit className="h-4 w-4" />
          AI Management Insights
        </button>
      </div>

      {/* --- TAB 1: STANDARD REPORT EXPORTS --- */}
      {activeTab === 'standard' ? (
        <div className="space-y-6 animate-fade-in">
          {/* Filters card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase">Select Report Category:</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="daily">Daily Job Log</option>
                <option value="weekly">Weekly Operational Report</option>
                <option value="monthly">Monthly Operations Report</option>
                <option value="yearly">Yearly Operations Report</option>
                <option value="revenue">Financial Revenue Report</option>
                <option value="brand">Brand Wise Repair Share</option>
                <option value="engineer">Engineer Workload Performance</option>
                <option value="failure">Error Code & Failure Category</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              {isExcelReport ? (
                /* ── Excel export for time-based reports ── */
                <button
                  onClick={handleExportExcel}
                  disabled={reportData.length === 0 || excelLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 cursor-pointer transition-all text-xs shadow-sm shadow-emerald-200"
                >
                  {excelLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  {excelLoading ? 'Generating...' : 'Export Excel'}
                </button>
              ) : (
                /* ── PDF export for analytical reports ── */
                <button
                  onClick={handleExportPDF}
                  disabled={reportData.length === 0 || pdfLoading}
                  className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 cursor-pointer transition-all text-xs shadow-sm shadow-rose-200"
                >
                  {pdfLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {pdfLoading ? 'Generating PDF...' : 'Export PDF'}
                </button>
              )}
            </div>
          </div>

          {/* Report Data Table Preview */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-left">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : reportData.length === 0 ? (
              <p className="py-20 text-center text-slate-400 text-xs">No records available for the selected range.</p>
            ) : reportType === 'revenue' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Invoice Number</th>
                      <th className="py-4 px-6">Client Company</th>
                      <th className="py-4 px-6">Invoice Amount</th>
                      <th className="py-4 px-6">Amount Cleared</th>
                      <th className="py-4 px-6">Balance Due</th>
                      <th className="py-4 px-6">Date Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {reportData.map((row: any) => (
                      <tr key={row.id}>
                        <td className="py-4 px-6 font-bold text-slate-900">{row.invoiceNumber || '—'}</td>
                        <td className="py-4 px-6">{row.job?.customer?.companyName || '—'}</td>
                        <td className="py-4 px-6 font-bold text-slate-800">₹{(row.invoiceAmount || 0).toFixed(2)}</td>
                        <td className="py-4 px-6 text-emerald-600 font-bold">₹{(row.paidAmount || 0).toFixed(2)}</td>
                        <td className="py-4 px-6 text-rose-600 font-bold">₹{(row.dueAmount || 0).toFixed(2)}</td>
                        <td className="py-4 px-6 text-slate-400">
                          {row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : reportType === 'brand' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Laser Brand</th>
                      <th className="py-4 px-6 text-center">Total Inward Repairs</th>
                      <th className="py-4 px-6 text-center">Completed & Closed</th>
                      <th className="py-4 px-6 text-center">Active / On-Hold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {reportData.map((row: any) => (
                      <tr key={row.brand}>
                        <td className="py-4 px-6 font-bold text-slate-900">{row.brand}</td>
                        <td className="py-4 px-6 text-center text-slate-900 font-black">{row.total}</td>
                        <td className="py-4 px-6 text-center text-emerald-600">{row.completed}</td>
                        <td className="py-4 px-6 text-center text-amber-600">{row.pending}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : reportType === 'engineer' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Service Engineer</th>
                      <th className="py-4 px-6 text-center">Total Repairs Logged</th>
                      <th className="py-4 px-6 text-center">Avg Repair Time (Min)</th>
                      <th className="py-4 px-6 text-center">Total Hours Worked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {reportData.length === 0 ? (
                      <tr><td colSpan={4} className="py-10 text-center text-slate-400">No engineer repair data found.</td></tr>
                    ) : reportData.map((row: any) => (
                      <tr key={row.name}>
                        <td className="py-4 px-6 font-bold text-slate-900">{row.name}</td>
                        <td className="py-4 px-6 text-center font-black text-slate-900">{row.repairsCount}</td>
                        <td className="py-4 px-6 text-center text-cyan-600 font-bold">
                          {row.repairsCount > 0 ? `${Number(row.avgDuration).toFixed(0)} min` : '—'}
                        </td>
                        <td className="py-4 px-6 text-center text-emerald-600 font-bold">
                          {row.totalDurationHrs > 0 ? `${row.totalDurationHrs} hrs` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : reportType === 'failure' ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Visual SVG bar chart */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Diagnostics Fault Breakdown</h4>
                    <div className="space-y-4">
                      {reportData.map((row: any, i: number) => {
                        const total = reportData.reduce((sum: number, r: any) => sum + r.count, 0);
                        const pct = total > 0 ? (row.count / total) * 100 : 0;
                        const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                        const colorClass = colors[i % colors.length];
                        return (
                          <div key={row.fault} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-slate-700">{row.fault}</span>
                              <span className="text-slate-900">{row.count} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SVG Donut Chart */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 self-start">Failure Category Share</h4>
                    <svg width="150" height="150" viewBox="0 0 180 180" className="transform -rotate-90">
                      {(() => {
                        const total = reportData.reduce((sum: number, r: any) => sum + r.count, 0);
                        let accumulatedPercent = 0;
                        const colors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];
                        
                        return reportData.map((row: any, i: number) => {
                          const pct = total > 0 ? (row.count / total) : 0;
                          const strokeDasharray = `${pct * 2 * Math.PI * 50} ${2 * Math.PI * 50}`;
                          const strokeDashoffset = `${-accumulatedPercent * 2 * Math.PI * 50}`;
                          accumulatedPercent += pct;
                          return (
                            <circle
                              key={row.fault}
                              cx="90"
                              cy="90"
                              r="50"
                              fill="transparent"
                              stroke={colors[i % colors.length]}
                              strokeWidth="20"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-1000 hover:stroke-[25px] cursor-pointer"
                            />
                          );
                        });
                      })()}
                      <circle cx="90" cy="90" r="35" fill="#f8fafc" />
                    </svg>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-[10px] font-bold text-slate-500">
                      {reportData.map((row: any, i: number) => {
                        const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                        return (
                          <div key={row.fault} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                            <span>{row.fault}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-4 px-6">Failure / Fault Description</th>
                        <th className="py-4 px-6 text-center">Incidents Logged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {reportData.map((row: any) => (
                        <tr key={row.fault}>
                          <td className="py-4 px-6 font-bold text-slate-900">{row.fault}</td>
                          <td className="py-4 px-6 text-center font-black text-rose-600">{row.count} times</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Track ID</th>
                      <th className="py-4 px-6">Company</th>
                      <th className="py-4 px-6">Laser Brand</th>
                      <th className="py-4 px-6">Failure Category</th>
                      <th className="py-4 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {reportData.map((row: any) => (
                      <tr key={row.id}>
                        <td className="py-4 px-6 font-bold text-blue-600">{row.trackId}</td>
                        <td className="py-4 px-6 font-bold text-slate-800">{row.customer.companyName}</td>
                        <td className="py-4 px-6">{row.laserSource.brand} ({row.laserSource.powerRating})</td>
                        <td className="py-4 px-6 font-semibold text-slate-600">{row.complaintCategory}</td>
                        <td className="py-4 px-6 uppercase text-[10px] text-slate-400">{row.status.replace('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- TAB 2: AI ANALYTICS INSIGHTS --- */
        <div className="space-y-6 animate-fade-in text-left">
          
          <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-5">
            <div className="p-4 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20 shrink-0">
              <BrainCircuit className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">AI Diagnostics & Operations Analyzer</h3>
              <p className="text-xs text-slate-300 mt-1">Aggregating historical data points to auto-detect chronic equipment defects and service throughput trends.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Defect Patterns Found</p>
                <h4 className="text-lg font-black text-slate-950">Chronic Diodes Wear</h4>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Average Repair TAT</p>
                <h4 className="text-lg font-black text-slate-950">5.2 Days</h4>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">QC Success Rate</p>
                <h4 className="text-lg font-black text-slate-950">94.8%</h4>
              </div>
            </div>
          </div>

          {/* Simulated natural language AI summaries list */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-50 pb-2">Auto-Generated Management Insights</h3>
            <div className="space-y-4 font-medium text-xs text-slate-700">
              {insights && insights.insights ? (
                insights.insights.map((ins: string, idx: number) => (
                  <div key={idx} className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/50 flex items-start gap-2.5">
                    <span className="text-blue-600 mt-0.5">&bull;</span>
                    <p className="leading-relaxed text-slate-800">{ins}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/50 flex items-start gap-2.5">
                  <span className="text-blue-600 mt-0.5">&bull;</span>
                  <p className="leading-relaxed text-slate-800">Raycus 3kW sources experienced 18 module failures this quarter due to coolant temp alarms.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default Reports;
