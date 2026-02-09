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
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 text-accent-red" />,
  },
  info: {
    icon: <Info className="h-4 w-4 text-accent-blue" />,
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-accent-amber" />,
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
    }, 3000); // Auto-dismiss after 3s

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const config = typeConfig[toast.type];

  return (
    <div
      className={cn(
        'flex w-full max-w-md min-w-[20rem] items-start gap-3 rounded-lg bg-text-primary p-4 shadow-overlay transition-all duration-200 ease-out-expo',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-2 opacity-0'
      )}
    >
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-surface-primary">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-xs text-surface-primary/80 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onRemove(toast.id), 200);
        }}
        className="shrink-0 rounded p-0.5 text-surface-primary/60 transition-colors hover:text-surface-primary"
      >
        <X className="h-3.5 w-3.5" />
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-2 px-4 w-full max-w-md">
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
