import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Camera, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

interface QRScannerModalProps {
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const handleQRDetected = useCallback(async (raw: string) => {
    stopCamera();
    const match = raw.match(/([A-Z]+-\d{4}-\d+)/i);
    if (!match) {
      toast.error('Invalid QR', 'No valid Track ID found.');
      onClose(); return;
    }
    const trackId = match[0].toUpperCase();
    toast.success('Detected!', `Looking up ${trackId}...`);
    try {
      const res = await api.get(`/jobs/track/${trackId}`);
      if (res.data.jobId) navigate(`/jobs/${res.data.jobId}`);
      else toast.error('Not Found', `No ticket for ${trackId}`);
    } catch (err: any) {
      toast.error('Error', err.response?.data?.message || 'Lookup failed');
    } finally {
      onClose();
    }
  }, [stopCamera, toast, navigate, onClose]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    }).then(stream => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      const BD = (window as any).BarcodeDetector;
      if (BD) {
        const detector = new BD({ formats: ['qr_code'] });
        intervalRef.current = window.setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) handleQRDetected(codes[0].rawValue);
          } catch (_) {}
        }, 400);
      }
    }).catch(() => {
      setErrorMsg('Camera access denied. Please allow camera permission.');
    });
    return () => stopCamera();
  }, []);

  // ✅ Render via Portal directly on document.body
  // This escapes ALL parent transforms, overflow:hidden, z-index stacking contexts
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 2147483647, // Maximum possible z-index
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.82)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '360px',
        backgroundColor: '#fff',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            <Camera size={15} style={{ color: '#22d3ee' }} />
            Scan Inward Sticker QR
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Camera / Error */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
          {errorMsg ? (
            <div style={{ padding: 16, backgroundColor: '#fff1f2', borderRadius: 14, textAlign: 'center' as const, color: '#be123c', fontSize: 12, fontWeight: 600 }}>
              <AlertTriangle size={28} style={{ margin: '0 auto 8px' }} />
              <p>{errorMsg}</p>
            </div>
          ) : (
            <>
              <div style={{ width: '100%', height: 260, backgroundColor: '#000', borderRadius: 14, overflow: 'hidden', position: 'relative' as const }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: 170, height: 170, border: '2.5px solid #22d3ee', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
                </div>
              </div>
              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: 0 }}>
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
    </div>,
    document.body  // ← Renders outside all parent containers
  );
};
