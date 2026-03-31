import { useEffect } from 'react';
import api from '../api/axios';

export default function PDFPreviewModal({ isOpen, onClose, filePath, scriptId }) {
  useEffect(() => {
    if (!isOpen) return;

    if (scriptId) {
      api.get(`/scripts/${scriptId}/preview-url`)
        .then((res) => {
          window.open(res.data.data.url, '_blank');
          onClose();
        })
        .catch(() => {
          if (filePath) window.open(filePath, '_blank');
          onClose();
        });
    } else if (filePath) {
      window.open(filePath, '_blank');
      onClose();
    }
  }, [isOpen]);

  return null;
}