import { useState, useEffect } from 'react';
import axios from 'axios';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import '../styles/Explorer.css';

function getSPEIColor(v) {
  if (v >= 1.0)  return '#3b82f6';
  if (v >= -1.0) return '#1ABC9C';
  if (v >= -1.5) return '#F39C12';
  if (v >= -2.0) return '#e67e22';
  return '#E74C3C';
}
function getSPEILabel(v) {
  if (v >= 1.0)  return 'Moderately Wet';
  if (v >= -1.0) return 'Near Normal';
  if (v >= -1.5) return 'Moderate Drought';
  if (v >= -2.0) return 'Severe Drought';
  return 'Extreme Drought';
}

function forecastLabels(anchor, horizon = 6) {
  if (!anchor) return Array.from({ length: horizon }, (_, i) => `M+${i + 1}`);
  const [y, m] = anchor.split('-').map(Number);
  return Array.from({ length:horizon }, (_, i) => {
    const d = new Date(y, m - 1 + i + 1, 1);
    return d.toLocaleString('default', { month:'short', year:'2-digit' });
  });
}

function forecastRange(months) {
  if (!months?.length) return '';
  return `${months[0]}–${months[months.length - 1]}`;
}

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

export default function Explorer({ selectedPeriod, selectedModel }) {
  const [stateList, setStateList] = useState([]);
  const [stateA,    setStateA]    = useState('NG008');
  const [stateB,    setStateB]    = useState('NG020');
  const [dataA,     setDataA]     = useState(null);
  const [dataB,     setDataB]     = useState(null);

  const params = new URLSearchParams();
  if (selectedPeriod) params.set('anchor', selectedPeriod);
  params.set('model_key', selectedModel || 'gru_3m');
  const qs = `?${params.toString()}`;

  useEffect(() => {
    axios.get(`/api/states${qs}`)
      .then(r => setStateList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setStateList([]));
  }, [selectedPeriod, selectedModel]);

  useEffect(() => {
    if (stateA) {
      axios.get(`/api/states/${stateA}${qs}`)
        .then(r => setDataA(r.data || null))
        .catch(() => setDataA(null));
    }
  }, [stateA, selectedPeriod, selectedModel]);

  useEffect(() => {
    if (stateB) {
      axios.get(`/api/states/${stateB}${qs}`)
        .then(r => setDataB(r.data || null))
        .catch(() => setDataB(null));
    }
  }, [stateB, selectedPeriod, selectedModel]);

  const anchor = dataA?.anchor || dataB?.anchor || selectedPeriod;
  const horizon = dataA?.forecast?.length || dataB?.forecast?.length || (selectedModel?.includes('_3m') ? 3 : 6);
  const MONTHS = forecastLabels(anchor, horizon);
  const keyA = dataA?.name || 'State A';
  const keyB = dataB?.name || 'State B';

  const radarData = MONTHS.map((m, i) => {
    const obj = { month: m };
    if (dataA) obj[keyA] = Number.isFinite(dataA.forecast?.[i]) ? dataA.forecast[i] : null;
    if (dataB) obj[keyB] = Number.isFinite(dataB.forecast?.[i]) ? dataB.forecast[i] : null;
    return obj;
  });

  const lineData = MONTHS.map((m, i) => {
    const obj = { month: m };
    if (dataA) obj[keyA] = Number.isFinite(dataA.forecast?.[i]) ? dataA.forecast[i] : null;
    if (dataB) obj[keyB] = Number.isFinite(dataB.forecast?.[i]) ? dataB.forecast[i] : null;
    return obj;
  });
  const hasComparableSeries = dataA && dataB && lineData.length > 0 && lineData.some(
    row => Number.isFinite(row[keyA]) || Number.isFinite(row[keyB]),
  );

  return (
    <div className="explorer-container">
      <div className="section-title">Forecast Explorer</div>
      <div className="section-sub">
        Compare SPEI forecasts for any two states
        {anchor && <span style={{ color:'var(--teal)', marginLeft:8 }}>· Anchor: {anchor} → {forecastRange(MONTHS)}</span>}
      </div>

      <div className="explorer-controls">
        <div className="ctrl-group">
          <label className="ctrl-label">State A</label>
          <select className="ctrl-select" value={stateA} onChange={e => setStateA(e.target.value)}>
            {stateList.map(s => <option key={s.pcode} value={s.pcode}>{s.name}</option>)}
          </select>
        </div>
        <div className="ctrl-group">
          <label className="ctrl-label">State B</label>
          <select className="ctrl-select" value={stateB} onChange={e => setStateB(e.target.value)}>
            {stateList.map(s => <option key={s.pcode} value={s.pcode}>{s.name}</option>)}
          </select>
        </div>
        <div className="ctrl-group">
          <label className="ctrl-label">&nbsp;</label>
          <span style={{ fontSize:12, color:'var(--text-secondary)', paddingTop:10 }}>Updates automatically</span>
        </div>
      </div>

      <div className="explorer-results">
        {[dataA, dataB].map((d, idx) => {
          if (!d) return <div key={idx} className="card"><div className="loading"><div className="spinner" /></div></div>;
          const spei  = d.forecast?.[0] ?? 0;
          const color = getSPEIColor(spei);
          return (
            <div key={idx} className="card">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>{d.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{d.region} · {d.pcode}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:800, color, lineHeight:1 }}>{spei.toFixed(2)}</div>
                  <div style={{ fontSize:11, color, marginTop:4 }}>{getSPEILabel(spei)}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.max(horizon, 1)},1fr)`, gap:6 }}>
                {(Array.isArray(d.forecast) ? d.forecast : []).map((v,i) => {
                  const c = getSPEIColor(v);
                  return (
                    <div key={i} style={{ textAlign:'center', padding:'8px 4px', background:'rgba(17,45,78,0.6)', borderRadius:8, border:`1px solid ${c}44` }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:3 }}>{MONTHS[i]}</div>
                      <div style={{ fontSize:15, fontWeight:800, fontFamily:'var(--font-display)', color:c }}>{v.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="chart-container explorer-full">
          <div className="chart-title">🕸 Radar Comparison</div>
          <div className="chart-subtitle">{horizon}-month SPEI shape — outer = wetter</div>
          {hasComparableSeries ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                <Tooltip content={<CustomTooltip />} />
                {dataA && <Radar name={keyA} dataKey={keyA} stroke="#1ABC9C" fill="#1ABC9C" fillOpacity={0.15} strokeWidth={2} />}
                {dataB && <Radar name={keyB} dataKey={keyB} stroke="#F39C12" fill="#F39C12" fillOpacity={0.15} strokeWidth={2} />}
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-subtitle" style={{ marginTop: 10 }}>Waiting for comparable forecast data…</div>
          )}
          <div style={{ display:'flex', gap:20, justifyContent:'center', marginTop:8 }}>
            {dataA && <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)' }}><div style={{ width:12, height:12, borderRadius:2, background:'#1ABC9C' }} />{keyA}</div>}
            {dataB && <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)' }}><div style={{ width:12, height:12, borderRadius:2, background:'#F39C12' }} />{keyB}</div>}
          </div>
        </div>

        {hasComparableSeries && (
          <div className="chart-container explorer-full">
            <div className="chart-title">📈 SPEI Trajectory — {forecastRange(MONTHS)}</div>
            <div className="chart-subtitle">Side-by-side forecast comparison</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData} margin={{ top:4, right:16, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} />
                <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(1)} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey={keyA} stroke="#1ABC9C" strokeWidth={2.5} dot={{ r:4, fill:'#1ABC9C' }} activeDot={{ r:6 }} connectNulls />
                <Line type="monotone" dataKey={keyB} stroke="#F39C12" strokeWidth={2.5} dot={{ r:4, fill:'#F39C12' }} activeDot={{ r:6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
