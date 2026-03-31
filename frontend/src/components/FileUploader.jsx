import { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, X, CheckCircle } from 'lucide-react';

export default function FileUploader({
  accept = '.pdf',
  multiple = false,
  onFiles,
  label = 'Drop files here or click to browse',
  progress = null,       // 0-100 or null
  maxFiles = 50,
}) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState([]);
  const inputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    const files = Array.from(fileList).slice(0, maxFiles);
    setSelected(files);
    onFiles?.(files);
  }, [onFiles, maxFiles]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (i) => {
    const next = selected.filter((_, idx) => idx !== i);
    setSelected(next);
    onFiles?.(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20'
            : 'border-surface-300 dark:border-surface-700 hover:border-brand-400 hover:bg-surface-50 dark:hover:bg-surface-900'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-brand-500' : 'text-slate-300 dark:text-slate-600'}`} />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">{accept.toUpperCase()} files{multiple ? `, up to ${maxFiles}` : ''}</p>
      </div>

      {progress !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {selected.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
              <FileText className="w-4 h-4 text-brand-500 shrink-0" />
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{f.name}</span>
              <span className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
              {progress === 100 ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-slate-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
