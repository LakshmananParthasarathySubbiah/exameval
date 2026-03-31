import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Upload, Trash2, Eye, Play, ExternalLink, Loader2 } from 'lucide-react';
import { scriptsApi, studentsApi, examsApi, evaluationsApi } from '../../api/resources';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FileUploader from '../../components/FileUploader';
import StatusBadge from '../../components/StatusBadge';
import PDFPreviewModal from '../../components/PDFPreviewModal';
import { useUIStore } from '../../store/uiStore';
import { usePagination } from '../../hooks';
import { formatDate, extractError } from '../../utils';

export default function ScriptsPage() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [searchParams] = useSearchParams();
  const [examFilter, setExamFilter] = useState(searchParams.get('examId') || '');
  const [studentFilter, setStudentFilter] = useState('');
  const { page, limit, goToPage } = usePagination(20);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewScript, setPreviewScript] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [runningIds, setRunningIds] = useState(new Set());

  // Upload form state
  const [uploadForm, setUploadForm] = useState({ studentId: '', examId: examFilter });
  const [uploadFiles, setUploadFiles] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['scripts', page, examFilter, studentFilter],
    queryFn: () => scriptsApi.list({ page, limit, ...(examFilter && { examId: examFilter }), ...(studentFilter && { studentId: studentFilter }) }).then((r) => r.data),
  });

  const { data: examsData } = useQuery({
    queryKey: ['exams-all'],
    queryFn: () => examsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-for-exam', uploadForm.examId || examFilter],
  queryFn: () => studentsApi.list({ 
    limit: 200, 
    examId: uploadForm.examId || examFilter 
  }).then((r) => r.data),
  enabled: !!(uploadForm.examId || examFilter),
  });

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('studentId', uploadForm.studentId);
      fd.append('examId', uploadForm.examId);
      uploadFiles.forEach((f) => fd.append('files', f));
      return scriptsApi.upload(fd, (p) => setUploadProgress(p));
    },
    onSuccess: () => {
      qc.invalidateQueries(['scripts']);
      setShowUpload(false);
      setUploadFiles([]);
      setUploadProgress(null);
      addToast('Script(s) uploaded successfully', 'success');
    },
    onError: (e) => { setUploadProgress(null); addToast(extractError(e), 'error'); },
  });

  const remove = useMutation({
    mutationFn: (id) => scriptsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['scripts']); addToast('Script deleted', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const runEval = async (scriptId) => {
    setRunningIds((s) => new Set([...s, scriptId]));
    try {
      await evaluationsApi.run(scriptId);
      qc.invalidateQueries(['scripts']);
      addToast('Evaluation started', 'success');
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setRunningIds((s) => { const n = new Set(s); n.delete(scriptId); return n; });
    }
  };

  const exams = examsData?.data || [];
  const students = studentsData?.data || [];

  const columns = [
    { key: 'student', label: 'Student', render: (v) => <div><div className="font-medium text-slate-800 dark:text-slate-200">{v?.name}</div><div className="text-xs font-mono text-slate-400">{v?.rollNumber}</div></div> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'ocrUsed', label: 'OCR', render: (v) => v ? <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">OCR</span> : <span className="text-slate-400 text-xs">—</span> },
    { key: 'evaluations', label: 'Eval', render: (v) => v?.[0] ? <StatusBadge status={v[0].status} /> : <span className="text-slate-400 text-xs">None</span> },
    { key: 'createdAt', label: 'Uploaded', sortable: true, render: (v) => formatDate(v) },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={(e) => { e.stopPropagation(); setPreviewScript(row); }}
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-slate-400 hover:text-brand-600 transition-colors" title="Preview PDF">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); runEval(row.id); }}
            disabled={runningIds.has(row.id)}
            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-40" title="Run Evaluation">
            {runningIds.has(row.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Scripts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload and manage answer scripts</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          <Upload className="w-4 h-4" /> Upload Scripts
        </button>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <div className="flex gap-3 flex-wrap">
          <select className="input max-w-xs" value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
            <option value="">All exams</option>
            {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
          {examFilter && (
            <select className="input max-w-xs" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
              <option value="">All students</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.rollNumber})</option>)}
            </select>
          )}
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={goToPage}
          emptyMessage="No scripts uploaded yet."
        />
      </div>

      <Modal isOpen={showUpload} onClose={() => { setShowUpload(false); setUploadFiles([]); setUploadProgress(null); }} title="Upload Answer Script(s)" size="md">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Exam</label>
              <select className="input" value={uploadForm.examId} onChange={(e) => setUploadForm((f) => ({ ...f, examId: e.target.value, studentId: '' }))}>
                <option value="">Select exam…</option>
                {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Student</label>
              <select className="input" value={uploadForm.studentId} onChange={(e) => setUploadForm((f) => ({ ...f, studentId: e.target.value }))}>
                <option value="">Select student…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.rollNumber})</option>)}
              </select>
            </div>
          </div>
          <FileUploader
            accept=".pdf"
            multiple
            onFiles={setUploadFiles}
            label="Drop PDF answer scripts here"
            progress={uploadProgress}
          />
          <button
            disabled={!uploadForm.examId || !uploadForm.studentId || !uploadFiles.length || upload.isPending}
            className="btn-primary self-end"
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : `Upload ${uploadFiles.length} File(s)`}
          </button>
        </div>
      </Modal>

      <PDFPreviewModal
        isOpen={!!previewScript}
  	onClose={() => setPreviewScript(null)}
 	filePath={previewScript?.filePath}
  	scriptId={previewScript?.id}
  	title={`Script — ${previewScript?.student?.name}`}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        title="Delete Script"
        message={`Delete the script for ${deleteTarget?.student?.name}? This cannot be undone.`}
      />
    </div>
  );
}
