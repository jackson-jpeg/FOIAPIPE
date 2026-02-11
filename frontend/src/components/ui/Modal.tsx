import { type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'center' | 'slide-over';
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  variant = 'center',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSlideOver = variant === 'slide-over';

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 animate-fade-in',
        isSlideOver ? 'flex items-stretch justify-end' : 'flex items-center justify-center p-4'
      )}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={cn(
          'relative bg-surface-secondary border border-surface-border shadow-overlay',
          isSlideOver
            ? 'h-full w-full max-w-2xl animate-slide-in-right rounded-none'
            : cn('w-full rounded-2xl animate-scale-in', sizeStyles[size])
        )}
      >
        <div className="flex items-center justify-between border-b border-surface-border/50 px-6 py-5">
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn(isSlideOver ? 'h-[calc(100%-5rem)] overflow-y-auto p-6' : 'p-6')}>
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-surface-border/50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
