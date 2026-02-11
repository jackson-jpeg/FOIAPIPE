import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { formatDate, formatDuration } from '@/lib/formatters';
import { VIDEO_STATUSES } from '@/lib/constants';
import { X, Upload, Image, Save, ExternalLink, Youtube } from 'lucide-react';
import type { Video } from '@/types';

interface VideoDetailProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Video>) => void;
  onUploadRaw: (id: string, file: File) => void;
  onGenerateThumbnail: (id: string) => void;
  onUploadToYoutube: (id: string) => void;
}

export function VideoDetail({ video, isOpen, onClose, onUpdate, onUploadRaw, onGenerateThumbnail, onUploadToYoutube }: VideoDetailProps) {
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
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-surface-secondary border-l border-surface-border shadow-overlay z-50 overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-surface-secondary/95 backdrop-blur-sm border-b border-surface-border px-5 py-3.5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-sm font-medium text-text-primary">{video.title || 'Untitled Video'}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant={(statusInfo?.variant as 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default') || 'default'}
                size="sm"
                dot
              >
                {statusInfo?.label || video.status}
              </Badge>
              {video.foia_case_number && <span className="text-2xs font-mono text-text-quaternary">{video.foia_case_number}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-tertiary rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-tertiary" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {video.duration_seconds && <div><p className="text-text-quaternary mb-0.5">Duration</p><p className="font-mono text-text-primary tabular-nums">{formatDuration(video.duration_seconds)}</p></div>}
            {video.resolution && <div><p className="text-text-quaternary mb-0.5">Resolution</p><p className="font-mono text-text-primary">{video.resolution}</p></div>}
            {video.file_size_bytes && <div><p className="text-text-quaternary mb-0.5">File Size</p><p className="font-mono text-text-primary tabular-nums">{(video.file_size_bytes / 1048576).toFixed(1)} MB</p></div>}
            <div><p className="text-text-quaternary mb-0.5">Created</p><p className="text-text-primary tabular-nums">{formatDate(video.created_at)}</p></div>
          </div>

          {/* Upload */}
          {!video.raw_storage_key && (
            <div className="border border-dashed border-surface-border-light rounded-xl p-5 text-center transition-colors hover:border-accent-primary/30 hover:bg-accent-primary-subtle">
              <Upload className="h-6 w-6 text-text-quaternary mx-auto mb-1.5" />
              <p className="text-xs text-text-secondary mb-2">Upload raw footage</p>
              <label className="cursor-pointer">
                <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 border border-surface-border-light text-text-secondary hover:border-accent-primary/40 hover:text-accent-primary px-3 py-1.5 text-2xs">
                  Choose File
                </span>
              </label>
            </div>
          )}

          {/* Thumbnail */}
          {video.raw_storage_key && (
            <Button variant="outline" size="sm" onClick={() => onGenerateThumbnail(video.id)} icon={<Image className="h-3 w-3" />}>
              Generate Thumbnail
            </Button>
          )}

          {/* Upload to YouTube */}
          {(video.raw_storage_key || video.processed_storage_key) && !video.youtube_video_id && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onUploadToYoutube(video.id)}
              disabled={video.youtube_upload_status === 'queued' || video.youtube_upload_status === 'uploading'}
              icon={<Youtube className="h-3.5 w-3.5" />}
            >
              {video.youtube_upload_status === 'queued' ? 'Queued...' :
               video.youtube_upload_status === 'uploading' ? 'Uploading...' :
               'Upload to YouTube'}
            </Button>
          )}

          {/* YouTube Link */}
          {video.youtube_url && (
            <div className="rounded-lg border border-surface-border p-3 flex items-center justify-between">
              <span className="text-xs text-text-tertiary">YouTube</span>
              <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-accent-primary hover:underline">
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Status Change */}
          <Select
            label="Status"
            options={statusOptions}
            value={video.status}
            onChange={(value) => onUpdate(video.id, { status: value as Video['status'] })}
          />

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
            <input className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 transition-all duration-150" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
            <textarea className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 min-h-[80px] transition-all duration-150" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Tags (comma-separated)</label>
            <input className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 transition-all duration-150" value={tags} onChange={e => setTags(e.target.value)} />
          </div>

          {/* Editing Notes */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Editing Notes</label>
            <textarea className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 min-h-[60px] transition-all duration-150" value={editingNotes} onChange={e => setEditingNotes(e.target.value)} />
          </div>

          <Button variant="primary" onClick={handleSave} icon={<Save className="h-3.5 w-3.5" />}>Save Changes</Button>
        </div>
      </div>
    </>
  );
}
