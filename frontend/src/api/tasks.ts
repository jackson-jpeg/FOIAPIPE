import client from './client';

export interface TaskRunEntry {
  id: string;
  task_name: string;
  celery_task_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  status: 'success' | 'failure' | 'timeout' | 'started';
  result_summary: string | null;
  error_message: string | null;
}

export interface TaskStats {
  total_24h: number;
  successes: number;
  failures: number;
  success_rate: number;
  avg_duration_seconds: number | null;
  last_run: string | null;
}

export interface TaskHistoryResponse {
  runs: TaskRunEntry[];
  task_stats: Record<string, TaskStats>;
  total_runs: number;
}

export interface TaskHealthEntry {
  task: string;
  schedule: string;
  expected_interval_seconds: number;
  health: 'green' | 'amber' | 'red' | 'unknown';
  last_run: string | null;
  last_status: string | null;
  last_duration: number | null;
  last_error: string | null;
  last_success: string | null;
  overdue_seconds: number | null;
}

export interface TaskHealthResponse {
  timestamp: string;
  summary: { green: number; amber: number; red: number; unknown: number; total: number };
  tasks: Record<string, TaskHealthEntry>;
}

export async function getTaskHistory(limit = 20, taskName?: string): Promise<TaskHistoryResponse> {
  const params: Record<string, unknown> = { limit };
  if (taskName) params.task_name = taskName;
  const { data } = await client.get('/tasks/history', { params });
  return data;
}

export async function getTaskHealth(): Promise<TaskHealthResponse> {
  const { data } = await client.get('/tasks/health');
  return data;
}

export async function getTaskStatus(): Promise<any> {
  const { data } = await client.get('/tasks/status');
  return data;
}
