import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

const typeConfig = {
  success: {
    icon: <CheckCircle className="h-4 w-4 text-accent-green" />,
    accent: 'border-l-accent-green',
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 text-accent-red" />,
    accent: 'border-l-accent-red',
  },
  info: {
    icon: <Info className="h-4 w-4 text-accent-blue" />,
    accent: 'border-l-accent-blue',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-accent-amber" />,
    accent: 'border-l-accent-amber',
  },
};

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(toast.id), 200);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const config = typeConfig[toast.type];

  return (
    <div
      className={cn(
        'flex w-72 items-start gap-2.5 rounded-lg border border-l-2 border-surface-border bg-surface-secondary p-3 shadow-elevated transition-all duration-200 ease-out-expo',
        config.accent,
        isVisible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-8 opacity-0'
      )}
    >
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-2xs text-text-secondary leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onRemove(toast.id), 200);
        }}
        className="shrink-0 rounded p-0.5 text-text-quaternary transition-colors hover:text-text-tertiary"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
