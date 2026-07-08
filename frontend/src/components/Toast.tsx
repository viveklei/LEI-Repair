import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import type { ToastType } from '../context/ToastContext';

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
  error: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
};

const STYLES: Record<ToastType, string> = {
  success: 'border-l-4 border-emerald-500 bg-white/95',
  error: 'border-l-4 border-rose-500 bg-white/95',
  warning: 'border-l-4 border-amber-500 bg-white/95',
  info: 'border-l-4 border-blue-500 bg-white/95',
};

const BAR_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

interface ToastItemProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ id, type, title, message, duration = 4000, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 10);

    // Progress bar countdown
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);

    return () => {
      clearTimeout(showTimer);
      clearInterval(interval);
    };
  }, [duration]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl shadow-xl backdrop-blur-md pointer-events-auto transition-all duration-300 ${STYLES[type]} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
      style={{ minWidth: '280px', maxWidth: '380px' }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {ICONS[type]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-tight">{title}</p>
          {message && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{message}</p>}
        </div>
        <button
          onClick={() => onDismiss(id)}
          className="text-slate-400 hover:text-slate-600 transition-colors ml-1 cursor-pointer shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
        <div
          className={`h-full transition-none ${BAR_COLORS[type]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToast();

  return createPortal(
    <div
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
