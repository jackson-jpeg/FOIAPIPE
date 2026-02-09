import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 0);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl rounded-xl border border-surface-border bg-surface-primary shadow-2xl">
        <div className="flex items-center gap-3 px-4">
          <Search className="h-5 w-5 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Press Cmd+K to search"
            className="w-full bg-transparent py-4 text-base text-text-primary placeholder-text-tertiary outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-surface-border bg-surface-secondary px-2 py-0.5 text-xs text-text-tertiary">
            ESC
          </kbd>
        </div>
        <div className="border-t border-surface-border px-4 py-3">
          <p className="text-xs text-text-tertiary">
            Type to search across articles, FOIA requests, and videos...
          </p>
        </div>
      </div>
    </div>
  );
}
