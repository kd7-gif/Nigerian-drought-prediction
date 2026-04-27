import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/components.css';

export default function Header({ selectedModel }) {
  const [status, setStatus] = useState(null);
  const MODEL_LABELS = {
    gru_3m: 'GRU 3M',
    gru_6m: 'GRU 6M',
    transformer_3m: 'Transformer 3M',
    transformer_6m: 'Transformer 6M',
  };

  useEffect(() => {
    axios.get(`/api/status?model_key=${encodeURIComponent(selectedModel || 'gru_3m')}`)
      .then(r => setStatus(r.data))
      .catch(() => {});
    // Refresh every 30 seconds
    const t = setInterval(() => {
      axios.get(`/api/status?model_key=${encodeURIComponent(selectedModel || 'gru_3m')}`).then(r => setStatus(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [selectedModel]);

  const usingRealModel = status?.ml_service_online === true;
  const forecastPeriod = status?.forecast_period || '…';
  const activeModelLabel = MODEL_LABELS[selectedModel] || selectedModel || 'GRU 3M';

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">🌦</div>
        <div>
          <div className="header-title">Nigeria Drought Intelligence</div>
          <div className="header-sub">Forecast Platform · {selectedModel || 'gru_3m'}</div>
        </div>
      </div>

      <div className="header-status">
        {/* Live model source badge */}
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'4px 10px', borderRadius:20,
          background:  usingRealModel ? 'rgba(26,188,156,0.15)' : 'rgba(243,156,18,0.15)',
          border:`1px solid ${usingRealModel ? 'rgba(26,188,156,0.35)' : 'rgba(243,156,18,0.35)'}`,
          fontSize:11, fontWeight:600,
          color: usingRealModel ? 'var(--teal)' : 'var(--amber)',
        }}>
          <div style={{
            width:7, height:7, borderRadius:'50%',
            background: usingRealModel ? 'var(--teal)' : 'var(--amber)',
            animation:'pulse-dot 2s ease-in-out infinite',
          }} />
          {usingRealModel ? `🧠 ${activeModelLabel}` : `⚙ ${activeModelLabel} (Fallback)`}
        </div>

        <span style={{ color:'var(--text-muted)', margin:'0 6px' }}>·</span>
        <span style={{ fontSize:12, color:'var(--text-secondary)' }}>
          Predicting: <strong style={{ color:'var(--text-primary)' }}>{forecastPeriod}</strong>
        </span>
      </div>
    </header>
  );
}
