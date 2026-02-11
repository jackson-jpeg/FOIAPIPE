import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { DollarSign, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import * as agenciesApi from '@/api/agencies';
import * as foiaApi from '@/api/foia';
import type { Agency } from '@/types';

interface CostPrediction {
  predicted_cost: number;
  confidence: string;
  cost_range: { low: number; high: number };
}

interface FoiaFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { agency_id: string; request_text: string; priority: string }) => Promise<void>;
}

export function FoiaForm({ isOpen, onClose, onSubmit }: FoiaFormProps) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [requestText, setRequestText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [costPrediction, setCostPrediction] = useState<CostPrediction | null>(null);
  const [roiProjection, setRoiProjection] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      agenciesApi.getAgencies()
        .then((data) => setAgencies(data.items || data || []))
        .catch((error) => {
          console.error('Failed to load agencies:', error);
          setAgencies([]);
        });
    }
  }, [isOpen]);

  // Fetch cost prediction when agency changes
  useEffect(() => {
    if (!agencyId) { setCostPrediction(null); setRoiProjection(null); return; }
    foiaApi.getCostPrediction({ agency_id: agencyId })
      .then((data) => {
        setCostPrediction(data);
        // Chain ROI projection from predicted cost
        if (data.predicted_cost > 0) {
          foiaApi.getRoiProjection({ predicted_cost: data.predicted_cost })
            .then(setRoiProjection)
            .catch(() => setRoiProjection(null));
        }
      })
      .catch(() => setCostPrediction(null));
  }, [agencyId]);

  const handleSubmit = async () => {
    if (!agencyId || !requestText) return;
    setSubmitting(true);
    try {
      await onSubmit({ agency_id: agencyId, request_text: requestText, priority });
      setAgencyId('');
      setRequestText('');
      setPriority('medium');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const agencyOptions = agencies.map(a => ({ value: a.id, label: a.name }));
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New FOIA Request" size="lg">
      <div className="space-y-3.5">
        <Select label="Agency" options={agencyOptions} value={agencyId} onChange={setAgencyId} placeholder="Select agency..." />
        <Select label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Request Text</label>
          <textarea
            className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary placeholder-text-quaternary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 min-h-[180px] transition-all duration-150"
            value={requestText}
            onChange={e => setRequestText(e.target.value)}
            placeholder="Enter your FOIA request text..."
          />
        </div>
        {/* Cost & ROI Prediction */}
        {costPrediction && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-surface-border bg-surface-tertiary/20 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="h-3.5 w-3.5 text-accent-amber" />
                <span className="text-2xs font-medium text-text-secondary">Estimated Cost</span>
              </div>
              <p className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(costPrediction.predicted_cost)}</p>
              <p className="text-2xs text-text-quaternary mt-0.5">
                {formatCurrency(costPrediction.cost_range.low)}–{formatCurrency(costPrediction.cost_range.high)} range
              </p>
              <p className="text-2xs text-text-quaternary capitalize">{costPrediction.confidence} confidence</p>
            </div>
            {roiProjection && (
              <div className="rounded-lg border border-surface-border bg-surface-tertiary/20 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-accent-emerald" />
                  <span className="text-2xs font-medium text-text-secondary">ROI Projection</span>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${roiProjection.roi_percentage >= 0 ? 'text-accent-emerald' : 'text-accent-red'}`}>
                  {roiProjection.roi_percentage >= 0 ? '+' : ''}{roiProjection.roi_percentage?.toFixed(0)}%
                </p>
                <p className="text-2xs text-text-quaternary mt-0.5">
                  Est. revenue: {formatCurrency(roiProjection.estimated_revenue || 0)}
                </p>
                <p className={`text-2xs font-medium mt-0.5 ${
                  roiProjection.recommendation === 'STRONG YES' ? 'text-accent-emerald' :
                  roiProjection.recommendation === 'YES' ? 'text-accent-primary' :
                  roiProjection.recommendation === 'MAYBE' ? 'text-accent-amber' : 'text-accent-red'
                }`}>
                  {roiProjection.recommendation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={!agencyId || !requestText}>
          Create Request
        </Button>
      </div>
    </Modal>
  );
}
