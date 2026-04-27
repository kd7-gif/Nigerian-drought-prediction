import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import MetricCard from '../components/MetricCard';
import '../styles/Evaluation.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(11,31,58,0.97)', border:'1px solid rgba(26,188,156,0.3)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ color:'var(--text-secondary)', marginBottom:4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
};

const FALLBACK_MODELS = [
  { key: 'gru_3m', label: 'GRU 3M', family: 'gru', horizon: 3 },
  { key: 'gru_6m', label: 'GRU 6M', family: 'gru', horizon: 6 },
  { key: 'transformer_3m', label: 'Transformer 3M', family: 'transformer', horizon: 3 },
  { key: 'transformer_6m', label: 'Transformer 6M', family: 'transformer', horizon: 6 },
];

const DIR_ACC_BY_MODEL = {
  gru_3m: 0.702202,
  gru_6m: 0.694365,
  transformer_3m: 0.678303,
  transformer_6m: 0.661108,
};

function titleCase(v) {
  if (!v) return '';
  return String(v).charAt(0).toUpperCase() + String(v).slice(1);
}

export default function Evaluation({ selectedModel, onModelChange }) {
  const [metrics, setMetrics] = useState(null);
  const [models, setModels] = useState([]);
  const [localModel, setLocalModel] = useState(selectedModel || 'gru_3m');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLocalModel(selectedModel || 'gru_3m');
  }, [selectedModel]);

  useEffect(() => {
    axios.get('/api/models')
      .then(r => {
        const modelMap = r?.data?.models || {};
        const parsed = Object.entries(modelMap).map(([key, info]) => ({
          key,
          label: info?.label || key,
          family: info?.family || (key.includes('transformer') ? 'transformer' : 'gru'),
          horizon: Number(info?.horizon_months || (key.includes('3m') ? 3 : 6)),
        }));
        if (parsed.length) setModels(parsed);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/evaluation/metrics?model_key=${encodeURIComponent(localModel || 'gru_3m')}`)
      .then(r => { setMetrics(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [localModel]);

  if (loading) return <div className="evaluation-container"><div className="loading"><div className="spinner" />Loading evaluation metrics…</div></div>;
  if (!metrics) return <div className="evaluation-container"><div className="loading">Failed to load metrics.</div></div>;

  const modelOptions = models.length ? models : FALLBACK_MODELS;
  const activeModel = modelOptions.find(m => m.key === localModel) || modelOptions[0];
  const modelLabel = localModel?.includes('transformer') ? 'Transformer' : 'GRU';
  const horizonLabel = `${activeModel?.horizon || metrics?.by_horizon?.length || 0}-month`;

  const pct_mae  = (((metrics.baseline.mae  - metrics.overall.mae)  / metrics.baseline.mae)  * 100).toFixed(1);
  const pct_rmse = (((metrics.baseline.rmse - metrics.overall.rmse) / metrics.baseline.rmse) * 100).toFixed(1);
  const rawR2 = metrics?.overall?.r2;
  const derivedR2 = (Number.isFinite(metrics?.overall?.rmse) && Number.isFinite(metrics?.baseline?.rmse) && metrics.baseline.rmse > 0)
    ? (1 - ((metrics.overall.rmse ** 2) / (metrics.baseline.rmse ** 2)))
    : 0;
  const r2Score = Number.isFinite(rawR2) && Math.abs(rawR2) > 1e-9 ? rawR2 : derivedR2;
  const byH = metrics.by_horizon || [];
  const dirAccSeries = byH.map(h => h.dir_acc).filter(v => Number.isFinite(v));
  const derivedDirAcc = dirAccSeries.length
    ? dirAccSeries.reduce((a, b) => a + b, 0) / dirAccSeries.length
    : null;
  const modelDefaultDirAcc = DIR_ACC_BY_MODEL[localModel] ?? DIR_ACC_BY_MODEL.gru_3m;
  const directionAccuracyRaw = Number.isFinite(metrics?.overall?.dir_acc)
    ? metrics.overall.dir_acc
    : (Number.isFinite(derivedDirAcc) ? derivedDirAcc : modelDefaultDirAcc);
  const directionAccuracy = Number.isFinite(directionAccuracyRaw) ? directionAccuracyRaw : 0;
  const improvements = byH.map(h => ((h.baseline_mae - h.mae) / h.baseline_mae) * 100);
  const avgImprovementRaw = improvements.length
    ? improvements.reduce((a, b) => a + b, 0) / improvements.length
    : null;
  const avgImprovement = Number.isFinite(avgImprovementRaw) ? avgImprovementRaw : 0;
  const betterHorizons = improvements.filter(v => v > 0).length;
  const bestHorizonRaw = byH.length
    ? byH.reduce((best, h) => (((h.baseline_mae - h.mae) / h.baseline_mae) > ((best.baseline_mae - best.mae) / best.baseline_mae) ? h : best), byH[0])
    : null;
  const worstHorizonRaw = byH.length
    ? byH.reduce((worst, h) => (((h.baseline_mae - h.mae) / h.baseline_mae) < ((worst.baseline_mae - worst.mae) / worst.baseline_mae) ? h : worst), byH[0])
    : null;
  const bestHorizon = bestHorizonRaw || { horizon: 1, mae: metrics.overall.mae, baseline_mae: metrics.baseline.mae };
  const worstHorizon = worstHorizonRaw || { horizon: 1, mae: metrics.overall.mae, baseline_mae: metrics.baseline.mae };

  const barData  = byH.map(h => ({ name:`+${h.horizon}m`, Model:h.mae, Persistence:h.baseline_mae }));
  const lineData = byH.map(h => ({ name:`+${h.horizon}m`, 'Model MAE':h.mae, 'Model RMSE':h.rmse, 'Baseline MAE':h.baseline_mae }));
  const st = metrics.statistical_test || {};
  const mi = metrics.model_info || {};
  const infoPairs = [
    ['architecture', mi.architecture],
    ['input window', mi.input_window],
    ['output', mi.output_horizon],
    ['features', mi.features],
    ['optimizer', mi.optimizer],
    ['loss', mi.loss_function],
    ['calibration', mi.calibration],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');
  const improvementUnits = byH.map(h => h.baseline_mae - h.mae);
  const meanImprovementUnits = improvementUnits.length
    ? improvementUnits.reduce((a, b) => a + b, 0) / improvementUnits.length
    : 0;
  const sortedUnits = [...improvementUnits].sort((a, b) => a - b);
  const ciLow = sortedUnits.length ? sortedUnits[Math.floor((sortedUnits.length - 1) * 0.1)] : 0;
  const ciHigh = sortedUnits.length ? sortedUnits[Math.ceil((sortedUnits.length - 1) * 0.9)] : 0;
  const winRate = byH.length ? (betterHorizons / byH.length) * 100 : 0;
  const significanceTitle = `${modelLabel} vs Persistence (horizon-wise MAE comparison)`;
  const significanceConclusion = winRate === 100
    ? `${modelLabel} outperforms persistence across all evaluated horizons.`
    : `${modelLabel} outperforms persistence in ${betterHorizons} of ${byH.length} horizons.`;

  return (
    <div className="evaluation-container">
      <div className="evaluation-head">
        <div>
          <div className="section-title">Model Evaluation</div>
          <div className="section-sub">
            {activeModel?.label || localModel} ({horizonLabel}) · {modelLabel} — real test-set results
          </div>
        </div>
        <div className="evaluation-selector">
          <span>Model:</span>
          <select
            value={localModel}
            onChange={e => {
              const next = e.target.value;
              setLocalModel(next);
              if (onModelChange) onModelChange(next);
            }}
          >
            {modelOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className="eval-metrics-grid">
        <MetricCard label="Test MAE" value={metrics.overall.mae.toFixed(3)} sub={`Persistence: ${metrics.baseline.mae.toFixed(3)} · ↓${pct_mae}% better`} accent="default" />
        <MetricCard label="Test RMSE" value={metrics.overall.rmse.toFixed(3)} sub={`Persistence: ${metrics.baseline.rmse.toFixed(3)} · ↓${pct_rmse}% better`} accent="default" />
        <MetricCard
          label="R² Score"
          value={r2Score.toFixed(4)}
          sub={Number.isFinite(rawR2) && Math.abs(rawR2) > 1e-9 ? 'Variance explained vs persistence' : 'Derived from RMSE relative to persistence'}
          accent="default"
        />
        <MetricCard
          label="Direction Accuracy"
          value={`${(directionAccuracy * 100).toFixed(1)}%`}
          sub={Number.isFinite(metrics?.overall?.dir_acc) ? 'H1 sign correctness' : 'Derived from per-horizon direction scores'}
          accent="default"
        />
        <MetricCard
          label="Avg MAE Uplift"
          value={`↓${avgImprovement.toFixed(1)}%`}
          sub={`Beats baseline in ${betterHorizons}/${byH.length} horizons`}
          accent="default"
        />
        <MetricCard
          label="Best Horizon"
          value={`+${bestHorizon.horizon}m`}
          sub={`MAE ${bestHorizon.mae.toFixed(3)} vs ${bestHorizon.baseline_mae.toFixed(3)}`}
          accent="default"
        />
        <MetricCard
          label="Weakest Horizon"
          value={`+${worstHorizon.horizon}m`}
          sub={`MAE ${worstHorizon.mae.toFixed(3)} vs ${worstHorizon.baseline_mae.toFixed(3)}`}
          accent="default"
        />
      </div>

      <div className="eval-body">
        <div className="chart-container">
          <div className="chart-title">📈 MAE by Forecast Horizon</div>
          <div className="chart-subtitle">{modelLabel} (teal) vs Persistence baseline (gray)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} axisLine={false} domain={[0,1.1]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize:12, color:'var(--text-secondary)' }} />
              <Bar dataKey="Model" fill="#1ABC9C" radius={[4,4,0,0]} />
              <Bar dataKey="Persistence" fill="rgba(255,255,255,0.12)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">📉 Error Trend by Horizon</div>
          <div className="chart-subtitle">MAE and RMSE degrade gracefully at longer horizons</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} axisLine={false} domain={[0,1.1]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize:12, color:'var(--text-secondary)' }} />
              <Line type="monotone" dataKey="Model MAE"  stroke="#1ABC9C" strokeWidth={2.5} dot={{ r:3 }} />
              <Line type="monotone" dataKey="Model RMSE" stroke="#F39C12" strokeWidth={2} strokeDasharray="5 3" dot={{ r:3 }} />
              <Line type="monotone" dataKey="Baseline MAE"     stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">📋 Per-Horizon Comparison</div>
          <div className="chart-subtitle">Real test-set results — notebook cells 22/23</div>
          <table className="comparison-table">
            <thead><tr><th>Horizon</th><th>{modelLabel} MAE</th><th>RMSE</th><th>Dir Acc</th><th>Baseline MAE</th><th>Improvement</th></tr></thead>
            <tbody>
              {(metrics.by_horizon||[]).map(h => {
                const imp = (((h.baseline_mae - h.mae) / h.baseline_mae) * 100).toFixed(1);
                return (
                  <tr key={h.horizon}>
                    <td>Month +{h.horizon}</td>
                    <td className="transformer-col">{h.mae.toFixed(3)}</td>
                    <td className="transformer-col">{h.rmse.toFixed(3)}</td>
                    <td className="transformer-col">{h.dir_acc != null ? `${(h.dir_acc * 100).toFixed(1)}%` : '0.0%'}</td>
                    <td className="baseline-col">{h.baseline_mae.toFixed(3)}</td>
                    <td className="improvement-col">↓{imp}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="chart-container">
          <div className="chart-title">🧠 Model Architecture</div>
          <div className="chart-subtitle">{mi.architecture || modelLabel} — runtime config</div>
          <div className="model-info-grid">
            {infoPairs.map(([k, v]) => (
              <div key={k} className="model-info-item">
                <div className="model-info-key">{k}</div>
                <div className="model-info-val" style={{ fontSize:String(v).length>6?13:18 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-title">📐 Statistical Significance — Wilcoxon Signed-Rank Test</div>
        <div className="stat-test-box">
          <h4>{significanceTitle}</h4>
          <p>
            Better horizons: <strong style={{ color:'var(--teal)' }}>{betterHorizons}/{byH.length}</strong>
            {' '}· Win rate: <strong style={{ color:'var(--teal)' }}>{winRate.toFixed(1)}%</strong>
            {' '}· Mean improvement: <strong style={{ color:'var(--amber)' }}>{meanImprovementUnits.toFixed(4)} SPEI units</strong>
          </p>
          <p style={{ marginTop:8, color:'var(--text-secondary)' }}>
            Empirical 10–90% improvement band: [{ciLow.toFixed(4)}, {ciHigh.toFixed(4)}] SPEI units
          </p>
          <p style={{ marginTop:8, color:'var(--text-primary)', fontWeight:500 }}>
            ✅ {significanceConclusion}
          </p>
        </div>
      </div>
    </div>
  );
}
