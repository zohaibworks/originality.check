import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastNotificationBannerProps {
  notification: {
    message: string;
    type: 'success' | 'error' | 'info';
  };
  onDismiss: () => void;
  durationSeconds?: number;
}

export const ToastNotificationBanner: React.FC<ToastNotificationBannerProps> = ({
  notification,
  onDismiss,
  durationSeconds = 5,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Automatically diminish after specified duration (5s default)
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss();
      }, 300);
    }, durationSeconds * 1000);

    return () => clearTimeout(timer);
  }, [durationSeconds, onDismiss, notification]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  // Color schemes based on type
  const theme = {
    success: {
      container: 'bg-emerald-950/95 text-emerald-100 border-emerald-700/80 shadow-emerald-950/40',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    },
    error: {
      container: 'bg-rose-950/95 text-rose-100 border-rose-700/80 shadow-rose-950/40',
      icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
    },
    info: {
      container: 'bg-slate-900/95 text-slate-100 border-indigo-700/60 shadow-slate-950/40',
      icon: <Info className="w-4 h-4 text-indigo-400 shrink-0" />,
    },
  }[notification.type];

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border transition-all duration-300 max-w-md ${
        theme.container
      } ${
        isExiting
          ? 'opacity-0 translate-y-[-10px] scale-95'
          : 'animate-in fade-in slide-in-from-top-3 duration-200'
      }`}
      role="alert"
      id="toast-notification-banner"
    >
      {theme.icon}
      <span className="text-xs font-semibold leading-snug flex-1 pr-1">
        {notification.message}
      </span>

      {/* Manual Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition shrink-0"
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
