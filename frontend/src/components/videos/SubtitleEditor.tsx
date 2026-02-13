import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Loader2, Type } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import client from '@/api/client';

interface Segment {
  index: number;
  start: string;
  end: string;
  text: string;
}

interface SubtitleEditorProps {
  videoId: string;
  subtitleId: string;
  language?: string;
  format?: string;
}

export function SubtitleEditor({ videoId, subtitleId, language, format }: SubtitleEditorProps) {
  const { addToast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadContent();
  }, [videoId, subtitleId]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const { data } = await client.get(`/videos/${videoId}/subtitles/${subtitleId}/content`);
      setSegments(data.segments || []);
      setDirty(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to load subtitle content' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put(`/videos/${videoId}/subtitles/${subtitleId}/content`, { segments });
      addToast({ type: 'success', title: 'Subtitles saved' });
      setDirty(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to save subtitles' });
    } finally {
      setSaving(false);
    }
  };

  const updateSegment = (index: number, field: keyof Segment, value: string) => {
    setSegments(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    setDirty(true);
  };

  const deleteSegment = (index: number) => {
    setSegments(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const addSegment = (afterIndex: number) => {
    const prevSeg = segments[afterIndex];
    const newSeg: Segment = {
      index: (prevSeg?.index || 0) + 1,
      start: prevSeg?.end || '00:00:00,000',
      end: prevSeg?.end || '00:00:00,000',
      text: '',
    };
    const newSegments = [...segments];
    newSegments.splice(afterIndex + 1, 0, newSeg);
    setSegments(newSegments);
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-text-tertiary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm font-medium text-text-primary">Subtitle Editor</span>
          {language && <Badge variant="default" size="sm">{language}</Badge>}
          {format && <Badge variant="default" size="sm">{format}</Badge>}
          <span className="text-2xs text-text-quaternary">{segments.length} segments</span>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          loading={saving}
          disabled={!dirty}
          icon={<Save className="h-3 w-3" />}
        >
          Save
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-1 rounded-lg border border-glass-border p-2">
        {segments.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-tertiary">
            No segments found.
            <button onClick={() => addSegment(-1)} className="ml-1 text-accent-primary hover:underline">
              Add first segment
            </button>
          </div>
        ) : (
          segments.map((seg, i) => (
            <div
              key={i}
              className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-highlight transition-colors"
            >
              <div className="flex flex-col gap-1 flex-shrink-0 w-28">
                <input
                  className="w-full rounded border border-glass-border bg-surface-primary px-1.5 py-0.5 text-2xs font-mono text-text-secondary focus:border-accent-primary focus:outline-none"
                  value={seg.start}
                  onChange={(e) => updateSegment(i, 'start', e.target.value)}
                  placeholder="00:00:00,000"
                />
                <input
                  className="w-full rounded border border-glass-border bg-surface-primary px-1.5 py-0.5 text-2xs font-mono text-text-secondary focus:border-accent-primary focus:outline-none"
                  value={seg.end}
                  onChange={(e) => updateSegment(i, 'end', e.target.value)}
                  placeholder="00:00:00,000"
                />
              </div>
              <textarea
                className="flex-1 rounded border border-glass-border bg-surface-primary px-2 py-1 text-sm text-text-primary resize-none focus:border-accent-primary focus:outline-none min-h-[40px]"
                value={seg.text}
                onChange={(e) => updateSegment(i, 'text', e.target.value)}
                rows={2}
              />
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => addSegment(i)}
                  className="p-1 rounded hover:bg-surface-tertiary text-text-quaternary hover:text-text-primary"
                  title="Insert segment after"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={() => deleteSegment(i)}
                  className="p-1 rounded hover:bg-red-500/10 text-text-quaternary hover:text-red-400"
                  title="Delete segment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
