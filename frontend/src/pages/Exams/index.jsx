import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { examsApi, coursesApi } from '../../api/resources';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FileUploader from '../../components/FileUploader';
import { useUIStore } from '../../store/uiStore';
import { usePagination } from '../../hooks';
import { formatDate, extractError } from '../../utils';

function ExamForm({ onSubmit, loading, courses }) {
  const [form, setForm] = useState({ title: '', date: '', courseId: '' });
  const [file, setFile] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('rubricFile', file);
    onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Exam Title</label>
        <input className="input" value={form.title} onChange={set('title')} placeholder="Mid-Term Examination" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className="label">Course</label>
          <select className="input" value={form.courseId} onChange={set('courseId')} required>
            <option value="">Select course…</option>
            {courses?.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Rubric PDF <span className="text-slate-400 font-normal">(optional)</span></label>
        <FileUploader accept=".pdf" onFiles={(files) => setFile(files[0] || null)} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary self-end">
        {loading ? 'Creating…' : 'Create Exam'}
      </button>
    </form>
  );
}

function RubricAccordion({ rubricParsed }) {
  const [open, setOpen] = useState(null);
  if (!rubricParsed || !rubricParsed.length) return <p className="text-sm text-slate-400">No rubric parsed yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      {rubricParsed.map((q, i) => (
        <div key={i} className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded font-semibold">
                {q.questionNumber}
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">{q.questionText}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500">{q.maxMarks} marks</span>
              {open === i ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </div>
          </button>
          {open === i && (
            <div className="px-4 pb-4 border-t border-surface-200 dark:border-surface-700 pt-3 space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">{q.gradingCriteria}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {q.keyPoints?.map((kp, ki) => (
                  <span key={ki} className="text-xs bg-surface-100 dark:bg-surface-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                    {kp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ExamsPage() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();
  const [courseFilter, setCourseFilter] = useState('');
  const { page, limit, goToPage } = usePagination(20);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rubricExam, setRubricExam] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['exams', page, courseFilter],
    queryFn: () => examsApi.list({ page, limit, ...(courseFilter && { courseId: courseFilter }) }).then((r) => r.data),
  });

  const { data: coursesData } = useQuery({
    queryKey: ['courses-all'],
    queryFn: () => coursesApi.list({ limit: 100 }).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (fd) => examsApi.create(fd),
    onSuccess: () => { qc.invalidateQueries(['exams']); setShowCreate(false); addToast('Exam created', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id) => examsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['exams']); addToast('Exam deleted', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const columns = [
    { key: 'title', label: 'Exam Title', sortable: true },
    { key: 'course', label: 'Course', render: (v) => <span className="font-mono text-xs">{v?.code}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (v) => formatDate(v) },
    {
      key: 'rubricParsed', label: 'Rubric',
      render: (v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setRubricExam(row); }}
          className={`badge cursor-pointer ${v ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 hover:bg-slate-200'}`}
        >
          <FileText className="w-3 h-3" />
          {v ? `${v.length} questions` : 'No rubric'}
        </button>
      ),
    },
    { key: '_count', label: 'Students', render: (v) => <span className="text-slate-500">{v?.students ?? 0}</span> },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const courses = coursesData?.data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Exams</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage examinations</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Exam
        </button>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <select className="input max-w-xs" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>

        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={goToPage}
          onRowClick={(row) => navigate(`/scripts?examId=${row.id}`)}
          emptyMessage="No exams found. Create your first exam."
        />
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Exam" size="md">
        <ExamForm courses={courses} loading={create.isPending} onSubmit={(fd) => create.mutate(fd)} />
      </Modal>

      <Modal isOpen={!!rubricExam} onClose={() => setRubricExam(null)} title={`Rubric — ${rubricExam?.title}`} size="lg">
        <RubricAccordion rubricParsed={rubricExam?.rubricParsed} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        title="Delete Exam"
        message={`Delete "${deleteTarget?.title}"? All students, scripts and evaluations will be removed.`}
      />
    </div>
  );
}
