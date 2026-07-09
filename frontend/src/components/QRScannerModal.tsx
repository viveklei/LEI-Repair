import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

interface QRScannerModalProps {
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const scannerId = 'qr-reader-container';

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5Qrcode = new Html5Qrcode(scannerId);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 }
          },
          async (decodedText) => {
            console.log('QR Code scanned:', decodedText);
            stopScanner();

            // Match FRND-2026-0006 or any PREFIX-YEAR-NUMBER format
            let trackId = '';
            const match = decodedText.match(/([A-Z]+-\d{4}-\d+)/i);
            if (match) {
              trackId = match[0].toUpperCase();
            } else {
              toast.error('Invalid QR Code', 'This code does not contain a valid Track ID.');
              onClose();
              return;
            }

            try {
              toast.success('Sticker Detected', `Scanning details for ${trackId}...`);
              const res = await api.get(`/jobs/track/${trackId}`);
              if (res.data.jobId) {
                navigate(`/jobs/${res.data.jobId}`);
              } else {
                toast.error('Ticket Not Found', `No active ticket matched ${trackId}`);
              }
            } catch (err: any) {
              toast.error('Lookup Failed', err.response?.data?.message || 'Could not fetch job info.');
            } finally {
              onClose();
            }
          },
          () => {
            // Suppress verbose per-frame error logs
          }
        );
      } catch (err: any) {
        console.error('Camera Scanner start failed:', err);
        setErrorMsg('Unable to access camera. Please check your browser permissions and try again.');
      }
    };

    startScanner();
    return () => { stopScanner(); };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try { await scannerRef.current.stop(); } catch (e) {}
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    >
      {/* Modal card — constrained so it never overflows screen */}
      <div
        className="bg-white rounded-3xl w-full shadow-2xl border border-slate-100 animate-scale-in text-left flex flex-col"
        style={{ maxWidth: '360px', maxHeight: '90vh', margin: '0 16px' }}
      >
        {/* Header */}
        <div className="bg-slate-950 text-white px-5 py-4 flex justify-between items-center rounded-t-3xl shrink-0">
          <h3 className="font-extrabold text-xs tracking-wider uppercase flex items-center gap-2">
            <Camera className="h-4 w-4 text-cyan-400 animate-pulse" />
            Scan Inward Sticker QR
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner area */}
        <div className="p-5 flex flex-col items-center flex-1 overflow-hidden">
          {errorMsg ? (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col items-center text-center text-xs text-rose-700 font-semibold gap-2">
              <AlertTriangle className="h-8 w-8 text-rose-600 animate-bounce" />
              <p>{errorMsg}</p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* The library injects video here — give it a fixed square size */}
              <div
                id={scannerId}
                className="w-full bg-black rounded-2xl overflow-hidden"
                style={{ height: '280px' }}
              />
              <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-wider">
                Align QR Code within the scanning frame
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex justify-end rounded-b-3xl shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
