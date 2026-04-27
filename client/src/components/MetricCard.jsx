import '../styles/components.css';

export default function MetricCard({ label, value, sub, accent }) {
  const cls = accent === 'warn' ? 'metric-warn' : accent === 'danger' ? 'metric-danger' : 'metric-accent';
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${cls}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
