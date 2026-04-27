import '../styles/components.css';

function getSPEIColor(v) {
  if (v >= -1.0) return 'var(--teal)';
  if (v >= -1.5) return 'var(--amber)';
  if (v >= -2.0) return 'var(--orange)';
  return 'var(--red)';
}

export default function StateCard({ state, onClick }) {
  const spei  = state.current_spei ?? state.avg_spei ?? state.spei ?? 0;
  const color = getSPEIColor(spei);
  return (
    <div className="state-card" onClick={() => onClick && onClick(state)}>
      <div>
        <div className="state-card-name">{state.name}</div>
        <div className="state-card-region">{state.region}</div>
      </div>
      <div className="state-card-spei" style={{ color }}>{spei.toFixed(2)}</div>
    </div>
  );
}
