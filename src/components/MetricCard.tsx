import type { DeltaResult, DeltaFormat } from '../types/analytics';

// ─── DeltaBadge ─────────────────────────────────────────────────────────────

interface DeltaBadgeProps {
  delta: DeltaResult;
  format?: DeltaFormat;
  /** Invert colors: negative delta shown in green (lower stddev is positive) */
  invertColor?: boolean;
  precision?: number;
}

export function DeltaBadge({ delta, format = 'number', invertColor = false, precision = 2 }: DeltaBadgeProps) {
  const isPositive = delta.direction === 'up';
  const isNegative = delta.direction === 'down';
  const isStable = delta.direction === 'stable';

  let color: string;
  if (isStable) {
    color = '#8392a5';
  } else if (invertColor) {
    color = isNegative ? '#22d273' : '#dc3545';
  } else {
    color = isPositive ? '#22d273' : '#dc3545';
  }

  const arrow = isPositive ? '▲' : isNegative ? '▼' : '=';
  const sign = delta.value > 0 ? '+' : '';

  let formatted: string;
  switch (format) {
    case 'percent':
      formatted = `${sign}${delta.value.toFixed(1)} pts`;
      break;
    case 'rank':
      formatted = `${sign}${Math.round(delta.value)} place${Math.abs(delta.value) !== 1 ? 's' : ''}`;
      break;
    default:
      formatted = `${sign}${delta.value.toFixed(precision)}`;
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium" style={{ color }}>
      {arrow} {formatted} <span className="opacity-70">vs {delta.reference}</span>
    </span>
  );
}

// ─── MetricCard ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  color?: string;
  bg?: string;
  deltas?: {
    delta: DeltaResult;
    format?: DeltaFormat;
    invertColor?: boolean;
  }[];
}

export default function MetricCard({
  label, value, suffix, icon, color = '#06072d', bg, deltas,
}: MetricCardProps) {
  return (
    <div className="card-cassie p-4">
      {icon && (
        <div className="inline-flex p-2 rounded mb-2" style={{ background: bg, color }}>
          {icon}
        </div>
      )}
      <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#8392a5' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: '#06072d', fontFamily: "'Oswald', sans-serif" }}>
        {value}{suffix && <span className="text-sm font-normal text-gray-400">{suffix}</span>}
      </p>
      {deltas && deltas.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-1">
          {deltas.map((d, i) => (
            <DeltaBadge key={i} delta={d.delta} format={d.format} invertColor={d.invertColor} />
          ))}
        </div>
      )}
    </div>
  );
}
