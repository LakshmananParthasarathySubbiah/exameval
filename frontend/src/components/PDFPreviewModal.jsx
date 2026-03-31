import Modal from './Modal';
import { ExternalLink } from 'lucide-react';

export default function PDFPreviewModal({ isOpen, onClose, filePath, title = 'PDF Preview' }) {
  const src = filePath?.startsWith('http')
    ? filePath
    : filePath
      ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}/uploads/${filePath.split('/uploads/')[1]}`
      : null;

  // Use Google Docs viewer to embed PDFs (bypasses Cloudinary iframe restrictions)
  const embedSrc = src
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(src)}&embedded=true`
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="flex flex-col gap-3">
        {src && (
          <a href={src} target="_blank" rel="noreferrer" className="btn-secondary self-start text-xs">
            <ExternalLink className="w-3.5 h-3.5" />
            Open in new tab
          </a>
        )}
        {embedSrc ? (
          <iframe
            src={embedSrc}
            className="w-full rounded-lg border border-surface-200 dark:border-surface-700"
            style={{ height: '70vh' }}
            title="PDF Preview"
            allow="autoplay"
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