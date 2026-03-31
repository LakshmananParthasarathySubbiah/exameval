import { create } from 'zustand';

export const useEvaluationStore = create((set, get) => ({
  liveStatus: {}, // evaluationId -> { status, message, currentQuestion, totalQuestions, percentage }
  sseConnections: {}, // evaluationId -> EventSource

  setStatus: (evaluationId, data) =>
    set((s) => ({
      liveStatus: { ...s.liveStatus, [evaluationId]: { ...s.liveStatus[evaluationId], ...data } },
    })),

  subscribeSSE: (evaluationId, onComplete, onFailed) => {
    const existing = get().sseConnections[evaluationId];
    if (existing) return;

    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    const token = window.__accessToken; // Set by axios interceptor

    // SSE doesn't support custom headers, use query param for token
    const es = new EventSource(`${baseUrl}/evaluations/${evaluationId}/events`, {
      withCredentials: true,
    });

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        get().setStatus(evaluationId, data);

        if (data.status === 'COMPLETED' || data.status === 'PENDING_REVIEW') {
          onComplete?.(data);
          get().unsubscribeSSE(evaluationId);
        } else if (data.status === 'FAILED') {
          onFailed?.(data);
          get().unsubscribeSSE(evaluationId);
        }
      } catch {}
    };

    es.onerror = () => {
      get().unsubscribeSSE(evaluationId);
    };

    set((s) => ({ sseConnections: { ...s.sseConnections, [evaluationId]: es } }));
  },

  unsubscribeSSE: (evaluationId) => {
    const es = get().sseConnections[evaluationId];
    if (es) {
      es.close();
      const connections = { ...get().sseConnections };
      delete connections[evaluationId];
      set({ sseConnections: connections });
    }
  },
}));
