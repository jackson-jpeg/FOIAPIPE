import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Send, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

export function FoiaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const isNewRequest = id === 'new';

  // Character and word count
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  useEffect(() => {
    // If editing existing request, fetch it
    if (!isNewRequest) {
      // TODO: Fetch existing FOIA request by ID
      // For now, using placeholder
      setTitle('Freedom of Information Act Request - Body Cam Footage');
      setContent(
        `Dear Records Custodian,

Pursuant to the Florida Public Records Act, Chapter 119, Florida Statutes, I hereby request access to and copies of the following records:

[Request details go here]

I request that these records be provided in electronic format if available. If any portion of this request is denied, please provide a written explanation citing the specific statutory exemption and a brief explanation of how the exemption applies.

If you have any questions regarding this request, please contact me at the information provided below.

Thank you for your prompt attention to this matter.

Sincerely,`
      );
    }

    // Mock AI suggestions
    setAiSuggestions([
      'Consider specifying the exact date range for the requested records',
      'Add your contact information at the end of the request',
      'Mention willingness to pay reasonable copy fees',
    ]);
  }, [id, isNewRequest]);

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
      // TODO: Save draft to API
      await new Promise((resolve) => setTimeout(resolve, 1000));

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

    setIsSubmitting(true);
    try {
      // TODO: Submit FOIA request to API
      await new Promise((resolve) => setTimeout(resolve, 1500));

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
              'w-full bg-transparent text-2xl font-semibold text-text-primary placeholder:text-text-quaternary',
              'border-none outline-none focus:ring-0',
              'mb-8'
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
              'leading-[1.8]'
            )}
            style={{
              lineHeight: '1.8',
            }}
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
          {aiSuggestions.length > 0 && (
            <div className="mt-12 rounded-xl border border-surface-border bg-surface-secondary/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  AI Suggestions
                </h3>
              </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
