import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { formatDate, formatDuration } from '@/lib/formatters';
import { VIDEO_STATUSES } from '@/lib/constants';
import { X, Upload, Image, Save, ExternalLink } from 'lucide-react';

interface VideoDetailProps {
  video: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onUploadRaw: (id: string, file: File) => void;
  onGenerateThumbnail: (id: string) => void;
}

export function VideoDetail({ video, isOpen, onClose, onUpdate, onUploadRaw, onGenerateThumbnail }: VideoDetailProps) {
  const [title, setTitle] = useState(video?.title || '');
  const [description, setDescription] = useState(video?.description || '');
  const [editingNotes, setEditingNotes] = useState(video?.editing_notes || '');
  const [tags, setTags] = useState(video?.tags?.join(', ') || '');

  if (!isOpen || !video) return null;

  const statusOptions = Object.entries(VIDEO_STATUSES).map(([k, v]) => ({ value: k, label: v.label }));
  const statusInfo = VIDEO_STATUSES[video.status as keyof typeof VIDEO_STATUSES];

  const handleSave = () => {
    onUpdate(video.id, {
      title,
      description,
      editing_notes: editingNotes,
      tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadRaw(video.id, file);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-surface-secondary border-l border-surface-border shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-surface-secondary border-b border-surface-border px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-medium text-text-primary">{video.title || 'Untitled Video'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={(statusInfo?.variant || 'default') as any} size="sm" dot>{statusInfo?.label || video.status}</Badge>
            {video.foia_case_number && <span className="text-xs font-mono text-text-tertiary">{video.foia_case_number}</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-surface-tertiary rounded"><X className="h-5 w-5 text-text-tertiary" /></button>
      </div>

      <div className="p-6 space-y-6">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {video.duration_seconds && <div><p className="text-text-tertiary">Duration</p><p className="font-mono text-text-primary">{formatDuration(video.duration_seconds)}</p></div>}
          {video.resolution && <div><p className="text-text-tertiary">Resolution</p><p className="font-mono text-text-primary">{video.resolution}</p></div>}
          {video.file_size_bytes && <div><p className="text-text-tertiary">File Size</p><p className="font-mono text-text-primary">{(video.file_size_bytes / 1048576).toFixed(1)} MB</p></div>}
          <div><p className="text-text-tertiary">Created</p><p className="font-mono text-text-primary">{formatDate(video.created_at)}</p></div>
        </div>

        {/* Upload */}
        {!video.raw_storage_key && (
          <div className="border-2 border-dashed border-surface-border rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-secondary mb-2">Upload raw footage</p>
            <label className="cursor-pointer">
              <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
              <span className="inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 bg-transparent border border-surface-border text-text-secondary hover:border-accent-cyan hover:text-accent-cyan px-3 py-1.5 text-xs">
                Choose File
              </span>
            </label>
          </div>
        )}

        {/* Thumbnail */}
        {video.raw_storage_key && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onGenerateThumbnail(video.id)} icon={<Image className="h-3.5 w-3.5" />}>
              Generate Thumbnail
            </Button>
          </div>
        )}

        {/* YouTube Link */}
        {video.youtube_url && (
          <div className="rounded-lg border border-surface-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">YouTube</span>
              <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-accent-cyan hover:underline">
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Status Change */}
        <Select
          label="Status"
          options={statusOptions}
          value={video.status}
          onChange={(value) => onUpdate(video.id, { status: value })}
        />

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Title</label>
          <input className="w-full rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
          <textarea className="w-full rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Tags (comma-separated)</label>
          <input className="w-full rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50" value={tags} onChange={e => setTags(e.target.value)} />
        </div>

        {/* Editing Notes */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Editing Notes</label>
          <textarea className="w-full rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 min-h-[80px]" value={editingNotes} onChange={e => setEditingNotes(e.target.value)} />
        </div>

        <Button variant="primary" onClick={handleSave} icon={<Save className="h-4 w-4" />}>Save Changes</Button>
      </div>
    </div>
  );
}
