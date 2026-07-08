import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  ClipboardList, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  Building2, 
  Cpu, 
  AlertCircle,
  Phone,
  RotateCcw
} from 'lucide-react';

const Approvals: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'VERIFICATIONS'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchJobs = async () => {
    try {
      const res = await api.get('/jobs');
      setJobs(res.data);
    } catch (e) {
      console.error('Failed to fetch jobs for approvals:', e);
    }
  };

  const fetchVerifications = async () => {
    try {
      const res = await api.get('/qc-assessment/verification/list');
      setVerifications(res.data);
    } catch (e) {
      console.error('Failed to fetch verification requests:', e);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchJobs(), fetchVerifications()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleApprovalAction = async (quoteId: string, approve: boolean, reason?: string) => {
    try {
      await api.post(`/quotation/${quoteId}/approve`, { approve, rejectionReason: reason });
      loadAllData();
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedQuoteId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update approval status.');
    }
  };

  const handleVerificationAction = async (verificationId: string, approve: boolean, remark?: string) => {
    try {
      await api.post('/qc-assessment/verification/approve', { verificationId, approve, remark });
      alert(approve ? 'QC Verification approved successfully.' : 'QC Verification rejected. Sent back to repair.');
      loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update verification approval.');
    }
  };

  const handleUndoAction = async (quoteId: string) => {
    if (!window.confirm('Are you sure you want to undo this decision? This will move the job back to Awaiting Approval.')) {
      return;
    }
    try {
      await api.post(`/quotation/${quoteId}/undo`);
      alert('Decision undone successfully.');
      loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to undo quotation decision.');
    }
  };

  const getFilteredQuotes = () => {
    const list: any[] = [];
    jobs.forEach((job) => {
      if (job.quotations && job.quotations.length > 0) {
        job.quotations.forEach((q: any) => {
          list.push({
            ...q,
            job: {
              id: job.id,
              trackId: job.trackId,
              status: job.status,
              customer: job.customer,
              laserSource: job.laserSource,
              currentEngineer: job.currentEngineer
            }
          });
        });
      }
    });

    return list.filter((item) => {
      const matchesSearch = 
        item.job.trackId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.job.customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.job.customer.customerName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'PENDING') {
        return item.status === 'PENDING_APPROVAL';
      } else if (activeTab === 'APPROVED') {
        return item.status === 'APPROVED';
      } else {
        return item.status === 'REJECTED';
      }
    });
  };

  const getFilteredVerifications = () => {
    return verifications.filter((item: any) => {
      if (!item.job) return false;
      const matchesSearch = 
        item.job.trackId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.job.customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.job.customer.customerName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  };

  const filteredQuotes = getFilteredQuotes();
  const filteredVerifications = getFilteredVerifications();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-blue-600" />
            Manager Approvals
          </h1>
          <p className="text-sm text-slate-500">Track client responses, approve service jobs, or manage held repairs.</p>
        </div>

        {/* Tab switchers */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PENDING'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Pending Quotes
          </button>
          <button
            onClick={() => setActiveTab('VERIFICATIONS')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'VERIFICATIONS'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            QC Verification Requests ({verifications.filter(v => v.status === 'PENDING_APPROVAL').length})
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'APPROVED'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approved Jobs
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'REJECTED'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            Rejected Jobs
          </button>
        </div>
      </div>

      {/* Search and stats bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full md:max-w-md text-left">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            placeholder="Search by Track ID, customer, phone..."
          />
        </div>
        
        <div className="flex gap-4 text-xs font-bold text-slate-500">
          <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
            Awaiting Approval: {jobs.filter(j => j.status === 'QUOTATION_GENERATED' || j.status === 'CUSTOMER_APPROVAL').length + verifications.filter(v => v.status === 'PENDING_APPROVAL').length}
          </span>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : activeTab === 'VERIFICATIONS' ? (
        filteredVerifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
            <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">No QC verifications found</p>
            <p className="text-xs text-slate-400 mt-1">There are no pending QC Verification requests.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {filteredVerifications.map((v: any) => (
              <div key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow relative">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">
                      {v.job.trackId}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{v.job.customer.companyName}</h3>
                  </div>
                  
                  <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                    v.status === 'PENDING_APPROVAL' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                    v.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {v.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 flex-1">
                  <div className="flex gap-2.5 items-start">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {v.job.laserSource.brand} {v.job.laserSource.modelNumber} ({v.job.laserSource.powerRating})
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">S/N: {v.job.laserSource.serialNumber}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-[11px] font-medium text-slate-600">
                    <div className="flex justify-between">
                      <span>Verified By:</span>
                      <span className="font-bold text-slate-800">{v.verifiedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Approved By:</span>
                      <span className="font-bold text-slate-800">{v.approvedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Condition:</span>
                      <span className="font-bold text-indigo-700">{v.runningCondition}</span>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-[10px] uppercase font-black text-slate-500 mb-1">Manager's Approval/Rejection Remark</label>
                      <input
                        type="text"
                        placeholder="Add manager comments..."
                        id={`mgr-remark-${v.id}`}
                        defaultValue={v.remark || ''}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none bg-white text-slate-800 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      const inputEl = document.getElementById(`mgr-remark-${v.id}`) as HTMLInputElement;
                      handleVerificationAction(v.id, false, inputEl?.value);
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Reject & Return to Repair
                  </button>
                  <button
                    onClick={() => {
                      const inputEl = document.getElementById(`mgr-remark-${v.id}`) as HTMLInputElement;
                      handleVerificationAction(v.id, true, inputEl?.value);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Approve Running Condition
                  </button>
                </div>

              </div>
            ))}
          </div>
        )
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">No approvals found</p>
          <p className="text-xs text-slate-400 mt-1">There are no quotation approval tickets matching the criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {filteredQuotes.map((quote) => (
            <div key={quote.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow relative">
              
              {/* Card Header */}
              <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">
                    {quote.job.trackId}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{quote.job.customer.companyName}</h3>
                </div>
                
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                  quote.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                  quote.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  'bg-rose-50 text-rose-700 border border-rose-100'
                }`}>
                  {quote.status.replace('_', ' ')}
                  {` (By ${quote.approvedBy || 'CUSTOMER'})`}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4 flex-1">
                {/* Laser info */}
                <div className="flex gap-2.5 items-start">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {quote.job.laserSource.brand} {quote.job.laserSource.modelNumber} ({quote.job.laserSource.powerRating})
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">S/N: {quote.job.laserSource.serialNumber}</p>
                  </div>
                </div>

                {/* Customer Contact */}
                <div className="flex gap-2.5 items-start">
                  <div className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 border border-slate-100">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{quote.job.customer.customerName}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{quote.job.customer.mobileNumber} · {quote.job.customer.email}</p>
                  </div>
                </div>

                {/* Quotation Split */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-[11px] font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>Spare Parts:</span>
                    <span className="font-bold text-slate-800">₹{quote.totalParts.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consumables:</span>
                    <span className="font-bold text-slate-800">₹{quote.totalConsumables.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Labour charges:</span>
                    <span className="font-bold text-slate-800">₹{quote.totalLabour.toFixed(2)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-800">
                    <span>Grand Total:</span>
                    <span className="text-emerald-600 text-xs">₹{quote.grandTotal.toFixed(2)}</span>
                  </div>
                  {quote.status === 'REJECTED' && quote.rejectionReason && (
                    <div className="pt-1.5 border-t border-rose-100 text-rose-700">
                      <span className="text-[10px] font-black uppercase text-rose-500 block mb-0.5">Hold Reason:</span>
                      <p className="text-[11px] leading-relaxed italic">"{quote.rejectionReason}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                {quote.status === 'PENDING_APPROVAL' ? (
                  <div className="flex gap-2 justify-end w-full">
                    <button
                      onClick={() => {
                        setSelectedQuoteId(quote.id);
                        setShowRejectModal(true);
                      }}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-150 border border-rose-200/50 text-rose-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Hold Quotation
                    </button>
                    
                    <button
                      onClick={() => handleApprovalAction(quote.id, true)}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-end w-full">
                    <a
                      href={`tel:${quote.job.customer.mobileNumber}`}
                      className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200/50 text-blue-700 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 text-center"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call ({quote.job.customer.mobileNumber})
                    </a>
                    <button
                      onClick={() => handleUndoAction(quote.id)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-200 flex items-center gap-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Undo
                    </button>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* REJECTION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 p-6 animate-fade-in text-left">
            <h2 className="text-sm font-black text-slate-950 border-b border-slate-50 pb-3 flex items-center gap-1.5">
              <XCircle className="h-5 w-5 text-rose-600" />
              Provide Rejection Reason
            </h2>

            <div className="mt-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason for Putting on Hold *</label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Specify the reason (e.g. price adjustment, client requested spare changes...)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedQuoteId(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim()}
                onClick={() => selectedQuoteId && handleApprovalAction(selectedQuoteId, false, rejectionReason)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Submit Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
