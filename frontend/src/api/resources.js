import api from './axios';

// ── Courses ───────────────────────────────────────────────────────────────────
export const coursesApi = {
  list: (params) => api.get('/courses', { params }),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id) => api.delete(`/courses/${id}`),
};

// ── Exams ─────────────────────────────────────────────────────────────────────
export const examsApi = {
  list: (params) => api.get('/exams', { params }),
  get: (id) => api.get(`/exams/${id}`),
  create: (formData) => api.post('/exams', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/exams/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/exams/${id}`),
};

// ── Students ──────────────────────────────────────────────────────────────────
export const studentsApi = {
  list: (params) => api.get('/students', { params }),
  create: (data) => api.post('/students', data),
  bulkCreate: (students) => api.post('/students', students),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
};

// ── Scripts ───────────────────────────────────────────────────────────────────
export const scriptsApi = {
  list: (params) => api.get('/scripts', { params }),
  get: (id) => api.get(`/scripts/${id}`),
  upload: (formData, onProgress) =>
    api.post('/scripts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }),
  delete: (id) => api.delete(`/scripts/${id}`),
};

// ── Evaluations ───────────────────────────────────────────────────────────────
export const evaluationsApi = {
  list: (params) => api.get('/evaluations', { params }),
  get: (id) => api.get(`/evaluations/${id}`),
  summary: (examId) => api.get('/evaluations/summary', { params: { examId } }),
  run: (scriptId) => api.post(`/evaluations/run/${scriptId}`),
  runBatch: (scriptIds) => api.post('/evaluations/run-batch', { scriptIds }),
  retry: (id) => api.post(`/evaluations/${id}/retry`),
  review: (id, data) => api.patch(`/evaluations/${id}/review`, data),
};

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params) => api.get('/audit', { params }),
};
