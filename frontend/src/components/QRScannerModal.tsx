import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

interface QRScannerModalProps {
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const handleQRDetected = useCallback(async (trackId: string) => {
    setScanning(false);
    stopCamera();
    toast.success('Sticker Detected', `Scanning details for ${trackId}...`);
    try {
      const res = await api.get(`/jobs/track/${trackId}`);
      if (res.data.jobId) {
        navigate(`/jobs/${res.data.jobId}`);
      } else {
        toast.error('Not Found', `No active ticket matched ${trackId}`);
      }
    } catch (err: any) {
      toast.error('Lookup Failed', err.response?.data?.message || 'Could not fetch job info.');
    } finally {
      onClose();
    }
  }, [stopCamera, toast, navigate, onClose]);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Use BarcodeDetector if available (modern browsers)
        const BD = (window as any).BarcodeDetector;
        if (BD) {
          const detector = new BD({ formats: ['qr_code'] });
          intervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || !scanning) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                const raw = codes[0].rawValue as string;
                const match = raw.match(/([A-Z]+-\d{4}-\d+)/i);
                if (match) handleQRDetected(match[0].toUpperCase());
              }
            } catch (_) {}
          }, 300);
        } else {
          // Fallback: canvas-based polling
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          intervalRef.current = window.setInterval(() => {
            const video = videoRef.current;
            if (!video || !ctx || !scanning) return;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
          }, 500);
        }
      } catch (err: any) {
        setErrorMsg('Camera access denied. Please allow camera permission and try again.');
      }
    };

    startCamera();
    return () => stopCamera();
  }, []);

  return (
    // Full-screen dark backdrop
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      {/* Modal card — fixed size, always centered */}
      <div style={{
        backgroundColor: 'white', borderRadius: '24px', width: '100%',
        maxWidth: '360px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <Camera size={16} style={{ color: '#22d3ee' }} />
            Scan Inward Sticker QR
          </div>
          <button onClick={onClose} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Camera / Error area */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          {errorMsg ? (
            <div style={{ padding: '20px', backgroundColor: '#fff1f2', borderRadius: '16px', textAlign: 'center', color: '#be123c', fontSize: '12px', fontWeight: 600 }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 8px' }} />
              <p>{errorMsg}</p>
              <button onClick={onClose} style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: '#0f172a', color: 'white', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Video element — we fully control this, no library injections */}
              <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', position: 'relative' }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
                />
                {/* Scan frame overlay */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '180px', height: '180px', border: '2px solid #22d3ee', borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
                </div>
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
                Align QR Code within the scanning frame
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', backgroundColor: '#0f172a', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
