import { useState, useEffect } from 'react';
import axios from 'axios';
import ForecastChart from '../components/ForecastChart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import '../styles/StateDetail.css';

function getSPEIColor(v) {
  if (v >= 1.0)  return '#3b82f6';
  if (v >= -1.0) return '#1ABC9C';
  if (v >= -1.5) return '#F39C12';
  if (v >= -2.0) return '#e67e22';
  return '#E74C3C';
}
function getSPEILabel(v) {
  if (v >= 2.0)  return 'Extremely Wet';
  if (v >= 1.5)  return 'Very Wet';
  if (v >= 1.0)  return 'Moderately Wet';
  if (v >= -1.0) return 'Near Normal';
  if (v >= -1.5) return 'Moderate Drought';
  if (v >= -2.0) return 'Severe Drought';
  return 'Extreme Drought';
}

// Compute the 6 forecast month labels from the anchor string "YYYY-MM"
function forecastLabels(anchor, horizon = 6) {
  if (!anchor) return Array.from({ length: horizon }, (_, i) => `M+${i + 1}`);
  const [y, m] = anchor.split('-').map(Number);
  return Array.from({ length:horizon }, (_, i) => {
    const d = new Date(y, m - 1 + i + 1, 1);
    return d.toLocaleString('default', { month:'short', year:'2-digit' });
  });
}

