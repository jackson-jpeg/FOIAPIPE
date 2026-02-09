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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-lg rounded-xl border border-surface-border bg-surface-secondary shadow-overlay animate-scale-in">
        <div className="flex items-center gap-3 px-4">
          <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            className="w-full bg-transparent py-3 text-sm text-text-primary placeholder:text-text-quaternary outline-none"
          />
          <kbd className="shrink-0 rounded border border-surface-border bg-surface-tertiary px-1.5 py-0.5 text-2xs text-text-quaternary font-mono">
            ESC
          </kbd>
        </div>
        <div className="border-t border-surface-border px-4 py-2">
          <p className="text-2xs text-text-quaternary">
            Search articles, FOIA requests, and videos
          </p>
        </div>
      </div>
    </div>
  );
}
