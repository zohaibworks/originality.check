import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

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
  const onDismissRef = useRef(onDismiss);
  const pauseTimerRef = useRef<() => void>(() => {});
  const resumeTimerRef = useRef<() => void>(() => {});
  const dismissToastRef = useRef<() => void>(() => {});
  const isHoveredRef = useRef(false);
  const isFocusedRef = useRef(false);

  onDismissRef.current = onDismiss;

  useEffect(() => {
    let remainingMs = durationSeconds * 1000;
    let startedAt = 0;
    let dismissTimer: number | undefined;
    let exitTimer: number | undefined;

    const dismiss = () => {
      if (exitTimer !== undefined) return;
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
      dismissTimer = undefined;
      remainingMs = 0;
      setIsExiting(true);
      exitTimer = window.setTimeout(() => onDismissRef.current(), 220);
    };

    const resumeTimer = () => {
      if (dismissTimer !== undefined || remainingMs <= 0) return;
      startedAt = Date.now();
      dismissTimer = window.setTimeout(dismiss, remainingMs);
    };

    const pauseTimer = () => {
      if (dismissTimer === undefined) return;
      window.clearTimeout(dismissTimer);
      dismissTimer = undefined;
      remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt));
    };

    pauseTimerRef.current = pauseTimer;
    resumeTimerRef.current = resumeTimer;
    dismissToastRef.current = dismiss;
    setIsExiting(false);
    resumeTimer();

    return () => {
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
      pauseTimerRef.current = () => {};
      resumeTimerRef.current = () => {};
      dismissToastRef.current = () => {};
      isHoveredRef.current = false;
      isFocusedRef.current = false;
    };
  }, [durationSeconds, notification.message, notification.type]);

  const theme = {
    success: {
      container: 'bg-emerald-950/95 text-emerald-100 border-emerald-700/80 shadow-emerald-950/40',
      icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />,
      title: 'Success',
      role: 'status' as const,
    },
    error: {
      container: 'bg-rose-950/95 text-rose-100 border-rose-700/80 shadow-rose-950/40',
      icon: <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />,
      title: 'Error',
      role: 'alert' as const,
    },
    info: {
      container: 'bg-slate-900/95 text-slate-100 border-indigo-700/60 shadow-slate-950/40',
      icon: <Info className="h-5 w-5 shrink-0 text-indigo-400" aria-hidden="true" />,
      title: 'Notification',
      role: 'status' as const,
    },
  }[notification.type];

  return (
    <div
      className={`fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-200 sm:left-auto sm:right-4 sm:max-w-md ${
        theme.container
      } ${
        isExiting
          ? 'translate-y-[-8px] scale-[0.98] opacity-0'
          : 'animate-in fade-in slide-in-from-top-3 duration-200'
      } motion-reduce:animate-none motion-reduce:transition-none`}
      role={theme.role}
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      id="toast-notification-banner"
      onMouseEnter={() => {
        isHoveredRef.current = true;
        pauseTimerRef.current();
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        if (!isFocusedRef.current) resumeTimerRef.current();
      }}
      onFocusCapture={() => {
        isFocusedRef.current = true;
        pauseTimerRef.current();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          isFocusedRef.current = false;
          if (!isHoveredRef.current) resumeTimerRef.current();
        }
      }}
    >
      {theme.icon}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">{theme.title}</p>
        <p className="mt-0.5 break-words text-sm leading-snug">{notification.message}</p>
      </div>
      <button
        onClick={() => dismissToastRef.current()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
