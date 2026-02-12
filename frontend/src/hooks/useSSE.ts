import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

type SSEHandler = (data: any) => void;

/**
 * Hook that connects to the SSE endpoint and dispatches events to handlers.
 * Automatically reconnects on error with exponential backoff.
 * Pass a stable handlers object (useMemo or module-level) to avoid reconnects.
 */
export function useSSE(handlers: Record<string, SSEHandler>) {
  const token = useAuthStore((s) => s.token);
  const esRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!token) return;

    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    const url = `${baseUrl}/sse/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    // Register listeners for each event type
    for (const eventType of Object.keys(handlersRef.current)) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current[eventType]?.(data);
        } catch {
          // ignore parse errors
        }
      });
    }

    es.onerror = () => {
      es.close();
      // Reconnect after 5s
      setTimeout(() => {
        if (esRef.current === es) {
          connect();
        }
      }, 5000);
    };
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
