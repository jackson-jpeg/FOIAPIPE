import { useState, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Deadline {
  id: string;
  case_number: string;
  agency_name: string;
  due_date: string;
  status: string;
}

interface DeadlineCalendarProps {
  deadlines: Deadline[];
  onDateClick?: (date: Date, deadlines: Deadline[]) => void;
}

export function DeadlineCalendar({ deadlines, onDateClick }: DeadlineCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const deadlineMap = useMemo(() => {
    const map: Record<string, Deadline[]> = {};
    deadlines.forEach(d => {
      const date = new Date(d.due_date);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [deadlines]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1));

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-lg border border-surface-border bg-surface-secondary p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="text-sm font-medium text-text-primary">{monthName}</h3>
        <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-xs text-text-tertiary py-1">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${month}-${day}`;
          const dayDeadlines = deadlineMap[key] || [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const hasDeadlines = dayDeadlines.length > 0;
          const hasOverdue = dayDeadlines.some(d => new Date(d.due_date) < today);
          const hasApproaching = dayDeadlines.some(d => {
            const diff = (new Date(d.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 3;
          });

          return (
            <button
              key={day}
              onClick={() => hasDeadlines && onDateClick?.(new Date(year, month, day), dayDeadlines)}
              className={cn(
                'relative p-1.5 text-xs rounded-md transition-colors',
                isToday && 'ring-1 ring-accent-cyan',
                hasDeadlines ? 'cursor-pointer hover:bg-surface-tertiary' : 'cursor-default',
                'text-text-secondary'
              )}
            >
              {day}
              {hasDeadlines && (
                <span className={cn(
                  'absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full',
                  hasOverdue ? 'bg-accent-red' : hasApproaching ? 'bg-accent-amber' : 'bg-accent-cyan'
                )} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
