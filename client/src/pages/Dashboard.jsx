import { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from '../components/MapComponent';
import MetricCard   from '../components/MetricCard';
import '../styles/Dashboard.css';

const LEGEND = [
  { label:'Extremely Wet',    color:'#3b82f6' },
  { label:'Near Normal',      color:'#1ABC9C' },
  { label:'Moderate Drought', color:'#F39C12' },
  { label:'Severe Drought',   color:'#e67e22' },
  { label:'Extreme Drought',  color:'#E74C3C' },
];

function getSPEIColor(v) {
  if (v >= 1.0)  return '#3b82f6';
  if (v >= -1.0) return '#1ABC9C';
  if (v >= -1.5) return '#F39C12';
  if (v >= -2.0) return '#e67e22';
  return '#E74C3C';
}

function getRiskBarWidth(spei) {
  return Math.round((Math.abs(Math.max(-3, Math.min(0, spei))) / 3) * 100);
}

function formatSPEI(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}

/**
 * Given an anchor string "YYYY-MM" and a 0-based horizon index (0–5),
 * returns the label for that forecast month e.g. "May 26".
 */
function forecastLabel(anchor, horizonIdx) {
  if (!anchor) return `+${horizonIdx + 1}m`;
  const [y, m] = anchor.split('-').map(Number);
  const d = new Date(y, m - 1 + horizonIdx + 1, 1);
  return d.toLocaleString('default', { month:'short', year:'2-digit' });
}

function forecastRange(anchor, horizon) {
  if (!anchor) return `+1m – +${horizon}m`;
  return `${forecastLabel(anchor, 0)} – ${forecastLabel(anchor, horizon - 1)}`;
}

const MODEL_OPTIONS = [
  { key: 'gru_3m', label: 'GRU 3M', horizon: 3 },
  { key: 'gru_6m', label: 'GRU 6M', horizon: 6 },
  { key: 'transformer_3m', label: 'Transformer 3M', horizon: 3 },
  { key: 'transformer_6m', label: 'Transformer 6M', horizon: 6 },
];

export default function Dashboard({ onStateSelect, selectedPeriod, onPeriodChange, selectedModel, onModelChange }) {
  const [states,       setStates]       = useState([]);
  const [horizon,      setHorizon]      = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [periods,      setPeriods]      = useState([]);
  const [activeAnchor, setActiveAnchor] = useState(null); // resolved "YYYY-MM" from server
  const activeModel = MODEL_OPTIONS.find(m => m.key === selectedModel) || MODEL_OPTIONS[0];

  useEffect(() => {
    if (horizon > activeModel.horizon) setHorizon(activeModel.horizon);
  }, [activeModel.horizon, horizon]);

  // Load available periods once on mount
  useEffect(() => {
    axios.get('/api/data/available-periods')
      .then(r => {
        setPeriods(r.data.periods || []);
        // Auto-select the server default if nothing chosen yet
        if (!selectedPeriod && r.data.default_anchor) {
          onPeriodChange(r.data.default_anchor);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch map data whenever horizon or period changes
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ horizon, model_key: selectedModel || 'gru_3m' });
    if (selectedPeriod) params.set('anchor', selectedPeriod);
    axios.get(`/api/forecasts/latest?${params}`)
      .then(r => {
        setStates(r.data);
        if (r.data.length) setActiveAnchor(r.data[0].anchor || selectedPeriod);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [horizon, selectedPeriod, selectedModel]);

  // Summary stats
  const droughtStates = states.filter(s => s.spei < -1.0);
  const avgSPEI    = states.length
    ? (states.reduce((a, b) => a + b.spei, 0) / states.length).toFixed(2) : '—';
  const worst      = states.length ? [...states].sort((a,b) => a.spei-b.spei)[0] : null;
  const ranked     = [...states].sort((a,b) => a.spei-b.spei).slice(0, 12);
  const modelUsed  = states.length ? states[0].model_used : null;

  // The period picker display hint
  const activePeriodObj = periods.find(p => p.value === selectedPeriod);

  return (
    <div className="dashboard-container">

      {/* ── TOP HEADER ── */}
      <div className="dashboard-header">
        <div>
          <div className="section-title">Drought Forecast Dashboard</div>
          <div className="section-sub">
            Nigeria · {activeModel.label}
            {activeAnchor && (
              <span style={{ color:'var(--teal)', marginLeft:8 }}>
                · Data window ends: <strong>{activeAnchor}</strong>
                &nbsp;→ Predicting: <strong>
                  {forecastRange(activeAnchor, activeModel.horizon)}
                </strong>
              </span>
            )}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'flex-end', gap:20, flexWrap:'wrap' }}>

          {/* PERIOD SELECTOR */}
          <div className="period-selector">
            <span className="horizon-label">Prediction period:</span>
            <div className="period-select-wrap">
              <select
                className="period-select"
                value={selectedPeriod || ''}
                onChange={e => onPeriodChange(e.target.value || null)}
              >
                {periods.length === 0 && (
                  <option value="">Default (last complete month)</option>
                )}
                {periods.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}{p.has_ingested_data ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              {activePeriodObj && (
                <span className="period-select-hint">
                  → Predicts {forecastRange(activePeriodObj.value, activeModel.horizon)}
                </span>
              )}
              {!activePeriodObj && activeAnchor && (
                <span className="period-select-hint">
                  → Predicts {forecastRange(activeAnchor, activeModel.horizon)}
                </span>
              )}
            </div>
          </div>

          <div className="period-selector">
            <span className="horizon-label">Model:</span>
            <div className="period-select-wrap">
              <select className="period-select" value={selectedModel} onChange={e => { onModelChange(e.target.value); setHorizon(1); }}>
                {MODEL_OPTIONS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* HORIZON SELECTOR — shows real month names */}
          <div className="horizon-selector">
            <span className="horizon-label">Show month:</span>
            <div className="horizon-btns">
              {Array.from({ length: activeModel.horizon }, (_, i) => i).map(i => (
                <button
                  key={i}
                  className={`horizon-btn${horizon === i+1 ? ' active' : ''}`}
                  onClick={() => setHorizon(i + 1)}
                  title={`Forecast month +${i+1}`}
                >
                  {forecastLabel(activeAnchor, i)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODEL SOURCE BADGE ── */}
      {modelUsed && (
        <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{
            padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:600, letterSpacing:'0.04em',
            background: modelUsed === 'fallback' ? 'rgba(243,156,18,0.12)' : 'rgba(26,188,156,0.12)',
            border:     `1px solid ${modelUsed === 'fallback' ? 'rgba(243,156,18,0.3)' : 'rgba(26,188,156,0.3)'}`,
            color:      modelUsed === 'fallback' ? 'var(--amber)' : 'var(--teal)',
          }}>
            {modelUsed?.includes('fallback') ? '⚙ Deterministic Fallback' : `🧠 ${activeModel.label}`}
          </span>
          {modelUsed === 'fallback' && (
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              Start FastAPI with drought_transformer.pt to use real predictions
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" />Loading forecast data…</div>
      ) : (
        <>
          <div className="dashboard-metrics">
            <MetricCard
              label="Highest Risk State"
              value={worst?.name || '—'}
              sub={worst ? `Pred: ${formatSPEI(worst.spei)} · Real: ${formatSPEI(worst.current_spei)}` : ''}
              accent="danger"
            />
            <MetricCard label="Average SPEI" value={avgSPEI} sub="All 37 states" accent={parseFloat(avgSPEI) < -1 ? 'warn' : 'default'} />
            <MetricCard label="Drought States" value={droughtStates.length} sub="SPEI below −1.0" accent={droughtStates.length > 10 ? 'danger' : 'warn'} />
            <MetricCard label="Extreme Drought" value={states.filter(s => s.spei < -2.0).length} sub="SPEI below −2.0" accent="danger" />
          </div>

          <div className="dashboard-body">
            {/* MAP */}
            <div className="dashboard-map-panel">
              <div className="map-card">
                <div className="map-card-header">
                  <div className="map-card-title">
                    🗺 Nigeria Drought Map — {forecastLabel(activeAnchor, horizon - 1)}
                  </div>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>Click a state for details</span>
                </div>
                <div style={{ height:460 }}>
                  <MapComponent states={states} onStateClick={onStateSelect} />
                </div>
                <div className="map-legend">
                  {LEGEND.map(l => (
                    <div key={l.label} className="legend-item">
                      <div className="legend-dot" style={{ background:l.color }} />
                      <span>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RISK LIST */}
            <div className="risk-panel">
              <div className="risk-list-card">
                <div className="risk-list-header">
                  <div className="risk-list-title">🏴 Top Risk States</div>
                  <div className="risk-list-sub-wrap">
                    <div className="risk-list-sub">Ranked by SPEI · {forecastLabel(activeAnchor, horizon - 1)}</div>
                    <div className="risk-value-legend">
                      <span>Pred = forecast</span>
                      <span>Real = observed</span>
                    </div>
                  </div>
                </div>
                <div className="risk-list">
                  {ranked.map((s, i) => {
                    const color = getSPEIColor(s.spei);
                    const barW  = getRiskBarWidth(s.spei);
                    return (
                      <div key={s.pcode} className="risk-item" onClick={() => onStateSelect && onStateSelect(s)}>
                        <div className="risk-rank">{i + 1}</div>
                        <div className="risk-info">
                          <div className="risk-name">{s.name}</div>
                          <div className="risk-region">{s.region}</div>
                        </div>
                        <div className="risk-bar-wrap">
                          <div className="risk-bar-bg">
                            <div className="risk-bar-fill" style={{ width:`${barW}%`, background:color }} />
                          </div>
                        </div>
                        <div className="risk-spei-pair">
                          <div className="risk-spei" style={{ color }}>{formatSPEI(s.spei)}</div>
                          <div className="risk-spei-real">Real: {formatSPEI(s.current_spei)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
