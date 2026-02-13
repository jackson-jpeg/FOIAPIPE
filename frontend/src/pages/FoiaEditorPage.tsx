import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Send, X, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { getFoiaRequest, createFoiaRequest, updateFoiaRequest, submitFoiaRequest, getFoiaSuggestions, previewFoiaSuggestions } from '@/api/foia';

export function FoiaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foiaId, setFoiaId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNewRequest = id === 'new';

  // Character and word count
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const fallbackSuggestions = [
    'Reference Chapter 119, Florida Statutes to establish your legal basis',
    'Specify exact date ranges for the records you are requesting',
    'Request records in electronic format to reduce duplication costs',
  ];

  const fetchSuggestionsForId = useCallback(async (requestId: string) => {
    setIsLoadingSuggestions(true);
    try {
      const data = await getFoiaSuggestions(requestId);
      setAiSuggestions(data.suggestions || fallbackSuggestions);
    } catch {
      setAiSuggestions(fallbackSuggestions);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  const fetchPreviewSuggestions = useCallback(async (text: string) => {
    setIsLoadingSuggestions(true);
    try {
      const data = await previewFoiaSuggestions(text);
      setAiSuggestions(data.suggestions || fallbackSuggestions);
    } catch {
      setAiSuggestions(fallbackSuggestions);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  const handleRefreshSuggestions = () => {
    if (foiaId) {
      fetchSuggestionsForId(foiaId);
    } else if (wordCount >= 50) {
      fetchPreviewSuggestions(content);
    }
  };

  useEffect(() => {
    const loadFoiaRequest = async () => {
      if (!isNewRequest && id) {
        try {
          const foiaRequest = await getFoiaRequest(id);
          setFoiaId(foiaRequest.id);
          setTitle(foiaRequest.case_number || 'FOIA Request');
          setContent(foiaRequest.request_text || '');

          fetchSuggestionsForId(foiaRequest.id);
        } catch (error) {
          addToast({
            type: 'error',
            title: 'Load Failed',
            message: 'Unable to load FOIA request. Redirecting...',
          });
          setTimeout(() => navigate('/foia'), 2000);
        }
      } else {
        setAiSuggestions(fallbackSuggestions);
      }
    };

    loadFoiaRequest();
  }, [id, isNewRequest, navigate, addToast, fetchSuggestionsForId]);

  // Debounced preview suggestions for new requests
  useEffect(() => {
    if (isNewRequest && !foiaId && wordCount >= 50) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        fetchPreviewSuggestions(content);
      }, 1500);
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [content, isNewRequest, foiaId, wordCount, fetchPreviewSuggestions]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please provide both a title and content for your request.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        case_number: title,
        request_text: content,
        status: 'draft',
      };

      if (isNewRequest || !foiaId) {
        // Create new draft
        const newFoia = await createFoiaRequest(payload);
        setFoiaId(newFoia.id);

        // Update URL to reflect the new ID without page reload
        window.history.replaceState(null, '', `/foia/editor/${newFoia.id}`);
      } else {
        // Update existing draft
        await updateFoiaRequest(foiaId, payload);
      }

      addToast({
        type: 'success',
        title: 'Draft Saved',
        message: 'Your FOIA request has been saved as a draft.',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Unable to save draft. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please provide both a title and content before submitting.',
      });
      return;
    }

    // Ensure the request is saved first
    if (!foiaId) {
      addToast({
        type: 'warning',
        title: 'Save Required',
        message: 'Please save your draft before submitting.',
      });
      await handleSave();
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit the FOIA request
      await submitFoiaRequest(foiaId);

      addToast({
        type: 'success',
        title: 'Request Submitted',
        message: 'Your FOIA request has been filed successfully.',
      });

      navigate('/foia');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: 'Unable to submit request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (title || content) {
      if (
        confirm(
          'You have unsaved changes. Are you sure you want to leave?'
        )
      ) {
        navigate('/foia');
      }
    } else {
      navigate('/foia');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary">
      {/* Minimal Header */}
      <header className="border-b border-surface-border bg-surface-secondary/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-secondary"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-surface-border" />
            <h1 className="text-sm font-medium text-text-secondary">
              {isNewRequest ? 'New FOIA Request' : 'Edit FOIA Request'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              loading={isSaving}
              disabled={isSubmitting}
              icon={<Save className="h-3.5 w-3.5" />}
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={isSaving}
              icon={<Send className="h-3.5 w-3.5" />}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </header>

      {/* Centered Content Column */}
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="mx-auto max-w-[70ch] px-8 py-12">
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Request title..."
            className={cn(
              'w-full bg-transparent text-display-sm font-semibold text-text-primary placeholder:text-text-quaternary',
              'border-none outline-none focus:ring-0',
              'mb-8',
              'opacity-90 focus:opacity-100 transition-opacity duration-150'
            )}
          />

          {/* Content Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your FOIA request here..."
            className={cn(
              'w-full min-h-[500px] bg-transparent text-base text-text-primary placeholder:text-text-quaternary',
              'border-none outline-none focus:ring-0 resize-none',
              'leading-[1.8]',
              'opacity-90 focus:opacity-100 transition-opacity duration-150'
            )}
          />

          {/* Character and Word Count */}
          <div className="mt-6 flex items-center gap-4 text-xs text-text-tertiary">
            <span>
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
            <span>•</span>
            <span>{charCount} characters</span>
          </div>

          {/* AI Suggestions Panel */}
          {(aiSuggestions.length > 0 || isLoadingSuggestions) && (
            <div className="mt-12 glass-2 rounded-lg p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent-primary" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    AI Suggestions
                  </h3>
                </div>
                <button
                  onClick={handleRefreshSuggestions}
                  disabled={isLoadingSuggestions}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-secondary disabled:opacity-50"
                  aria-label="Refresh suggestions"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoadingSuggestions && "animate-spin")} />
                </button>
              </div>
              {isLoadingSuggestions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-surface-border" />
                      <div className="h-4 w-full animate-pulse rounded bg-surface-border" />
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm text-text-secondary"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
