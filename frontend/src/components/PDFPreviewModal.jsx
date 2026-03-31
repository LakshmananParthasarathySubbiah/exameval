import { useState, useEffect } from 'react';
import Modal from './Modal';
import { ExternalLink, Loader2 } from 'lucide-react';
import api from '../api/axios';

export default function PDFPreviewModal({ isOpen, onClose, filePath, scriptId, title = 'PDF Preview' }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewUrl(null);

    if (scriptId) {
      setLoading(true);
      api.get(`/scripts/${scriptId}/preview-url`)
        .then((res) => {
          setPreviewUrl(res.data.data.url);
        })
        .catch(() => {
          setPreviewUrl(filePath);
        })
        .finally(() => setLoading(false));
    } else {
      setPreviewUrl(filePath);
    }
  }, [isOpen, scriptId, filePath]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="flex flex-col gap-3">
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-secondary self-start text-xs">
            <ExternalLink className="w-3.5 h-3.5" />
            Open in new tab
          </a>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full rounded-lg border border-surface-200 dark:border-surface-700"
            style={{ height: '70vh' }}
            title="PDF Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-600">
            No file available
          </div>
        )}
      </div>
    </Modal>
  );
}