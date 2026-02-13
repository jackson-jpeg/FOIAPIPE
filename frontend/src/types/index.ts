/**
 * Shared TypeScript types for FOIA Archive frontend
 * Generated from backend Pydantic schemas
 */

// ── News Articles ─────────────────────────────────────────────────────────

export type IncidentType = 'ois' | 'use_of_force' | 'pursuit' | 'taser' | 'k9' | 'arrest' | 'dui' | 'other';

export interface NewsArticle {
  id: string;
  url: string;
  headline: string;
  source: string;
  summary: string | null;
  body: string | null;
  published_at: string | null;
  incident_type: IncidentType | null;
  severity_score: number | null;
  virality_score: number | null;
  detected_agency: string | null;
  detected_officers: string[] | null;
  detected_location: string | null;
  is_reviewed: boolean;
  is_dismissed: boolean;
  dismissed_reason: string | null;
  auto_foia_eligible: boolean;
  auto_foia_filed: boolean;
  predicted_revenue: number | null;
  priority_factors: Record<string, any> | null;
  created_at: string;
  updated_at: string | null;
}

export interface NewsArticleList {
  items: NewsArticle[];
  total: number;
  page: number;
  page_size: number;
}

export interface NewsArticleUpdate {
  is_dismissed?: boolean;
  dismissed_reason?: string;
  is_reviewed?: boolean;
}

export interface NewsScanStatus {
  last_scan_at: string | null;
  next_scan_at: string | null;
  is_scanning: boolean;
  articles_found_last_scan: number;
}

export interface BulkActionRequest {
  article_ids: string[];
  action: 'dismiss' | 'file_foia' | 'mark_reviewed';
}

export interface FileFoiaResponse {
  foia_request_id: string;
  case_number: string;
  agency_name: string;
  status: string;
  request_text: string;
  created_at: string;
}

// ── Videos ────────────────────────────────────────────────────────────────

export type VideoStatus =
  | 'raw_received'
  | 'ingesting'
  | 'editing'
  | 'ai_processing'
  | 'ai_review'
  | 'review'
  | 'manual_review'
  | 'ready'
  | 'ready_for_upload'
  | 'scheduled'
  | 'uploading'
  | 'processing_youtube'
  | 'published'
  | 'unlisted'
  | 'private'
  | 'archived'
  | 'removed';

export interface Video {
  id: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  foia_request_id: string | null;
  foia_case_number: string | null;
  status: VideoStatus;
  raw_storage_key: string | null;
  processed_storage_key: string | null;
  thumbnail_storage_key: string | null;
  duration_seconds: number | null;
  resolution: string | null;
  file_size_bytes: number | null;
  youtube_video_id: string | null;
  youtube_url: string | null;
  youtube_upload_status: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  editing_notes: string | null;
  priority: number;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface VideoList {
  items: Video[];
  total: number;
  page: number;
  page_size: number;
}

export interface VideoUpdate {
  title?: string;
  description?: string;
  tags?: string[];
  foia_request_id?: string | null;
  status?: VideoStatus;
  editing_notes?: string;
  priority?: number;
  visibility?: 'public' | 'unlisted' | 'private';
}

// ── FOIA Requests ─────────────────────────────────────────────────────────

export type FoiaStatus =
  | 'draft'
  | 'pending_review'
  | 'submitted'
  | 'acknowledged'
  | 'processing'
  | 'fulfilled'
  | 'partially_fulfilled'
  | 'denied'
  | 'appealed'
  | 'appeal_denied'
  | 'withdrawn'
  | 'expired';

export interface FoiaRequest {
  id: string;
  case_number: string;
  agency_id: string;
  agency_name?: string;
  news_article_id?: string;
  article_headline?: string;
  status: FoiaStatus;
  priority: number;
  request_text: string;
  submitted_at: string | null;
  due_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  agency_reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string | null;
}

export interface FoiaListParams {
  page?: number;
  page_size?: number;
  status?: FoiaStatus;
  agency_id?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

// ── Analytics ─────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_views: number;
  revenue_mtd: number;
  active_foias: number;
  pending_reviews: number;
  pipeline_count: number;
  news_queue: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  views: number;
}

export interface TopVideo {
  id: string;
  title: string;
  views: number;
  revenue: number;
  thumbnail_url: string | null;
}

// ── Agencies ──────────────────────────────────────────────────────────────

export interface Agency {
  id: string;
  name: string;
  state: string;
  foia_email: string | null;
  foia_phone: string | null;
  foia_mailing_address: string | null;
  submission_method: 'email' | 'portal' | 'mail' | 'fax';
  typical_response_days: number | null;
  typical_cost_per_hour: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface AgencyListParams {
  page?: number;
  page_size?: number;
  state?: string;
  active?: boolean;
  search?: string;
}

// ── Notifications ─────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ── Settings ──────────────────────────────────────────────────────────────

export interface SystemSettings {
  scan_interval_minutes: number;
  auto_submit_enabled: boolean;
  auto_submit_threshold: number;
  max_auto_submits_per_day: number;
}

// ── Pagination ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