function formatSPEI(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(11,31,58,0.97)', border:'1px solid rgba(26,188,156,0.3)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ color:'var(--text-secondary)', marginBottom:4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function StateDetail({ state, selectedPeriod, selectedModel, onBack }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedPeriod) params.set('anchor', selectedPeriod);
    params.set('model_key', selectedModel || 'gru_3m');
    const qs = `?${params.toString()}`;
    axios.get(`/api/states/${state.pcode}${qs}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [state, selectedPeriod, selectedModel]);

  if (!state) return (
    <div className="state-detail-container">
      <div className="loading">Select a state from the dashboard map or alerts page.</div>
    </div>
  );
  if (loading) return (
    <div className="state-detail-container">
      <div className="loading"><div className="spinner" />Loading state data…</div>
    </div>
  );

  const anchor    = data?.anchor || selectedPeriod;
  const labels    = forecastLabels(anchor, data?.forecast?.length || 6);
  const spei      = data?.forecast?.[0] ?? 0;
  const realSPEI  = data?.current_spei;
  const monthComparisons = (data?.forecast_with_real && data.forecast_with_real.length)
    ? data.forecast_with_real
    : (data?.forecast || []).map((predicted, i) => ({
      horizon: i + 1,
      predicted,
      observed: i === 0 ? realSPEI : null,
    }));
  const observedTimeline = data?.observed_until_latest || [];
  const latestObservedAnchor = data?.latest_observed_anchor || anchor;
  const color     = getSPEIColor(spei);
  const label     = getSPEILabel(spei);
  const climData  = (data?.historical || []).slice(-12).map(h => ({
    month: h.month_label, rainfall: h.rainfall, temp: h.temperature, pet: h.pet,
  }));

  return (
    <div className="state-detail-container">
      <button className="btn" style={{ marginBottom:20 }} onClick={onBack}>← Back to Dashboard</button>

      {/* HERO */}
      <div className="state-detail-hero">
        <div className="state-hero-icon">🏛</div>
        <div className="state-hero-info">
          <div className="state-hero-name">{data?.name}</div>
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:4 }}>{data?.region} Region · Nigeria</div>
          <div className="state-hero-meta">
            <div className="state-hero-meta-item">📍 {data?.lat?.toFixed(2)}°N, {data?.lng?.toFixed(2)}°E</div>
            <div className="state-hero-meta-item">📅 Data window ending: <strong>{anchor || 'default'}</strong></div>
            {data?.model_used && (
              <div className="state-hero-meta-item">
                <span style={{ color: data.model_used === 'fallback' ? 'var(--amber)' : 'var(--teal)' }}>
                  {data.model_used === 'fallback' ? '⚙ Fallback' : '🧠 Real model'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div className="state-spei-value" style={{ color }}>{formatSPEI(spei, 3)}</div>
          <div className="state-spei-label">Pred SPEI · {labels[0]}</div>
          <div className="state-spei-real">Real (observed): {formatSPEI(realSPEI, 3)}</div>
          <div style={{ marginTop:8 }}>
            <span className="badge" style={{ background:color+'22', color }}>{label}</span>
          </div>
        </div>
      </div>

      {/* 6-MONTH FORECAST CARDS */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="chart-title" style={{ marginBottom:16 }}>
          📅 {labels.length}-Month SPEI Forecast · {labels[0]} – {labels[labels.length - 1]}
        </div>
        <div className="forecast-month-list">
          {monthComparisons.map((row, i) => {
            const c = getSPEIColor(row.predicted);
            return (
              <div key={i} className="forecast-month-card">
                <div className="fm-month">{labels[i]}</div>
                <div className="fm-value" style={{ color:c }}>Pred: {formatSPEI(row.predicted)}</div>
                <div className="fm-real">Real: {formatSPEI(row.observed)}</div>
                <div className="fm-cat" style={{ color:c }}>{getSPEILabel(row.predicted)}</div>
              </div>
            );
          })}
        </div>
        <div className="explanation-box" style={{ marginTop:16 }}>
          <h4>🔍 Interpretation</h4>
          <p>
            Using 24 months of climate data ending {anchor || 'now'}, the selected model predicts
            {spei < -1.5 ? ' severe to extreme drought' : spei < -1.0 ? ' moderate drought' : ' near-normal to wet conditions'}
            &nbsp;for {data?.name} over the period {labels[0]}–{labels[labels.length - 1]}.
            SPEI values below −1.0 indicate drought; below −2.0 indicates extreme drought.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom:20 }}>
        <div className="chart-title" style={{ marginBottom:8 }}>
          📊 Observed SPEI Through Latest Dataset Month
        </div>
        <div className="chart-subtitle" style={{ marginBottom:14 }}>
          Real values after {anchor || 'selected anchor'} up to {latestObservedAnchor}
        </div>
        {observedTimeline.length ? (
          <div className="observed-month-list">
            {observedTimeline.map((row, i) => {
              const c = getSPEIColor(row.spei);
              return (
                <div key={`${row.month_key}-${i}`} className="forecast-month-card observed-month-card">
                  <div className="fm-month">{row.month_label}</div>
                  <div className="fm-value" style={{ color:c }}>Real: {formatSPEI(row.spei)}</div>
                  <div className="fm-cat" style={{ color:c }}>{getSPEILabel(row.spei)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="state-hero-meta-item">
            No observed months available after this anchor yet.
          </div>
        )}
      </div>

      {/* CHARTS */}
      <div className="state-detail-grid">
        <ForecastChart
          historical={data?.historical || []}
          forecast={data?.forecast || []}
          anchorDate={anchor}
          title="Historical + Forecast SPEI"
          subtitle={`24 months historical (teal) + ${labels.length} months forecast (amber dashed)`}
        />

        <div className="chart-container">
          <div className="chart-title">🌧 Rainfall (mm)</div>
          <div className="chart-subtitle">Last 12 months</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={climData} margin={{ top:4, right:8, left:-16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:10 }} tickLine={false} interval={2} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rainfall" name="Rainfall mm" fill="#1ABC9C" radius={[3,3,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">🌡 Temperature (°C)</div>
          <div className="chart-subtitle">Last 12 months</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={climData} margin={{ top:4, right:8, left:-16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:10 }} tickLine={false} interval={2} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} tickLine={false} axisLine={false} domain={['auto','auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="temp" name="Temp °C" stroke="#F39C12" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">💧 Potential Evapotranspiration</div>
          <div className="chart-subtitle">PET (mm/month) — last 12 months</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={climData} margin={{ top:4, right:8, left:-16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:10 }} tickLine={false} interval={2} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} tickLine={false} axisLine={false} domain={['auto','auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="pet" name="PET mm" stroke="#e67e22" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
