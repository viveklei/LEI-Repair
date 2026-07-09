import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

interface QRScannerModalProps {
  onClose: () => void;
  onScanSuccess?: (text: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose, onScanSuccess }) => {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Use a randomized unique element ID to prevent collisions when scanner components re-mount
  const [scannerId] = useState(() => `qr-reader-container-${Math.random().toString(36).substring(2, 9)}`);

  const handleQRDetected = async (raw: string) => {
    // Stop scanner first to avoid duplicate fires
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }

    // If a custom callback is provided, route it there (for form auto-filling)
    if (onScanSuccess) {
      onScanSuccess(raw);
      onClose();
      return;
    }

    // Default: Check for inward sticker and redirect
    const match = raw.match(/([A-Z]+-\d{4}-\d+)/i);
    if (!match) {
      toast.error('Invalid QR', 'No valid Track ID found.');
      onClose();
      return;
    }
    const trackId = match[0].toUpperCase();
    toast.success('Detected!', `Looking up ${trackId}...`);
    try {
      const res = await api.get(`/jobs/track/${trackId}`);
      if (res.data.jobId) {
        navigate(`/jobs/${res.data.jobId}`);
      } else {
        toast.error('Not Found', `No ticket for ${trackId}`);
      }
    } catch (err: any) {
      toast.error('Error', err.response?.data?.message || 'Lookup failed');
    } finally {
      onClose();
    }
  };

  useEffect(() => {
    let activeScanner: Html5Qrcode | null = null;
    
    // Tiny delay to ensure React commits the div to the DOM
    const timer = setTimeout(() => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;
        activeScanner = html5QrCode;

        html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.65;
              return { width: size, height: size };
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleQRDetected(decodedText);
          },
          () => {
            // Verbose errors suppressed to prevent spam
          }
        ).catch((err) => {
          console.error('Html5Qrcode initialization failed:', err);
          setErrorMsg('Camera access denied or device has no camera. Please allow camera permission.');
        });
      } catch (e) {
        console.error('Html5Qrcode instance creation failed:', e);
        setErrorMsg('Scanner could not be initialized.');
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (activeScanner && activeScanner.isScanning) {
        activeScanner.stop().catch(err => console.error('Failed to clean up scanner:', err));
      }
    };
  }, [scannerId]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.85)'
    }}>
      <div style={{
        width: '90%', maxWidth: 360, backgroundColor: '#fff',
        borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Camera size={15} style={{ color: '#22d3ee' }} /> Scan QR Code
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>

        {/* Scanner frame container */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {errorMsg ? (
            <div style={{ padding: 16, backgroundColor: '#fff1f2', borderRadius: 14, textAlign: 'center', color: '#be123c', fontSize: 12, fontWeight: 600 }}>
              <AlertTriangle size={28} style={{ margin: '0 auto 8px' }} />
              <p>{errorMsg}</p>
            </div>
          ) : (
            <>
              {/* html5-qrcode targets this element directly */}
              <div 
                id={scannerId} 
                style={{ width: '100%', height: '260px', backgroundColor: '#000', borderRadius: 14, overflow: 'hidden' }}
              />
              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                Align QR Code within the frame
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '4px 18px 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
