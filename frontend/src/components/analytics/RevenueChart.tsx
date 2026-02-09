import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';

interface RevenueChartProps {
  data: { date: string; value: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card title="Revenue">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#232328" vertical={false} />
            <XAxis dataKey="date" stroke="#56565e" fontSize={10} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
            <YAxis stroke="#56565e" fontSize={10} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111113', border: '1px solid #232328', borderRadius: '8px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)', fontSize: '11px' }}
              labelStyle={{ color: '#56565e', fontSize: '10px' }}
              itemStyle={{ color: '#34d399' }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
            />
            <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={1.5} fillOpacity={1} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
