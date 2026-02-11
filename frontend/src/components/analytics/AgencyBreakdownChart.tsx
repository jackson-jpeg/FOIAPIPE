import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config';

const fullConfig = resolveConfig(tailwindConfig);
const colors = fullConfig.theme?.colors as any;

interface AgencyData {
  agency_name: string;
  video_count: number;
  total_views: number;
  total_revenue: number;
}

interface AgencyBreakdownChartProps {
  data: AgencyData[];
}

export function AgencyBreakdownChart({ data }: AgencyBreakdownChartProps) {
  const formatted = data.map(d => ({
    ...d,
    name: d.agency_name?.replace(/ (Police |Sheriff's )?(Department|Office)/g, '') || 'Unknown',
  }));

  return (
    <Card title="Performance by Agency">
      {data.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">No agency data yet</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} horizontal={false} />
              <XAxis type="number" stroke={colors.chart.axis} fontSize={10} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" stroke={colors.chart.axis} fontSize={10} width={100} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: colors.chart.tooltip.bg, border: `1px solid ${colors.chart.tooltip.border}`, borderRadius: '8px', fontSize: '11px' }}
                labelStyle={{ color: colors.chart.tooltip.label, fontSize: '10px' }}
                formatter={(v: number, name: string) => [
                  name === 'total_revenue' ? `$${v.toFixed(2)}` : v.toLocaleString(),
                  name === 'total_revenue' ? 'Revenue' : 'Views',
                ]}
              />
              <Bar dataKey="total_revenue" fill={colors.chart.revenue} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
