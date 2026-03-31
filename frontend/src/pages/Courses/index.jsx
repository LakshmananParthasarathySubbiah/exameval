import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { coursesApi } from '../../api/resources';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useUIStore } from '../../store/uiStore';
import { useDebounce, usePagination } from '../../hooks';
import { formatDate, extractError } from '../../utils';

function CourseForm({ initial, onSubmit, loading }) {
  const [form, setForm] = useState(initial || { name: '', code: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="flex flex-col gap-4"
    >
      <div>
        <label className="label">Course Name</label>
        <input className="input" value={form.name} onChange={set('name')} placeholder="Database Management Systems" required />
      </div>
      <div>
        <label className="label">Course Code</label>
        <input className="input" value={form.code} onChange={set('code')} placeholder="BCSE302L" required />
      </div>
      <button type="submit" disabled={loading} className="btn-primary self-end">
        {loading ? 'Saving…' : initial ? 'Update Course' : 'Create Course'}
      </button>
    </form>
  );
}

export default function CoursesPage() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 300);
  const { page, limit, goToPage, reset } = usePagination(20);
  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', data? }
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['courses', page, dSearch],
    queryFn: () => coursesApi.list({ page, limit, search: dSearch }).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (d) => coursesApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['courses']); setModal(null); addToast('Course created', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }) => coursesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries(['courses']); setModal(null); addToast('Course updated', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id) => coursesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['courses']); addToast('Course deleted', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const columns = [
    { key: 'name', label: 'Course Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true, render: (v) => <span className="font-mono text-xs bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded">{v}</span> },
    { key: '_count', label: 'Exams', render: (v) => <span className="text-slate-500">{v?.exams ?? 0}</span> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v) => formatDate(v) },
    {
      key: 'actions', label: '', render: (_, row) => (
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
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Courses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage academic courses</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Course
        </button>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset(); }}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={goToPage}
          emptyMessage="No courses yet. Create your first course."
        />
      </div>

      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Course' : 'New Course'}
        size="sm"
      >
        <CourseForm
          initial={modal?.mode === 'edit' ? modal.data : null}
          loading={create.isPending || update.isPending}
          onSubmit={(form) => {
            if (modal?.mode === 'edit') update.mutate({ id: modal.data.id, ...form });
            else create.mutate(form);
          }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        title="Delete Course"
        message={`Delete "${deleteTarget?.name}"? All associated exams will also be deleted.`}
      />
    </div>
  );
}
