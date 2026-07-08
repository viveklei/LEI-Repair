import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Cpu, Check, AlertCircle } from 'lucide-react';

const PublicTracker: React.FC = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await axios.get(`${backendUrl}/public/track/${trackId}`);
        setJob(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to locate tracking record');
      } finally {
        setLoading(false);
      }
    };

    if (trackId) {
      fetchStatus();
    }
  }, [trackId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold">Tracking Record Not Found</h1>
        <p className="text-sm text-slate-400 mt-2 text-center max-w-md">
          {error || `We could not find any active service job with Tracking ID: "${trackId}". Please verify the ID or contact support.`}
        </p>
      </div>
    );
  }

  const order = [
    'RECEIVED',
    'INITIAL_DIAGNOSIS',
    'QUOTATION_GENERATED',
    'REPAIR_INITIATED',
    'UNDER_REPAIR',
    'REPAIR_COMPLETED',
    'TESTING_BURN_IN',
    'READY_FOR_DISPATCH',
    'PAYMENT_COMPLETED',
    'DISPATCHED',
    'CLOSED'
  ];

  const currentIdx = order.indexOf(job.status);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto w-full space-y-8">
        
        {/* Header Branding */}
        <div className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight text-white uppercase">LEI Repair Portal</span>
          </div>
          <h2 className="text-xs font-semibold text-blue-500 tracking-wider uppercase">Live Repair Tracker</h2>
        </div>

        {/* Tracking Card */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl space-y-6 text-left">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tracking Reference</p>
              <h3 className="text-2xl font-black text-white mt-1">{job.trackId}</h3>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Status</p>
              <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-black rounded-lg uppercase mt-1 tracking-wider">
                {job.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Device Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Laser Source</p>
              <p className="font-bold text-white mt-0.5">{job.laserSource.brand} {job.laserSource.powerRating}</p>
              <p className="text-slate-400 mt-0.5">Model: {job.laserSource.modelNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Registered Customer</p>
              <p className="font-bold text-white mt-0.5">{job.customer.companyName}</p>
              <p className="text-slate-400 mt-0.5">Inward Date: {new Date(job.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Visual Progress Timeline */}
          <div className="space-y-4 pt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repair Lifecycle Stage</h4>
            
            <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
              {order.map((step, idx) => {
                let activeStatus = job.status;
                if (activeStatus === 'REPAIR_INITIATED') activeStatus = 'UNDER_REPAIR';
                if (activeStatus === 'REPAIR_COMPLETED') activeStatus = 'TESTING_BURN_IN';

                const isActive = step === activeStatus;
                const isDone = idx < order.indexOf(activeStatus);
                
                const displayNames: { [key: string]: string } = {
                  'RECEIVED': 'Laser Received & Visual Inspection',
                  'INITIAL_DIAGNOSIS': 'Initial Fault Assessment',
                  'QUOTATION_GENERATED': 'Quotation & Customer Approval',
                  'UNDER_REPAIR': 'Repair In Progress',
                  'TESTING_BURN_IN': 'QC Stability Validation & Burn-in',
                  'READY_FOR_DISPATCH': 'Ready for Shipping',
                  'DISPATCHED': 'Courier Dispatched'
                };

                if (!displayNames[step]) return null;

                return (
                  <div key={step} className="relative text-left">
                    <div className={`absolute -left-[31px] top-0.5 h-4 w-4 rounded-full border-2 transition-all flex items-center justify-center ${
                      isActive 
                        ? 'bg-blue-600 border-blue-500 ring-4 ring-blue-500/20 scale-110 shadow-md'
                        : isDone 
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'bg-slate-900 border-slate-800'
                    }`}>
                      {isDone && <Check className="h-2.5 w-2.5 text-white font-black" />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isActive ? 'text-blue-400' : isDone ? 'text-slate-200' : 'text-slate-600'}`}>
                        {displayNames[step]}
                      </p>
                      {isActive && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Our engineers are currently processing your unit at this stage. Last update: {new Date(job.updatedAt).toLocaleString()}.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-600 mt-8">
          Powered by LEI Repair Management System. Copyright &copy; {new Date().getFullYear()} Laser Experts India.
        </p>
      </div>
    </div>
  );
};

export default PublicTracker;
