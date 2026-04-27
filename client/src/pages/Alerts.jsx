import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Alerts.css';

const SEVERITIES = ['All','Extreme Drought','Severe Drought','Moderate Drought','Near Normal'];

function getSPEIColor(v) {
  if (v >= -1.0) return '#1ABC9C';
  if (v >= -1.5) return '#F39C12';
  if (v >= -2.0) return '#e67e22';
  return '#E74C3C';
}
function getSPEILabel(v) {
  if (v >= -1.0) return 'Near Normal';
  if (v >= -1.5) return 'Moderate Drought';
  if (v >= -2.0) return 'Severe Drought';
  return 'Extreme Drought';
}

export default function Alerts({ onStateSelect, selectedPeriod, selectedModel }) {
  const [states,   setStates]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [severity, setSeverity] = useState('All');
  const [sortDir,  setSortDir]  = useState('asc');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedPeriod) params.set('anchor', selectedPeriod);
    params.set('model_key', selectedModel || 'gru_3m');
    const qs = `?${params.toString()}`;
    axios.get(`/api/forecasts/ranking${qs}`)
      .then(r => { setStates(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedPeriod, selectedModel]);

  const filtered = states
    .filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.region.toLowerCase().includes(search.toLowerCase());
      const matchSev    = severity === 'All' || getSPEILabel(s.avg_spei) === severity;
      return matchSearch && matchSev;
    })
    .sort((a,b) => sortDir === 'asc' ? a.avg_spei-b.avg_spei : b.avg_spei-a.avg_spei);

  const droughtCount = states.filter(s => s.avg_spei < -1.0).length;
  const severeCount  = states.filter(s => s.avg_spei < -1.5).length;
  const modelUsed    = states.length ? states[0].model_used : null;
  const anchor       = states.length ? states[0].anchor : null;

  return (
    <div className="alerts-container">
      <div className="section-title">Drought Alerts</div>
      <div className="section-sub">
        All 37 states ranked by average forecast SPEI
        {anchor && <span style={{ color:'var(--teal)', marginLeft:8 }}>· Period anchor: {anchor}</span>}
        {modelUsed && (
          <span style={{
            marginLeft:12, padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600,
            background: modelUsed==='fallback'?'rgba(243,156,18,0.12)':'rgba(26,188,156,0.12)',
            color: modelUsed==='fallback'?'var(--amber)':'var(--teal)',
          }}>
            {modelUsed==='fallback'?'⚙ Fallback':'🧠 Real model'}
          </span>
        )}
      </div>

      {/* Summary badges */}
      <div style={{ display:'flex', gap:12, marginBottom:24 }}>
        <div style={{ padding:'10px 18px', background:'rgba(231,76,60,0.12)', border:'1px solid rgba(231,76,60,0.25)', borderRadius:10, fontSize:13 }}>
          <span style={{ color:'var(--red)', fontWeight:700, fontSize:20, fontFamily:'var(--font-display)' }}>{severeCount}</span>
          <span style={{ color:'var(--text-secondary)', marginLeft:8 }}>Severe / Extreme</span>
        </div>
        <div style={{ padding:'10px 18px', background:'rgba(243,156,18,0.12)', border:'1px solid rgba(243,156,18,0.25)', borderRadius:10, fontSize:13 }}>
          <span style={{ color:'var(--amber)', fontWeight:700, fontSize:20, fontFamily:'var(--font-display)' }}>{droughtCount}</span>
          <span style={{ color:'var(--text-secondary)', marginLeft:8 }}>In Drought (SPEI &lt; −1)</span>
        </div>
        <div style={{ padding:'10px 18px', background:'rgba(26,188,156,0.10)', border:'1px solid rgba(26,188,156,0.2)', borderRadius:10, fontSize:13 }}>
          <span style={{ color:'var(--teal)', fontWeight:700, fontSize:20, fontFamily:'var(--font-display)' }}>{states.length - droughtCount}</span>
          <span style={{ color:'var(--text-secondary)', marginLeft:8 }}>Near Normal / Wet</span>
        </div>
      </div>

      <div className="alerts-toolbar">
        <div className="search-wrap">
          <span className="search-icon" style={{ color:'var(--text-muted)' }}>🔍</span>
          <input className="alerts-search" type="text" placeholder="Search state or region…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {SEVERITIES.map(s => (
          <button key={s} className={`alerts-filter-btn${severity===s?' active':''}`}
            onClick={() => setSeverity(s)}>{s}</button>
        ))}
        <button className="alerts-filter-btn" onClick={() => setSortDir(d => d==='asc'?'desc':'asc')} style={{ marginLeft:'auto' }}>
          Sort {sortDir==='asc'?'↑ Driest':'↓ Wettest'}
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />Loading rankings…</div>
      ) : (
        <div className="alerts-table-card">
          <table className="alerts-table">
            <thead>
              <tr>
                <th>#</th><th>State</th><th>Region</th>
                <th>Avg SPEI</th><th>Severity</th>
                <th style={{ width:120 }}>Risk</th><th>6-month forecast</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const color = getSPEIColor(s.avg_spei);
                const label = getSPEILabel(s.avg_spei);
                const barW  = Math.min(100, Math.round((Math.abs(Math.min(0, s.avg_spei)) / 3) * 100));
                return (
                  <tr key={s.pcode} onClick={() => onStateSelect && onStateSelect(s)}>
                    <td className="rank-cell">{i+1}</td>
                    <td className="state-cell">{s.name}</td>
                    <td style={{ color:'var(--text-muted)', fontSize:12 }}>{s.region}</td>
                    <td className="spei-cell" style={{ color }}>{s.avg_spei.toFixed(3)}</td>
                    <td><span className="badge" style={{ background:color+'22', color, fontSize:11 }}>{label}</span></td>
                    <td className="spei-bar-cell">
                      <div className="spei-bar"><div className="spei-bar-fill" style={{ width:`${barW}%`, background:color }} /></div>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:3 }}>
                        {(s.forecast||[]).slice(0,6).map((v,j) => (
                          <div key={j} style={{ width:10, height:10, borderRadius:2, background:getSPEIColor(v), opacity:0.75 }}
                            title={`+${j+1}m: ${v.toFixed(2)}`} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--text-muted)', padding:32 }}>No states match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
