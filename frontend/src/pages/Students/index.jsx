import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { studentsApi, examsApi } from '../../api/resources';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FileUploader from '../../components/FileUploader';
import { useUIStore } from '../../store/uiStore';
import { usePagination } from '../../hooks';
import { formatDate, extractError, parseCSV } from '../../utils';

function StudentForm({ initial, examId, exams, onSubmit, loading }) {
  const [form, setForm] = useState(initial || { name: '', rollNumber: '', email: '', examId: examId || '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="flex flex-col gap-4">
      <div>
        <label className="label">Exam</label>
        <select className="input" value={form.examId} onChange={set('examId')} required>
          <option value="">Select exam…</option>
          {exams?.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Arjun Kumar" required />
        </div>
        <div>
          <label className="label">Roll Number</label>
          <input className="input" value={form.rollNumber} onChange={set('rollNumber')} placeholder="21BCE0001" required />
        </div>
      </div>
      <div>
        <label className="label">Email <span className="text-slate-400 font-normal">(optional)</span></label>
        <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="student@vit.ac.in" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary self-end">
        {loading ? 'Saving…' : initial ? 'Update Student' : 'Add Student'}
      </button>
    </form>
  );
}

export default function StudentsPage() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [examFilter, setExamFilter] = useState('');
  const { page, limit, goToPage } = usePagination(20);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [csvStudents, setCsvStudents] = useState([]);
  const [bulkExamId, setBulkExamId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, examFilter],
    queryFn: () => studentsApi.list({ page, limit, ...(examFilter && { examId: examFilter }) }).then((r) => r.data),
  });

  const { data: examsData } = useQuery({
    queryKey: ['exams-all'],
    queryFn: () => examsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (d) => studentsApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['students']); setModal(null); addToast('Student added', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const bulkCreate = useMutation({
    mutationFn: (students) => studentsApi.bulkCreate(students),
    onSuccess: (res) => {
      qc.invalidateQueries(['students']);
      setShowBulk(false);
      const { created, errors } = res.data.data;
      addToast(`${created.length} students added${errors.length ? `, ${errors.length} failed` : ''}`, created.length ? 'success' : 'error');
    },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }) => studentsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries(['students']); setModal(null); addToast('Student updated', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id) => studentsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['students']); addToast('Student removed', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const handleCSV = (files) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      setCsvStudents(parsed);
    };
    reader.readAsText(file);
  };

  const exams = examsData?.data || [];

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'rollNumber', label: 'Roll No', sortable: true, render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'email', label: 'Email' },
    { key: 'exam', label: 'Exam', render: (v) => <span className="text-slate-500 text-xs">{v?.title}</span> },
    { key: 'createdAt', label: 'Added', render: (v) => formatDate(v) },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={(e) => { e.stopPropagation(); setModal({ mode: 'edit', data: row }); }}
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-slate-400 hover:text-brand-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
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
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage enrolled students</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="btn-secondary">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        </div>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <select className="input max-w-xs" value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
          <option value="">All exams</option>
          {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>

        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={goToPage}
          emptyMessage="No students found."
        />
      </div>

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Student' : 'Add Student'} size="sm">
        <StudentForm
          initial={modal?.mode === 'edit' ? modal.data : null}
          examId={examFilter}
          exams={exams}
          loading={create.isPending || update.isPending}
          onSubmit={(form) => modal?.mode === 'edit' ? update.mutate({ id: modal.data.id, ...form }) : create.mutate(form)}
        />
      </Modal>

      <Modal isOpen={showBulk} onClose={() => { setShowBulk(false); setCsvStudents([]); }} title="Bulk Import Students" size="md">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500">CSV must have columns: <span className="font-mono text-xs bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">name, rollnumber, email</span></p>
          <div>
            <label className="label">Exam</label>
            <select className="input" value={bulkExamId} onChange={(e) => setBulkExamId(e.target.value)} required>
              <option value="">Select exam…</option>
              {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
            </select>
          </div>
          <FileUploader accept=".csv" onFiles={handleCSV} label="Drop CSV file here" />
          {csvStudents.length > 0 && (
            <div className="text-sm text-slate-600 dark:text-slate-400 bg-surface-50 dark:bg-surface-900 rounded-lg px-3 py-2">
              {csvStudents.length} students ready to import
            </div>
          )}
          <button
            disabled={!csvStudents.length || !bulkExamId || bulkCreate.isPending}
            className="btn-primary self-end"
            onClick={() => bulkCreate.mutate(csvStudents.map((s) => ({ name: s.name, rollNumber: s.rollnumber || s.rollNumber, email: s.email || null, examId: bulkExamId })))}
          >
            {bulkCreate.isPending ? 'Importing…' : `Import ${csvStudents.length} Students`}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        title="Remove Student"
        message={`Remove ${deleteTarget?.name} (${deleteTarget?.rollNumber}) from the exam?`}
      />
    </div>
  );
}
