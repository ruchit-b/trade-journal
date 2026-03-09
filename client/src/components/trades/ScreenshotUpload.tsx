import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Upload, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const FAKE_PROGRESS_DURATION = 1500; // ms
const FAKE_PROGRESS_TARGET = 90;

export interface ScreenshotUploadProps {
  screenshotUrl: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export function ScreenshotUpload({ screenshotUrl, onUpload, onRemove }: ScreenshotUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastUploadMeta, setLastUploadMeta] = useState<{ name: string; size: number } | null>(null);

  const runFakeProgress = useCallback(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(FAKE_PROGRESS_TARGET, (elapsed / FAKE_PROGRESS_DURATION) * FAKE_PROGRESS_TARGET);
      setProgress(p);
      if (p < FAKE_PROGRESS_TARGET) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a PNG, JPG or WebP image.');
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error('File is too large. Maximum size is 10 MB.');
        return;
      }
      setUploading(true);
      setProgress(0);
      runFakeProgress();
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await api.post<{ success: boolean; data?: { url: string } }>(
          '/api/uploads/screenshot',
          form,
          { headers: { 'Content-Type': false as unknown as string } }
        );
        const body = res?.data;
        if (!body?.success || !body.data?.url) throw new Error('Upload failed');
        setProgress(100);
        setLastUploadMeta({ name: file.name, size: file.size });
        onUpload(body.data.url);
        toast.success('Screenshot uploaded.');
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { error?: string } }; message?: string };
        toast.error(ax?.response?.data?.error ?? ax?.message ?? 'Upload failed.');
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [onUpload, runFakeProgress]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = '';
    },
    [uploadFile]
  );

  const handleRemove = useCallback(async () => {
    if (!screenshotUrl) return;
    try {
      await api.delete('/api/uploads/screenshot', { data: { url: screenshotUrl } });
      setLastUploadMeta(null);
      onRemove();
      toast.success('Screenshot removed.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(ax?.response?.data?.error ?? ax?.message ?? 'Failed to remove.');
    }
  }, [screenshotUrl, onRemove]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (screenshotUrl && !uploading) {
    return (
      <div className="space-y-2">
        <div className="relative inline-block rounded-lg border border-border overflow-hidden bg-elevated">
          <img
            src={screenshotUrl}
            alt="Chart screenshot"
            className="max-h-48 w-auto object-contain"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
            aria-label="Remove screenshot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {lastUploadMeta && (
          <p className="text-xs text-text-muted">
            {lastUploadMeta.name} · {formatSize(lastUploadMeta.size)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onInputChange}
        disabled={uploading}
      />
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 px-4 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-accent bg-accent/10' : 'border-border bg-elevated/50 hover:bg-elevated/80'}
          ${uploading ? 'pointer-events-none' : ''}
        `}
      >
        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 text-accent animate-spin mb-3" />
            <p className="text-sm font-medium text-text-primary">Uploading…</p>
            <div className="mt-3 w-full max-w-[200px] h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-text-muted mb-3">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-text-primary">
              Upload chart screenshot (PNG, JPG — max 10MB)
            </p>
            <p className="mt-1 text-xs text-text-muted">or drag and drop</p>
          </>
        )}
      </div>
    </div>
  );
}
