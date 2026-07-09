import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { socket } from '../services/socket';
import { fileUrl } from '../utils/urls';
import { useAuth } from '../context/AuthContext';
import { 
  Wrench, 
  Cpu, 
  FileText, 
  Truck, 
  Calendar,
  CheckCircle,
  XCircle,
  FileBadge,
  DollarSign,
  Download,
  Upload
} from 'lucide-react';

const CustomerPortal: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isPortal, logout } = useAuth();
  
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/jobs/${id}/comments`, { message: commentText });
      setJob((prev: any) => ({
        ...prev,
        comments: [...(prev.comments || []), res.data]
      }));
      setCommentText('');
    } catch (err) {
      console.error(err);
      alert('Failed to send message');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`/jobs/${id}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setJob((prev: any) => ({
        ...prev,
        files: [...(prev.files || []), res.data]
      }));
      alert('File uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const fetchJob = async () => {
    try {
      const res = await api.get(`/jobs/${id}`);
      setJob(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleQuotationDecision = async (approve: boolean, reason?: string) => {
    if (!job || !job.quotations || job.quotations.length === 0) return;
    const q = job.quotations[0];
    try {
      await api.post(`/quotation/${q.id}/approve`, { approve, rejectionReason: reason });
      alert(approve ? 'Quotation approved successfully!' : 'Quotation rejected.');
      fetchJob();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update quotation decision.');
    }
  };

  useEffect(() => {
    // If not authenticated as customer portal session, redirect to login
    if (!isPortal) {
      logout();
      navigate('/login');
      return;
    }

    fetchJob();
  }, [id, isPortal]);

  useEffect(() => {
    if (!id) return;
    socket.emit('join_job', id);

    const handleCommentAdded = (comment: any) => {
      setJob((prev: any) => {
        if (!prev) return prev;
        const exists = prev.comments?.some((c: any) => c.id === comment.id);
        if (exists) return prev;
        return {
          ...prev,
          comments: [...(prev.comments || []), comment]
        };
      });
    };

    const handleFileUploaded = (file: any) => {
      setJob((prev: any) => {
        if (!prev) return prev;
        const exists = prev.files?.some((f: any) => f.id === file.id);
        if (exists) return prev;
        return {
          ...prev,
          files: [...(prev.files || []), file]
        };
      });
    };

    socket.on('comment_added', handleCommentAdded);
    socket.on('file_uploaded', handleFileUploaded);

    return () => {
      socket.off('comment_added', handleCommentAdded);
      socket.off('file_uploaded', handleFileUploaded);
    };
  }, [id]);

  if (loading || !job) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getStatusColor = (st: string) => {
    let activeStatus = job.status;
    if (activeStatus === 'REPAIR_INITIATED') activeStatus = 'UNDER_REPAIR';
    if (activeStatus === 'REPAIR_COMPLETED') activeStatus = 'TESTING_BURN_IN';

    if (activeStatus === st) return 'border-blue-500 bg-blue-500 text-white';
    
    const order = [
      'RECEIVED',
      'INITIAL_DIAGNOSIS',
      'QUOTATION_GENERATED',
      'UNDER_REPAIR',
      'TESTING_BURN_IN',
      'READY_FOR_DISPATCH',
      'PAYMENT_COMPLETED',
      'DISPATCHED',
      'CLOSED'
    ];
    const currentIndex = order.indexOf(activeStatus);
    const itemIndex = order.indexOf(st);
    if (currentIndex >= itemIndex) return 'border-emerald-500 bg-emerald-500 text-white';
    return 'border-slate-200 text-slate-300';
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Customer Portal Tracking Panel
          </span>
          <h1 className="text-xl font-black mt-2 text-white">Track ID: {job.trackId}</h1>
          <p className="text-xs text-slate-400 mt-1">Updates live in real time. Strictly read-only.</p>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
        >
          Exit Portal
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Technical Specification Summary */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-50 pb-2">Laser Details</h3>
            <div className="text-xs space-y-2.5 text-slate-600 font-medium">
              <p className="text-sm font-bold text-slate-900">{job.laserSource.brand} ({job.laserSource.powerRating})</p>
              <p>Model: {job.laserSource.modelNumber}</p>
              <p>Serial: {job.laserSource.serialNumber}</p>
              <p>Complaint: {job.complaintDescription}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-50 pb-2">Financials & Logistics</h3>
            <div className="text-xs space-y-3">
              <div className="flex justify-between items-center text-slate-600 font-semibold">
                <span>Payment Status:</span>
                <span className={`px-2.5 py-0.5 rounded font-bold uppercase text-[10px] ${
                  job.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {job.paymentStatus}
                </span>
              </div>
              {job.dispatches && job.dispatches.length > 0 && (() => {
                const courier = job.dispatches[0].courierName;
                const awb = job.dispatches[0].awbNumber;
                
                // Set of couriers supporting live tracking
                const hasLiveTracking = ['Blue Dart', 'ST Couriers', 'DHL Express', 'FedEx', 'DTDC'].some(c => 
                  courier.toLowerCase().includes(c.toLowerCase())
                );

                return (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-left">
                      <p className="font-bold text-slate-800 flex items-center gap-1">
                        <Truck className="h-4 w-4 text-blue-500" /> Shipped
                      </p>
                      <p className="text-[10px] text-slate-600">
                        <span className="font-bold">Carrier:</span> {courier}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        <span className="font-bold">AWB / Ref No:</span> <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono font-bold">{awb}</code>
                      </p>
                    </div>

                    {/* Conditional live tracking or warning notice */}
                    {hasLiveTracking ? (
                      <div className="rounded-xl overflow-hidden border border-slate-100 shadow-inner bg-slate-100 flex flex-col">
                        <div className="bg-blue-600 text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-wider flex items-center justify-between">
                          <span>📡 Live Tracking Stream</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        </div>
                        <div className="h-40 bg-slate-200 relative flex items-center justify-center text-slate-500 font-semibold p-4 text-center text-xs overflow-hidden">
                          {/* Tech background map representation */}
                          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
                          <div className="z-10 space-y-1">
                            <Truck className="h-8 w-8 mx-auto text-blue-600 animate-bounce mb-1" />
                            <p className="font-extrabold text-slate-800">In-Transit Status Verified</p>
                            <p className="text-[10px] text-slate-400">Secure link connected via {courier} API</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50/60 border border-amber-200/50 rounded-xl text-left space-y-1">
                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1">
                          ⚠️ Manual Tracking Facility
                        </p>
                        <p className="text-[10px] text-amber-700 leading-relaxed font-semibold">
                          Live courier map tracking is not supported by this regional partner/travel bus service. Please contact their parcel office or reference your consignment AWB at their booking counter.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Documents & Photos */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-slate-400" /> Documents & Photos</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{(job.files || []).length}</span>
            </h3>
            
            {(!job.files || job.files.length === 0) ? (
              <p className="text-xs text-slate-400 italic">No attachments uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                {job.files.map((file: any) => {
                  const isImg = file.fileType === 'IMAGE';
                  return (
                    <div key={file.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors text-left">
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        {isImg ? (
                          <img src={fileUrl(file.fileUrl)} className="h-8 w-8 object-cover rounded-lg border border-slate-200 shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 border border-blue-100">PDF</div>
                        )}
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]" title={file.originalName}>
                          {file.originalName}
                        </span>
                      </div>
                      <a
                        href={fileUrl(file.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors shrink-0"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Chat & Collaboration */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[400px]">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-50 pb-2 flex items-center justify-between">
              <span>Live Support Chat & Approvals</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>
            
            {/* Chat messages box */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 text-xs text-left scrollbar-thin">
              {(!job.comments || job.comments.length === 0) ? (
                <div className="h-full flex items-center justify-center text-slate-400 italic">
                  No messages yet. Send a message to get support.
                </div>
              ) : (
                job.comments.map((c: any) => {
                  const isMe = c.sender === 'CUSTOMER';
                  return (
                    <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3 rounded-2xl max-w-[85%] font-medium ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                      }`}>
                        <p>{c.message}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1">
                        {c.senderName} · {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Upload PO/Receipt section */}
            <div className="border-t border-slate-100 pt-3 flex gap-2 items-center">
              <label className="flex items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 cursor-pointer transition-all shadow-sm shrink-0">
                <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,image/*" disabled={uploading} />
                <Upload className={`h-4.5 w-4.5 ${uploading ? 'animate-bounce text-blue-500' : ''}`} />
              </label>
              
              <form onSubmit={handleSendComment} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Type message or upload PO..."
                  className="flex-1 border border-slate-200 rounded-xl px-3 text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* Live Timeline and Files */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Timeline progress */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="font-extrabold text-slate-900 text-sm">Service Status Progress</h3>
            
            <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6 text-left">
              {[
                { st: 'RECEIVED', label: 'Laser Received & Visual Inspection', desc: 'Equipment registered inward.' },
                { st: 'INITIAL_DIAGNOSIS', label: 'Technical Diagnostics', desc: 'Engineers completed internal visual & physical audit.' },
                { st: 'QUOTATION_GENERATED', label: 'Quotation & Customer Approval', desc: 'Financial invoice estimate compiled & awaiting approval.' },
                { st: 'UNDER_REPAIR', label: 'Repair In Progress', desc: 'Replaced diodes, collimators, or laser pump modules.' },
                { st: 'TESTING_BURN_IN', label: 'QC Stability Validation & Burn-in', desc: '6-step stability and output power validation in progress.' },
                { st: 'READY_FOR_DISPATCH', label: 'Validation Pass & Dispatch Ready', desc: 'Laser source passed all testing. Waiting dispatch clearance.' },
                { st: 'DISPATCHED', label: 'Courier Shipped', desc: 'Package handed over to logistics carrier.' },
                { st: 'CLOSED', label: 'Ticket Resolved', desc: 'Laser returned to factory. Service ticket closed.' }
              ].map((step) => {
                let activeStatus = job.status;
                if (activeStatus === 'REPAIR_INITIATED') activeStatus = 'UNDER_REPAIR';
                if (activeStatus === 'REPAIR_COMPLETED') activeStatus = 'TESTING_BURN_IN';
                const isCurrent = activeStatus === step.st;
                return (
                  <div key={step.st} className="relative">
                    <div className={`absolute -left-[30px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${getStatusColor(step.st)}`}></div>
                    <div className="text-xs">
                      <p className={`font-bold ${isCurrent ? 'text-blue-600' : 'text-slate-800'}`}>{step.label}</p>
                      <p className="text-slate-500 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quotations and Reports Files */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">Documents & Service Media</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {job.quotations && job.quotations.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Quotation Invoice</p>
                    <p className="text-[10px] text-slate-500">Estimate value: ₹{job.quotations[0].grandTotal.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.get(`/quotation/${job.quotations[0].id}/pdf`);
                        window.open(fileUrl(res.data.pdfUrl), '_blank');
                      } catch (e) {
                        alert('Failed to download quotation PDF');
                      }
                    }}
                    className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}

              {job.serviceReports && job.serviceReports.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">QC Service Report</p>
                    <p className="text-[10px] text-slate-500">Validation: PASSED</p>
                  </div>
                  <a
                    href={fileUrl(job.serviceReports[0].pdfUrl)}
                    target="_blank" rel="noreferrer"
                    className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>

            {job.quotations && job.quotations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-left">
                <p className="text-xs font-bold text-slate-800">Quotation Customer Approval Decision:</p>
                
                {job.quotations[0].status === 'PENDING_APPROVAL' ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to approve this quotation? This will authorize our engineers to begin repair work immediately.')) {
                          handleQuotationDecision(true);
                        }
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve & Authorize Repairs
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Please enter the reason for rejecting this quotation (required):');
                        if (reason && reason.trim()) {
                          handleQuotationDecision(false, reason);
                        } else if (reason !== null) {
                          alert('Rejection reason is required.');
                        }
                      }}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Quotation
                    </button>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                    job.quotations[0].status === 'APPROVED' 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    {job.quotations[0].status === 'APPROVED' ? (
                      <>
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>You have approved this quotation. Repair works are in progress.</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <div>
                          <p>You rejected this quotation.</p>
                          <p className="text-[10px] text-rose-600/80 font-semibold mt-0.5">Rejection Reason: &quot;{job.quotations[0].rejectionReason}&quot;</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Photos & Videos attached */}
            {job.files && job.inspections && job.inspections.length > 0 && job.files.filter((f: any) => {
              if (f.fileType !== 'IMAGE') return false;
              const fileTime = new Date(f.createdAt).getTime();
              const inspectionTime = new Date(job.inspections[0].createdAt).getTime();
              return fileTime >= (inspectionTime - 5 * 60 * 1000) && fileTime <= (inspectionTime + 30 * 1000);
            }).length > 0 && (
              <div className="space-y-2 pt-4 border-t border-slate-100 text-left">
                <p className="text-xs font-bold text-slate-800">Inspection Photos:</p>
                <div className="grid grid-cols-3 gap-3">
                  {job.files.filter((f: any) => {
                    if (f.fileType !== 'IMAGE') return false;
                    const fileTime = new Date(f.createdAt).getTime();
                    const inspectionTime = new Date(job.inspections[0].createdAt).getTime();
                    return fileTime >= (inspectionTime - 5 * 60 * 1000) && fileTime <= (inspectionTime + 30 * 1000);
                  }).map((file: any) => (
                    <div key={file.id} className="relative aspect-video rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                      <img 
                        src={fileUrl(file.fileUrl)} 
                        alt={file.originalName} 
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default CustomerPortal;
