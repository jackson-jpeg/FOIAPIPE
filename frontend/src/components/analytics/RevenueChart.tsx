import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config';

const fullConfig = resolveConfig(tailwindConfig);
const colors = fullConfig.theme?.colors as any;

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
                <stop offset="0%" stopColor={colors.chart.revenue} stopOpacity={0.15} />
                <stop offset="100%" stopColor={colors.chart.revenue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} vertical={false} />
            <XAxis dataKey="date" stroke={colors.chart.axis} fontSize={10} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
            <YAxis stroke={colors.chart.axis} fontSize={10} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.chart.tooltip.bg, border: `1px solid ${colors.chart.tooltip.border}`, borderRadius: '8px', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)', fontSize: '11px' }}
              labelStyle={{ color: colors.chart.tooltip.label, fontSize: '10px' }}
              itemStyle={{ color: colors.chart.revenue }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
            />
            <Area type="monotone" dataKey="value" stroke={colors.chart.revenue} strokeWidth={1.5} fillOpacity={1} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
