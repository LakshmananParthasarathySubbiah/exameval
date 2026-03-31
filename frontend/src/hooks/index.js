import { useState, useEffect, useCallback, useRef } from 'react';

// ── usePagination ─────────────────────────────────────────────────────────────
export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState(1);
  const [limit] = useState(initialLimit);

  const goToPage = useCallback((p) => setPage(p), []);
  const reset = useCallback(() => setPage(1), []);

  return { page, limit, goToPage, reset };
}

// ── useDebounce ───────────────────────────────────────────────────────────────
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ── useSSE ────────────────────────────────────────────────────────────────────
export function useSSE(evaluationId, { onMessage, onComplete, onFailed, enabled = true } = {}) {
  const [status, setStatus] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    if (!evaluationId || !enabled) return;

    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    const es = new EventSource(`${baseUrl}/evaluations/${evaluationId}/events`, {
      withCredentials: true,
    });

    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(data);
        onMessage?.(data);

        if (data.status === 'COMPLETED' || data.status === 'PENDING_REVIEW') {
          onComplete?.(data);
          es.close();
        } else if (data.status === 'FAILED') {
          onFailed?.(data);
          es.close();
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [evaluationId, enabled]);

  const close = useCallback(() => {
    esRef.current?.close();
  }, []);

  return { status, close };
}

// ── useLocalStorage ───────────────────────────────────────────────────────────
export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });

  const setValue = useCallback((value) => {
    try {
      setStored(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key]);

  return [stored, setValue];
}
