import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCompactNumber } from '@/lib/formatters';

interface ViewsChartProps {
  data: { date: string; value: number }[];
}

export function ViewsChart({ data }: ViewsChartProps) {
  return (
    <Card title="Views">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={d => d.slice(5)} />
            <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => formatCompactNumber(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1724', border: '1px solid #1e293b', borderRadius: '8px' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#06b6d4' }}
              formatter={(v: number) => [formatCompactNumber(v), 'Views']}
            />
            <Area type="monotone" dataKey="value" stroke="#06b6d4" fillOpacity={1} fill="url(#viewsGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
