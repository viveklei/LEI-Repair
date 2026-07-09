import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { fileUrl } from '../utils/urls';
import { 
  Wrench, 
  Plus, 
  Search, 
  Calendar, 
  ArrowRight, 
  Camera, 
  CheckCircle,
  FileCheck,
  User,
  ShieldCheck,
  Upload,
  ScanLine,
  X,
  Zap,
  RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { QRScannerModal } from '../components/QRScannerModal';
import { createPortal } from 'react-dom';

const JobsList: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Create Job Modal State
  const [showModal, setShowModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Camera / OCR states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [ocrPreviewImg, setOcrPreviewImg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  
  // Registration Form
  const [formData, setFormData] = useState({
    companyName: '',
    customerName: '',
    mobileNumber: '',
    email: '',
    address: '',
    billingAddress: '',
    shippingAddress: '',
    billingState: '',
    shippingState: '',
    gstNumber: '',
    contactPerson: '',
    brand: 'Raycus',
    modelNumber: '',
    serialNumber: '',
    powerRating: '3kW',
    mfgYear: String(new Date().getFullYear()),
    machineManufacturer: '',
    machineModel: '',
    sourceType: 'Single Module',
    complaintCategory: 'No Laser Output',
    complaintDescription: '',
    receivingNotes: ''
  });

  const [photos, setPhotos] = useState<FileList | null>(null);

  // Zoho customer search states
  const [zohoResults, setZohoResults] = useState<any[]>([]);
  const [showZohoDropdown, setShowZohoDropdown] = useState(false);
  const [zohoSearchTimeout, setZohoSearchTimeout] = useState<any>(null);

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, companyName: value }));

    if (zohoSearchTimeout) {
      clearTimeout(zohoSearchTimeout);
    }

    if (value.trim().length >= 2) {
      const timeout = setTimeout(async () => {
        try {
          const res = await api.get(`/zoho/customers?query=${encodeURIComponent(value)}`);
          setZohoResults(res.data);
          setShowZohoDropdown(true);
        } catch (err) {
          console.error('Zoho customer search failed:', err);
        }
      }, 400);
      setZohoSearchTimeout(timeout);
    } else {
      setZohoResults([]);
      setShowZohoDropdown(false);
    }
  };

  const handleSelectZohoCustomer = async (zc: any) => {
    try {
      // Fetch full contact details (including billing and shipping address/state)
      const res = await api.get(`/zoho/customers/${zc.zohoContactId}`);
      const details = res.data;
      
      setFormData(prev => ({
        ...prev,
        companyName: details.companyName || zc.companyName,
        customerName: details.customerName || zc.customerName,
        mobileNumber: details.mobileNumber || zc.mobileNumber,
        email: details.email || zc.email,
        gstNumber: details.gstNumber || zc.gstNumber,
        address: details.billingAddress || details.address || '',
        billingAddress: details.billingAddress || '',
        shippingAddress: details.shippingAddress || '',
        billingState: details.billingState || '',
        shippingState: details.shippingState || '',
        contactPerson: details.customerName || zc.customerName
      }));
    } catch (err) {
      console.error('Failed to fetch Zoho customer details:', err);
      // Fallback to basic list details
      setFormData(prev => ({
        ...prev,
        companyName: zc.companyName,
        customerName: zc.customerName,
        mobileNumber: zc.mobileNumber,
        email: zc.email,
        gstNumber: zc.gstNumber,
        address: zc.address || '',
        billingAddress: zc.address || '',
        shippingAddress: zc.address || '',
        billingState: '',
        shippingState: '',
        contactPerson: zc.customerName
      }));
    } finally {
      setZohoResults([]);
      setShowZohoDropdown(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await api.get('/jobs');
      let data = res.data;
      if (user?.role === 'ENGINEER') {
        data = data.filter((j: any) => !j.currentEngineerId || j.currentEngineerId === user.id);
      }
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user]);

  /** Shared OCR scan logic — accepts a File or Blob */
  const runOcrScan = async (imageFile: File | Blob, previewUrl: string) => {
    const fd = new FormData();
    fd.append('image', imageFile, 'capture.jpg');
    setOcrLoading(true);
    setOcrPreviewImg(previewUrl);
    setOcrResult(null);
    try {
      const res = await api.post('/ocr/scan', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setOcrResult(res.data);
    } catch (err) {
      alert('OCR scan failed. Please fill manually.');
      setOcrPreviewImg(null);
    } finally {
      setOcrLoading(false);
    }
  };

  /** Apply confirmed OCR result into the form */
  const applyOcrResult = () => {
    if (!ocrResult) return;
    setFormData(prev => ({
      ...prev,
      brand: ocrResult.brand || prev.brand,
      modelNumber: ocrResult.modelNumber || prev.modelNumber,
      serialNumber: ocrResult.serialNumber || prev.serialNumber,
      powerRating: ocrResult.powerRating || prev.powerRating,
      mfgYear: ocrResult.mfgYear ? String(ocrResult.mfgYear) : prev.mfgYear,
    }));
    setOcrResult(null);
    setOcrPreviewImg(null);
  };

  /** File picker upload handler */
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const previewUrl = URL.createObjectURL(file);
    await runOcrScan(file, previewUrl);
    e.target.value = '';
  };

  /** Handles successful QR code scan to populate machine details */
  const handleInwardQrSuccess = (decodedText: string) => {
    try {
      // Decode if it is JSON or query string format
      // Standard format fallback parse:
      let parsedData: any = {};
      if (decodedText.startsWith('{')) {
        parsedData = JSON.parse(decodedText);
      } else {
        // Parse key-value strings or URL search parameters
        const urlParams = new URLSearchParams(decodedText.includes('?') ? decodedText.split('?')[1] : decodedText);
        parsedData = {
          brand: urlParams.get('brand') || urlParams.get('Brand'),
          modelNumber: urlParams.get('modelNumber') || urlParams.get('Model No') || urlParams.get('model'),
          serialNumber: urlParams.get('serialNumber') || urlParams.get('Serial No') || urlParams.get('serial') || urlParams.get('sn'),
          powerRating: urlParams.get('powerRating') || urlParams.get('Brand/Power') || urlParams.get('power'),
          mfgYear: urlParams.get('mfgYear') || urlParams.get('Mfg Year') || urlParams.get('year')
        };
      }

      // Check if we parsed anything valid, otherwise fall back to scanning line by line
      if (!parsedData.brand && !parsedData.modelNumber && !parsedData.serialNumber) {
        const lines = decodedText.split('\n');
        lines.forEach(line => {
          const upperLine = line.toUpperCase();
          if (upperLine.includes('BRAND:') || upperLine.includes('BRAND/POWER:')) {
            const val = line.split(':')[1]?.trim();
            if (val) {
              if (val.includes('|')) {
                parsedData.brand = val.split('|')[0].trim();
                parsedData.powerRating = val.split('|')[1].trim();
              } else {
                parsedData.brand = val;
              }
            }
          } else if (upperLine.includes('MODEL NO:') || upperLine.includes('MODEL:')) {
            parsedData.modelNumber = line.split(':')[1]?.trim();
          } else if (upperLine.includes('SERIAL NO:') || upperLine.includes('SERIAL:')) {
            parsedData.serialNumber = line.split(':')[1]?.trim();
          } else if (upperLine.includes('MFG YEAR:') || upperLine.includes('YEAR:')) {
            parsedData.mfgYear = line.split(':')[1]?.trim();
          }
        });
      }

      setFormData(prev => ({
        ...prev,
        brand: parsedData.brand || prev.brand,
        modelNumber: parsedData.modelNumber || prev.modelNumber,
        serialNumber: parsedData.serialNumber || prev.serialNumber,
        powerRating: parsedData.powerRating || prev.powerRating,
        mfgYear: parsedData.mfgYear ? String(parsedData.mfgYear) : prev.mfgYear,
      }));
      toast.success('QR Code Parsed', 'Machine specs auto-filled successfully!');
    } catch (err) {
      console.error('Failed to parse inward QR data:', err);
      // Fallback: search if it is a simple tracking URL/ID and fetch machine details
      const match = decodedText.match(/([A-Z]+-\d{4}-\d+)/i);
      if (match) {
        const trackId = match[0].toUpperCase();
        api.get(`/jobs/track/${trackId}`).then(res => {
          if (res.data.jobId) {
            api.get(`/jobs/${res.data.jobId}`).then(jobRes => {
              const j = jobRes.data;
              if (j && j.laserSource) {
                setFormData(prev => ({
                  ...prev,
                  brand: j.laserSource.brand || prev.brand,
                  modelNumber: j.laserSource.modelNumber || prev.modelNumber,
                  serialNumber: j.laserSource.serialNumber || prev.serialNumber,
                  powerRating: j.laserSource.powerRating || prev.powerRating,
                  mfgYear: j.laserSource.mfgYear ? String(j.laserSource.mfgYear) : prev.mfgYear,
                }));
                toast.success('Ticket Specs Loaded', `Loaded specs from existing job ${trackId}`);
              }
            });
          }
        }).catch(() => {
          // Silent fallback
        });
      }
    }
  };

  /** Open camera stream */
  const openCamera = async () => {
    setShowCameraModal(true);
    setCapturedImage(null);
    setOcrResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      alert('Camera access denied or unavailable. Please use the Upload option instead.');
      setShowCameraModal(false);
    }
  };

  /** Capture a still frame from the video stream */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    // Stop live stream to save resources
    cameraStream?.getTracks().forEach(t => t.pause());
  }, [cameraStream]);

  /** Retake photo */
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setOcrResult(null);
    cameraStream?.getTracks().forEach(t => { t.enabled = true; });
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play();
    }
  }, [cameraStream]);

  /** Scan the captured photo */
  const scanCapturedPhoto = useCallback(async () => {
    if (!capturedImage) return;
    setShowCameraModal(false);
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    // Convert dataURL to blob
    const res = await fetch(capturedImage);
    const blob = await res.blob();
    await runOcrScan(blob, capturedImage);
  }, [capturedImage, cameraStream]);

  /** Close camera modal */
  const closeCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCapturedImage(null);
    setShowCameraModal(false);
  }, [cameraStream]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    
    // Append form data fields
    Object.keys(formData).forEach(key => {
      fd.append(key, (formData as any)[key]);
    });

    // Append files
    if (photos) {
      for (let i = 0; i < photos.length; i++) {
        fd.append('photos', photos[i]);
      }
    }

    try {
      await api.post('/jobs', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowModal(false);
      // Reset form
      setFormData({
        companyName: '',
        customerName: '',
        mobileNumber: '',
        email: '',
        address: '',
        billingAddress: '',
        shippingAddress: '',
        billingState: '',
        shippingState: '',
        gstNumber: '',
        contactPerson: '',
        brand: 'Raycus',
        modelNumber: '',
        serialNumber: '',
        powerRating: '3kW',
        mfgYear: String(new Date().getFullYear()),
        machineManufacturer: '',
        machineModel: '',
        sourceType: 'Single Module',
        complaintCategory: 'No Laser Output',
        complaintDescription: '',
        receivingNotes: ''
      });
      setPhotos(null);
      fetchJobs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create job');
    }
  };

  const handlePrintSticker = (job: any) => {
    const stickerWindow = window.open('', '_blank', 'width=420,height=500');
    if (stickerWindow) {
      stickerWindow.document.write(`
        <html>
          <head>
            <title>Print Inward Sticker - ${job.trackId}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                text-align: center;
                padding: 15px;
                width: 320px;
                margin: 0 auto;
                color: #0f172a;
              }
              .sticker-box {
                border: 2px solid #0f172a;
                border-radius: 12px;
                padding: 16px;
                background: #fff;
              }
              .title {
                font-size: 14px;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin: 0 0 10px 0;
                color: #1e3a8a;
              }
              .track-id {
                font-size: 20px;
                font-weight: 950;
                color: #0f172a;
                margin: 5px 0;
                letter-spacing: -0.02em;
              }
              .qr-image {
                width: 130px;
                height: 130px;
                margin: 12px auto;
                display: block;
              }
              .info-grid {
                text-align: left;
                font-size: 10px;
                background: #f8fafc;
                padding: 8px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                margin-bottom: 10px;
              }
              .info-row {
                margin-bottom: 4px;
              }
              .info-row:last-child {
                margin-bottom: 0;
              }
              .footer {
                font-size: 9px;
                color: #64748b;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="sticker-box">
              <img src="${window.location.origin}/logo.png" style="height: 36px; margin: 0 auto 8px auto; display: block; object-fit: contain;" />
              <div class="title">Laser Experts India</div>
              <div class="track-id">${job.trackId}</div>
              <img class="qr-image" src="${job.qrCodeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.origin}/track/${job.trackId}`}" alt="Tracking QR Code" />
              <div class="info-grid">
                <div class="info-row"><b>Brand/Power:</b> ${job.laserSource.brand} | ${job.laserSource.powerRating}</div>
                <div class="info-row"><b>Model No:</b> ${job.laserSource.modelNumber}</div>
                <div class="info-row"><b>Serial No:</b> ${job.laserSource.serialNumber}</div>
                <div class="info-row"><b>Customer:</b> ${job.customer.companyName}</div>
              </div>
              <div class="footer">Scan QR Code to Track Live Repair Status</div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      stickerWindow.document.close();
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'RECEIVED': return 'Inspection';
      case 'INITIAL_DIAGNOSIS': return 'Required Spares';
      case 'QUOTATION_GENERATED': return 'Quotation Generated';
      case 'REPAIR_INITIATED': return 'Repair Initiated';
      case 'UNDER_REPAIR': return 'Repairing';
      case 'WAITING_SPARE_PARTS': return 'Waiting Spare Parts';
      case 'TESTING_BURN_IN': return 'QC Testing';
      case 'READY_FOR_DISPATCH': return 'Final Verification & Payment Confirmation';
      case 'PAYMENT_COMPLETED': return 'Payment Completed';
      case 'DISPATCHED': return 'Dispatching to Customer';
      case 'CLOSED': return 'Successfully Repaired';
      case 'ON_HOLD': return 'On Hold';
      default: return status.replace(/_/g, ' ');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('received')) return 'badge-received';
    if (s.includes('inspection') || s.includes('diagnosis')) return 'badge-inspection';
    if (s.includes('quotation')) return 'badge-quotation';
    if (s.includes('approval')) return 'badge-quotation';
    if (s.includes('waiting')) return 'badge-waiting';
    if (s.includes('repair')) return 'badge-repair';
    if (s.includes('testing')) return 'badge-testing';
    if (s.includes('ready')) return 'badge-ready';
    if (s.includes('dispatched')) return 'badge-dispatched';
    if (s.includes('closed')) return 'badge-closed';
    if (s.includes('hold')) return 'badge-onhold';
    return 'bg-slate-100 text-slate-700';
  };

  const filteredJobs = jobs.filter(job => {
    const matchesStatus = filterStatus === 'ALL' || job.status === filterStatus;
    const matchesSearch = 
      job.trackId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.laserSource.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Active Repair Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">Track and manage laser source repairs through the lifecycle.</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-600/20 text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Receive Laser Source</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 h-10 w-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 h-10"
            placeholder="Search by Track ID, Serial, Company, Contact Name..."
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white h-10"
        >
          <option value="ALL">All Statuses</option>
          <option value="RECEIVED">Inspection</option>
          <option value="INITIAL_DIAGNOSIS">Required Spares</option>
          <option value="QUOTATION_GENERATED">Quotation Generated</option>
          <option value="REPAIR_INITIATED">Repair Initiated</option>
          <option value="UNDER_REPAIR">Repairing</option>
          <option value="WAITING_SPARE_PARTS">Waiting Spare Parts</option>
          <option value="TESTING_BURN_IN">QC Testing</option>
          <option value="READY_FOR_DISPATCH">Final Verification &amp; Payment Confirmation</option>
          <option value="DISPATCHED">Dispatching to Customer</option>
          <option value="CLOSED">Successfully Repaired</option>
          <option value="ON_HOLD">On Hold</option>
        </select>
      </div>

      {/* Jobs — Card view on mobile, Table on desktop */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Wrench className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-sm">No repair jobs match your filter.</p>
            <p className="text-xs mt-1">Try changing the status filter or search query.</p>
          </div>
        ) : (
          <>
            {/* ── MOBILE CARD VIEW (< md) ── */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="w-full text-left px-4 py-4 hover:bg-slate-50/60 active:bg-blue-50/30 transition-colors block group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-blue-600">{job.trackId}</span>
                        <span className={`badge-status text-[9px] py-0.5 ${getStatusBadgeClass(job.status)}`}>
                          {getStatusLabel(job.status)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 truncate">{job.customer.companyName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{job.customer.customerName} · {job.customer.mobileNumber}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                          {job.laserSource.brand} {job.laserSource.powerRating}
                        </span>
                        <span className="text-[10px] text-slate-400">S/N: {job.laserSource.serialNumber}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintSticker(job);
                          }}
                          className="ml-auto text-[10px] px-2.5 py-0.5 border border-slate-250 hover:bg-slate-100 rounded-lg bg-white text-slate-700 font-bold cursor-pointer shadow-sm"
                        >
                          Print
                        </button>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
 
            {/* ── DESKTOP TABLE VIEW (>= md) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-4 px-5">Track ID</th>
                    <th className="py-4 px-5">Client Details</th>
                    <th className="py-4 px-5">Laser Source</th>
                    <th className="py-4 px-5">Fault Category</th>
                    <th className="py-4 px-5 text-center">Status</th>
                    <th className="py-4 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 font-medium text-slate-700">
                  {filteredJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3.5 px-5 font-black text-blue-600">{job.trackId}</td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-900">{job.customer.companyName}</p>
                        <p className="text-[10px] text-slate-400">{job.customer.customerName} · {job.customer.mobileNumber}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-semibold text-slate-800">{job.laserSource.brand} {job.laserSource.powerRating}</p>
                        <p className="text-[10px] text-slate-400">SN: {job.laserSource.serialNumber}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="px-2 py-1 bg-slate-100/80 text-slate-600 rounded-lg text-[10px] font-bold">
                          {job.complaintCategory}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`badge-status ${getStatusBadgeClass(job.status)}`}>
                          {getStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right flex justify-end gap-1.5 items-center">
                        <button
                          onClick={() => handlePrintSticker(job)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer text-xs font-bold border border-slate-200"
                        >
                          Print
                        </button>
                        <button
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-xl transition-all cursor-pointer text-xs font-bold shadow-sm"
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* --- RECEIVING MODULE MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-fade-in p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-600" />
                Laser Source Inward Registration (Receiving)
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">Close</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4 text-left">
              {/* OCR Nameplate Auto-Extraction */}
              <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-4 rounded-2xl border border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                      <ScanLine className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">AI OCR Nameplate Scanner</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Snap or upload the machine nameplate — AI auto-fills Brand, Model, Serial & Power.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Upload from gallery */}
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleOcrUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        id="ocrFileInput"
                      />
                      <button
                        type="button"
                        disabled={ocrLoading}
                        className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Image
                      </button>
                    </div>
                    {/* Live Camera */}
                    <button
                      type="button"
                      onClick={openCamera}
                      disabled={ocrLoading}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-cyan-500/30 disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" />
                      OCR Camera
                    </button>
                    {/* Scan specs QR */}
                    <button
                      type="button"
                      onClick={() => setShowQrScanner(true)}
                      disabled={ocrLoading}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-50"
                    >
                      <ScanLine className="h-4 w-4" />
                      Scan Specs QR
                    </button>
                  </div>
                </div>

                {/* OCR Loading state */}
                {ocrLoading && (
                  <div className="mt-4 flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-cyan-300">AI Scanning Nameplate...</p>
                      <p className="text-[10px] text-slate-400">Analyzing image with OCR — this takes a few seconds</p>
                    </div>
                    {ocrPreviewImg && (
                      <img src={ocrPreviewImg} alt="Scanning" className="h-12 w-20 object-cover rounded-lg ml-auto border border-white/20 opacity-60" />
                    )}
                  </div>
                )}

                {/* OCR Result Card */}
                {!ocrLoading && ocrResult && (
                  <div className="mt-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">OCR Scan Result</span>
                      </div>
                      <button type="button" onClick={() => { setOcrResult(null); setOcrPreviewImg(null); }} className="text-slate-400 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-4">
                      {ocrPreviewImg && (
                        <img src={ocrPreviewImg} alt="Nameplate" className="h-20 w-28 object-cover rounded-lg border border-white/20 shrink-0" />
                      )}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] flex-1">
                        {[
                          { label: 'Brand', val: ocrResult.brand },
                          { label: 'Model', val: ocrResult.modelNumber },
                          { label: 'Serial No.', val: ocrResult.serialNumber },
                          { label: 'Power Rating', val: ocrResult.powerRating },
                          { label: 'Mfg. Year', val: ocrResult.mfgYear },
                        ].map(({ label, val }) => (
                          <div key={label}>
                            <span className="text-slate-400 uppercase text-[9px] font-bold tracking-wider">{label}</span>
                            <p className="text-white font-bold mt-0.5 truncate">{val || '—'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setOcrResult(null); setOcrPreviewImg(null); }}
                        className="text-xs text-slate-400 hover:text-white font-bold px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={applyOcrResult}
                        className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Apply to Form
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 1. Customer Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">1. Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company Name *</label>
                    <input
                      type="text" required
                      value={formData.companyName}
                      onChange={handleCompanyNameChange}
                      onBlur={() => setTimeout(() => setShowZohoDropdown(false), 200)}
                      onFocus={() => setShowZohoDropdown(true)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Laser Cutting Ltd"
                    />
                    {showZohoDropdown && zohoResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {zohoResults.map((zc: any, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectZohoCustomer(zc)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex flex-col focus:outline-none cursor-pointer"
                          >
                            <span className="text-[11px] font-bold text-slate-900">{zc.companyName}</span>
                            <span className="text-[9px] text-slate-500 mt-0.5">{zc.customerName} | {zc.mobileNumber || zc.email || 'No contact details'}</span>
                            {zc.gstNumber && <span className="text-[9px] font-bold text-blue-600 tracking-wider mt-0.5">GST: {zc.gstNumber}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Contact Name *</label>
                    <input
                      type="text" required
                      value={formData.customerName}
                      onChange={e => setFormData({...formData, customerName: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mobile Number *</label>
                    <input
                      type="tel" required
                      value={formData.mobileNumber}
                      onChange={e => setFormData({...formData, mobileNumber: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="+919999999999"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="john@lasercut.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">GST Number</label>
                    <input
                      type="text"
                      value={formData.gstNumber}
                      onChange={e => setFormData({...formData, gstNumber: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="07AAAAA1111A1Z1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Billing Address *</label>
                    <textarea
                      required rows={2}
                      value={formData.billingAddress}
                      onChange={e => setFormData({...formData, billingAddress: e.target.value, address: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Billing Address"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shipping Address *</label>
                    <textarea
                      required rows={2}
                      value={formData.shippingAddress}
                      onChange={e => setFormData({...formData, shippingAddress: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Shipping Address"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Billing State (Region)</label>
                    <input
                      type="text"
                      value={formData.billingState}
                      onChange={e => setFormData({...formData, billingState: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Maharashtra"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shipping State (Region)</label>
                    <input
                      type="text"
                      value={formData.shippingState}
                      onChange={e => setFormData({...formData, shippingState: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Maharashtra"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Laser Registration */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">2. Laser Source Technical Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Brand *</label>
                    <select
                      value={formData.brand}
                      onChange={e => setFormData({...formData, brand: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="IPG">IPG Photonics</option>
                      <option value="Raycus">Raycus</option>
                      <option value="Maxphotonics">Maxphotonics</option>
                      <option value="JPT">JPT</option>
                      <option value="nLIGHT">nLIGHT</option>
                      <option value="BWT">BWT</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Model Number *</label>
                    <input
                      type="text" required
                      value={formData.modelNumber}
                      onChange={e => setFormData({...formData, modelNumber: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="RFL-C3000S"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Serial Number *</label>
                    <input
                      type="text" required
                      value={formData.serialNumber}
                      onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="R3000S11234"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Power Rating *</label>
                    <input
                      type="text" required
                      value={formData.powerRating}
                      onChange={e => setFormData({...formData, powerRating: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="3kW"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Manufacturing Year</label>
                    <input
                      type="number"
                      value={formData.mfgYear}
                      onChange={e => setFormData({...formData, mfgYear: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Machine Manufacturer</label>
                    <input
                      type="text"
                      value={formData.machineManufacturer}
                      onChange={e => setFormData({...formData, machineManufacturer: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Han's Laser"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source Type</label>
                    <input
                      type="text"
                      value={formData.sourceType}
                      onChange={e => setFormData({...formData, sourceType: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Single Module / Multi Module"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Reception & Issues */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">3. Inward Condition & Complaint</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Complaint Category *</label>
                    <select
                      value={formData.complaintCategory}
                      onChange={e => setFormData({...formData, complaintCategory: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="No Laser Output">No Laser Output</option>
                      <option value="Low Output Power">Low Output Power</option>
                      <option value="QBH Damage">QBH Damage</option>
                      <option value="Fiber Break">Fiber Break</option>
                      <option value="Alarm Error">Alarm Error</option>
                      <option value="Module Failure">Module Failure</option>
                      <option value="Cooling Issue">Cooling Issue</option>
                      <option value="Water Leakage">Water Leakage</option>
                      <option value="Communication Failure">Communication Failure</option>
                      <option value="Beam Quality Issue">Beam Quality Issue</option>
                      <option value="Optical Failure">Optical Failure</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Complaint Description *</label>
                    <input
                      type="text" required
                      value={formData.complaintDescription}
                      onChange={e => setFormData({...formData, complaintDescription: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Laser output drops drastically during high frequency cutting..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Receiving / Physical State Notes</label>
                  <textarea
                    rows={2}
                    value={formData.receivingNotes}
                    onChange={e => setFormData({...formData, receivingNotes: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="E.g., QBH protection cap missing, physical scratches on cabinet, water ports sealed..."
                  ></textarea>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Upload Source Photos / Delivery Challan</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={e => setPhotos(e.target.files)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-blue-600/10"
                >
                  Confirm & Inward Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── CAMERA CAPTURE MODAL ─────────────────────────────────────────── */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          {/* Header */}
          <div className="flex items-center justify-between w-full max-w-2xl mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                <Camera className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Machine Nameplate Scanner</h3>
                <p className="text-[10px] text-slate-400">Point camera at the nameplate label and tap Capture</p>
              </div>
            </div>
            <button onClick={closeCamera} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Camera View */}
          <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden border-2 border-cyan-500/40 shadow-2xl shadow-cyan-500/10 bg-black">
            {/* Scanning overlay frame */}
            {!capturedImage && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                {/* Corner guides */}
                <div className="absolute top-6 left-6 w-12 h-12 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                <div className="absolute top-6 right-6 w-12 h-12 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                <div className="absolute bottom-6 left-6 w-12 h-12 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                <div className="absolute bottom-6 right-6 w-12 h-12 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                {/* Scanning line animation */}
                <div className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80"
                  style={{ animation: 'scanLine 2.5s ease-in-out infinite', top: '50%' }}
                />
              </div>
            )}
            {/* Live video feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full max-h-96 object-cover ${capturedImage ? 'hidden' : 'block'}`}
            />
            {/* Captured still */}
            {capturedImage && (
              <img src={capturedImage} alt="Captured" className="w-full max-h-96 object-contain" />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-6">
            {!capturedImage ? (
              <>
                <button
                  onClick={closeCamera}
                  className="text-sm text-slate-400 hover:text-white font-bold px-6 py-3 rounded-2xl border border-white/10 hover:border-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={captureFrame}
                  className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-extrabold text-sm px-8 py-3 rounded-2xl shadow-xl shadow-cyan-500/30 transition-all hover:scale-105"
                >
                  <Camera className="h-5 w-5" />
                  Capture Photo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={retakePhoto}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white font-bold px-6 py-3 rounded-2xl border border-white/10 hover:border-white/20 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </button>
                <button
                  onClick={scanCapturedPhoto}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-sm px-8 py-3 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all hover:scale-105"
                >
                  <ScanLine className="h-5 w-5" />
                  Scan with AI OCR
                </button>
              </>
            )}
          </div>

          <p className="mt-4 text-[10px] text-slate-500 text-center max-w-xs">
            Ensure the nameplate is well-lit and clearly visible. On mobile, the back camera will be used automatically.
          </p>
        </div>
      )}

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Scan line keyframe style */}
      <style>{`@keyframes scanLine { 0%,100%{top:20%} 50%{top:80%} }`}</style>

      {/* QR Code Scanner Portal */}
      {showQrScanner && createPortal(
        <QRScannerModal 
          onClose={() => setShowQrScanner(false)} 
          onScanSuccess={handleInwardQrSuccess} 
        />, 
        document.body
      )}
    </div>
  );
};

export default JobsList;
