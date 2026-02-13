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
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[8px]" />
      <div
        className={cn(
          'relative glass-3 shadow-overlay',
          isSlideOver
            ? 'h-full w-full max-w-2xl animate-slide-in-right rounded-none'
            : cn('w-full rounded-xl animate-scale-in', sizeStyles[size])
        )}
      >
        <div className={cn(
          isSlideOver && 'flex flex-col h-full'
        )}>
          <div className="flex items-center justify-between border-b glass-border px-4 py-3 shrink-0">
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={cn(isSlideOver ? 'flex-1 overflow-y-auto p-4' : 'p-4')}>
            {children}
          </div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t glass-border px-4 py-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
