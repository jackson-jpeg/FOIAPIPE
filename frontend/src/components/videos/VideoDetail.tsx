import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { formatDate, formatDuration, formatCurrency, formatCompactNumber } from '@/lib/formatters';
import { Sparkline } from '@/components/ui/Sparkline';
import { VIDEO_STATUSES } from '@/lib/constants';
import {
  X, Upload, Image, Save, ExternalLink, Youtube, Play, Zap, Captions,
  Trash2, Copy, Archive, Scissors, Type, Link2, Unlink, BarChart3,
  Eye, DollarSign, ThumbsUp, MessageSquare, TrendingUp, Calendar, XCircle,
} from 'lucide-react';
import * as videosApi from '@/api/videos';
import * as foiaApi from '@/api/foia';
import { useToast } from '@/components/ui/Toast';
import type { Video } from '@/types';

interface VideoDetailProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Video>) => void;
  onUploadRaw: (id: string, file: File) => void;
  onGenerateThumbnail: (id: string) => void;
  onUploadToYoutube: (id: string) => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

interface Subtitle {
  id: string;
  language: string;
  format: string;
  provider: string;
  segment_count: number | null;
  created_at: string | null;
}

export function VideoDetail({ video, isOpen, onClose, onUpdate, onUploadRaw, onGenerateThumbnail, onUploadToYoutube, onRefresh, onDelete, onDuplicate }: VideoDetailProps) {
  const { addToast } = useToast();
  const [title, setTitle] = useState(video?.title || '');
  const [description, setDescription] = useState(video?.description || '');
  const [editingNotes, setEditingNotes] = useState(video?.editing_notes || '');
  const [tags, setTags] = useState(video?.tags?.join(', ') || '');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTrimForm, setShowTrimForm] = useState(false);
  const [showIntroForm, setShowIntroForm] = useState(false);
  const [foiaOptions, setFoiaOptions] = useState<{ value: string; label: string }[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [trimStart, setTrimStart] = useState('0');
  const [trimEnd, setTrimEnd] = useState('');
  const [introText, setIntroText] = useState('');
  const [introDuration, setIntroDuration] = useState('5');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDatetime, setScheduleDatetime] = useState('');

  useEffect(() => {
    if (video?.id) {
      videosApi.listSubtitles(video.id)
        .then(data => setSubtitles(data.subtitles || []))
        .catch(() => setSubtitles([]));
      foiaApi.getFoiaRequests({ page_size: 200, sort_by: 'created_at', sort_dir: 'desc' })
        .then((data: any) => {
          const items = data.items || data || [];
          setFoiaOptions(items.map((f: any) => ({
            value: f.id,
            label: `${f.case_number} — ${f.agency_name || 'Unknown Agency'} (${f.status})`,
          })));
        })
        .catch(() => setFoiaOptions([]));
      if (video.youtube_video_id) {
        videosApi.getVideoAnalytics(video.id)
          .then(setAnalytics)
          .catch(() => setAnalytics(null));
      }
    }
  }, [video?.id]);

  useEffect(() => {
    if (video) {
      setTitle(video.title || '');
      setDescription(video.description || '');
      setEditingNotes(video.editing_notes || '');
      setTags(video.tags?.join(', ') || '');
      setTrimEnd(video.duration_seconds ? String(video.duration_seconds) : '');
    }
  }, [video?.id]);

  if (!isOpen || !video) return null;

  const statusOptions = Object.entries(VIDEO_STATUSES).map(([k, v]) => ({ value: k, label: v.label }));
  const statusInfo = VIDEO_STATUSES[video.status as keyof typeof VIDEO_STATUSES];
  const hasFile = !!(video.raw_storage_key || video.processed_storage_key);
  const isPublished = video.status === 'published';

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

  const handleProcessing = async (action: string, fn: () => Promise<any>, successMsg: string) => {
    setProcessingAction(action);
    try {
      await fn();
      addToast({ type: 'success', title: successMsg });
      onRefresh();
    } catch {
      addToast({ type: 'error', title: `${action} failed` });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleOptimize = () => handleProcessing(
    'Optimize', () => videosApi.optimizeForYoutube(video.id), 'Video optimized for YouTube'
  );

  const handleYtThumbnail = () => handleProcessing(
    'YT Thumbnail', () => videosApi.generateYoutubeThumbnail(video.id, { title_text: video.title || undefined }), 'YouTube thumbnail generated'
  );

  const handleGenerateSubtitles = () => handleProcessing(
    'Subtitles',
    async () => {
      await videosApi.generateSubtitles(video.id, { provider: 'whisper' });
      const data = await videosApi.listSubtitles(video.id);
      setSubtitles(data.subtitles || []);
    },
    'Subtitles generated'
  );

  const handleDeleteSubtitle = async (subId: string) => {
    try {
      await videosApi.deleteSubtitle(video.id, subId);
      setSubtitles(prev => prev.filter(s => s.id !== subId));
      addToast({ type: 'info', title: 'Subtitle deleted' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete subtitle' });
    }
  };

  const handleTrim = () => {
    const start = parseFloat(trimStart);
    const end = parseFloat(trimEnd);
    if (isNaN(start) || isNaN(end) || start >= end) {
      addToast({ type: 'error', title: 'Invalid trim range' });
      return;
    }
    setShowTrimForm(false);
    handleProcessing('Trim', () => videosApi.trimVideo(video.id, start, end), 'Video trimmed successfully');
  };

  const handleAddIntro = () => {
    if (!introText.trim()) {
      addToast({ type: 'error', title: 'Intro text is required' });
      return;
    }
    setShowIntroForm(false);
    handleProcessing('Intro', () => videosApi.addIntro(video.id, introText.trim(), parseInt(introDuration) || 5), 'Intro card added');
  };

  const handleArchive = () => {
    onUpdate(video.id, { status: 'archived' as any });
  };

  const handleSchedule = async () => {
    if (!scheduleDatetime) {
      addToast({ type: 'error', title: 'Select a date and time' });
      return;
    }
    try {
      await videosApi.scheduleVideo(video.id, new Date(scheduleDatetime).toISOString());
      addToast({ type: 'success', title: 'Video scheduled for publish' });
      setShowScheduleForm(false);
      setScheduleDatetime('');
      onRefresh();
    } catch {
      addToast({ type: 'error', title: 'Failed to schedule video' });
    }
  };

  const handleUnschedule = async () => {
    try {
      await videosApi.unscheduleVideo(video.id);
      addToast({ type: 'success', title: 'Video unscheduled' });
      onRefresh();
    } catch {
      addToast({ type: 'error', title: 'Failed to unschedule video' });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-surface-secondary border-l border-surface-border shadow-overlay z-50 overflow-y-auto animate-slide-in-right">
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
          <div className="flex items-center gap-1">
            {/* Quick Actions */}
            <button
              onClick={() => onDuplicate(video.id)}
              title="Duplicate"
              className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {!isPublished && (
              <button
                onClick={handleArchive}
                title="Archive"
                className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            )}
            {!isPublished && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete"
                className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-text-tertiary hover:text-accent-red"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors text-text-tertiary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="rounded-lg border border-accent-red/30 bg-red-500/5 p-4 space-y-3">
              <p className="text-sm text-text-primary font-medium">Delete this video?</p>
              <p className="text-xs text-text-secondary">This will permanently remove the video entry and all its subtitles. Storage files will not be deleted.</p>
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={() => { onDelete(video.id); onClose(); }}>
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {video.duration_seconds && <div><p className="text-text-quaternary mb-0.5">Duration</p><p className="font-mono text-text-primary tabular-nums">{formatDuration(video.duration_seconds)}</p></div>}
            {video.resolution && <div><p className="text-text-quaternary mb-0.5">Resolution</p><p className="font-mono text-text-primary">{video.resolution}</p></div>}
            {video.file_size_bytes && <div><p className="text-text-quaternary mb-0.5">File Size</p><p className="font-mono text-text-primary tabular-nums">{(video.file_size_bytes / 1048576).toFixed(1)} MB</p></div>}
            <div><p className="text-text-quaternary mb-0.5">Created</p><p className="text-text-primary tabular-nums">{formatDate(video.created_at)}</p></div>
            {video.visibility && <div><p className="text-text-quaternary mb-0.5">Visibility</p><p className="text-text-primary capitalize">{video.visibility}</p></div>}
            {video.priority > 0 && <div><p className="text-text-quaternary mb-0.5">Priority</p><p className="text-text-primary tabular-nums">{video.priority}</p></div>}
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

          {/* Processing Tools */}
          {hasFile && (
            <div className="rounded-lg border border-surface-border p-3.5 space-y-2.5">
              <h3 className="text-xs font-medium text-text-primary">Processing Tools</h3>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline" size="sm"
                  onClick={() => onGenerateThumbnail(video.id)}
                  icon={<Image className="h-3 w-3" />}
                >
                  Thumbnail
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={handleYtThumbnail}
                  loading={processingAction === 'YT Thumbnail'}
                  icon={<Play className="h-3 w-3" />}
                >
                  YT Thumbnail
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={handleOptimize}
                  loading={processingAction === 'Optimize'}
                  icon={<Zap className="h-3 w-3" />}
                >
                  Optimize
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={handleGenerateSubtitles}
                  loading={processingAction === 'Subtitles'}
                  icon={<Captions className="h-3 w-3" />}
                >
                  Subtitles
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowTrimForm(!showTrimForm)}
                  loading={processingAction === 'Trim'}
                  icon={<Scissors className="h-3 w-3" />}
                >
                  Trim
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowIntroForm(!showIntroForm)}
                  loading={processingAction === 'Intro'}
                  icon={<Type className="h-3 w-3" />}
                >
                  Add Intro
                </Button>
              </div>

              {/* Trim Form */}
              {showTrimForm && (
                <div className="mt-2 p-3 rounded-md bg-surface-tertiary/30 space-y-2">
                  <p className="text-2xs text-text-tertiary">Trim video (seconds)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={trimStart}
                      onChange={e => setTrimStart(e.target.value)}
                      placeholder="Start"
                      className="w-20 rounded-md bg-surface-primary border border-surface-border px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                    <span className="text-text-quaternary text-xs">to</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={trimEnd}
                      onChange={e => setTrimEnd(e.target.value)}
                      placeholder="End"
                      className="w-20 rounded-md bg-surface-primary border border-surface-border px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                    <Button variant="primary" size="sm" onClick={handleTrim}>Trim</Button>
                  </div>
                </div>
              )}

              {/* Add Intro Form */}
              {showIntroForm && (
                <div className="mt-2 p-3 rounded-md bg-surface-tertiary/30 space-y-2">
                  <p className="text-2xs text-text-tertiary">Add text intro card</p>
                  <input
                    type="text"
                    value={introText}
                    onChange={e => setIntroText(e.target.value)}
                    placeholder="Intro text (e.g. agency name, date)"
                    className="w-full rounded-md bg-surface-primary border border-surface-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={introDuration}
                      onChange={e => setIntroDuration(e.target.value)}
                      className="w-16 rounded-md bg-surface-primary border border-surface-border px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                    <span className="text-2xs text-text-quaternary">seconds</span>
                    <Button variant="primary" size="sm" onClick={handleAddIntro}>Add Intro</Button>
                  </div>
                </div>
              )}

              {video.processed_storage_key && (
                <p className="text-2xs text-text-quaternary">Processed version available</p>
              )}
            </div>
          )}

          {/* Subtitles */}
          {subtitles.length > 0 && (
            <div className="rounded-lg border border-surface-border p-3.5 space-y-2">
              <h3 className="text-xs font-medium text-text-primary">Subtitles</h3>
              {subtitles.map(sub => (
                <div key={sub.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-text-primary font-mono">{sub.language}</span>
                    <span className="text-text-quaternary ml-1.5">{sub.format}</span>
                    {sub.segment_count && <span className="text-text-quaternary ml-1.5">{sub.segment_count} segments</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {video.youtube_video_id && (
                      <button
                        onClick={async () => {
                          try {
                            await videosApi.uploadSubtitleToYoutube(video.id, sub.id);
                            addToast({ type: 'success', title: 'Subtitle uploaded to YouTube' });
                          } catch {
                            addToast({ type: 'error', title: 'Failed to upload subtitle' });
                          }
                        }}
                        className="text-text-tertiary hover:text-accent-primary transition-colors"
                        title="Upload to YouTube"
                      >
                        <Youtube className="h-3 w-3" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteSubtitle(sub.id)} className="text-text-tertiary hover:text-accent-red transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload to YouTube */}
          {hasFile && !video.youtube_video_id && video.status !== 'scheduled' && (
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

          {/* Schedule Publish */}
          {video.status === 'ready' && hasFile && (
            <div className="space-y-2">
              {!showScheduleForm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScheduleForm(true)}
                  icon={<Calendar className="h-3.5 w-3.5" />}
                >
                  Schedule Publish
                </Button>
              ) : (
                <div className="rounded-lg border border-surface-border p-3 space-y-2">
                  <p className="text-2xs text-text-tertiary">Schedule publish time</p>
                  <input
                    type="datetime-local"
                    value={scheduleDatetime}
                    onChange={e => setScheduleDatetime(e.target.value)}
                    className="w-full rounded-md bg-surface-primary border border-surface-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleSchedule}>Schedule</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowScheduleForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scheduled Info */}
          {video.status === 'scheduled' && (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-medium text-text-primary">Scheduled</span>
                </div>
                <span className="text-xs text-text-secondary tabular-nums">
                  {video.scheduled_at ? new Date(video.scheduled_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnschedule}
                icon={<XCircle className="h-3 w-3" />}
              >
                Unschedule
              </Button>
            </div>
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

          {/* Per-Video Analytics */}
          {analytics?.totals && (
            <div className="rounded-lg border border-surface-border p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-text-tertiary" />
                <h3 className="text-xs font-medium text-text-primary">YouTube Analytics</h3>
                <span className="text-2xs text-text-quaternary ml-auto">{analytics.period_days}d</span>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-surface-tertiary/30 px-2.5 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Eye className="h-2.5 w-2.5 text-text-quaternary" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary tabular-nums">{formatCompactNumber(analytics.totals.views)}</p>
                  <p className="text-2xs text-text-quaternary">Views</p>
                </div>
                <div className="rounded-md bg-surface-tertiary/30 px-2.5 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <DollarSign className="h-2.5 w-2.5 text-text-quaternary" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(analytics.totals.revenue)}</p>
                  <p className="text-2xs text-text-quaternary">Revenue</p>
                </div>
                <div className="rounded-md bg-surface-tertiary/30 px-2.5 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingUp className="h-2.5 w-2.5 text-text-quaternary" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary tabular-nums">${analytics.totals.rpm}</p>
                  <p className="text-2xs text-text-quaternary">RPM</p>
                </div>
              </div>

              {/* Views Sparkline */}
              {analytics.daily?.length > 1 && (
                <div>
                  <p className="text-2xs text-text-quaternary mb-1">Views trend</p>
                  <Sparkline data={analytics.daily.map((d: any) => d.views)} height={32} className="w-full" />
                </div>
              )}

              {/* Engagement Row */}
              <div className="flex items-center justify-between text-2xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-text-tertiary">
                    <ThumbsUp className="h-2.5 w-2.5" />
                    {formatCompactNumber(analytics.totals.likes)}
                  </span>
                  <span className="flex items-center gap-1 text-text-tertiary">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {formatCompactNumber(analytics.totals.comments)}
                  </span>
                </div>
                <span className="text-text-quaternary tabular-nums">
                  CTR {analytics.totals.avg_ctr}% · {analytics.totals.watch_time_hours}h watched
                </span>
              </div>
            </div>
          )}

          {/* Status Change */}
          <Select
            label="Status"
            options={statusOptions}
            value={video.status}
            onChange={(value) => onUpdate(video.id, { status: value as Video['status'] })}
          />

          {/* FOIA Linking */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              <Link2 className="inline h-3 w-3 mr-1 -mt-0.5" />
              Linked FOIA Request
            </label>
            {video.foia_request_id ? (
              <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2">
                <span className="text-xs font-mono text-text-primary">
                  {video.foia_case_number || video.foia_request_id.slice(0, 8)}
                </span>
                <button
                  onClick={() => onUpdate(video.id, { foia_request_id: null } as any)}
                  title="Unlink FOIA"
                  className="p-1 hover:bg-red-500/10 rounded transition-colors text-text-tertiary hover:text-accent-red"
                >
                  <Unlink className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Select
                options={[{ value: '', label: 'No FOIA linked' }, ...foiaOptions]}
                value=""
                onChange={(value) => {
                  if (value) onUpdate(video.id, { foia_request_id: value } as any);
                }}
              />
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Priority (0 = normal)</label>
            <input
              type="number"
              min="0"
              max="10"
              value={video.priority}
              onChange={e => onUpdate(video.id, { priority: parseInt(e.target.value) || 0 } as any)}
              className="w-20 rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 transition-all duration-150"
            />
          </div>

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
