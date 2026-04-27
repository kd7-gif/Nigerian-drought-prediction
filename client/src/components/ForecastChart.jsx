import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer
} from 'recharts';
import '../styles/components.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(11,31,58,0.97)', border:'1px solid rgba(26,188,156,0.3)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ color:'var(--text-secondary)', marginBottom:6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
};

/**
 * anchorDate: "YYYY-MM" string from the API response (e.g. "2026-03")
 * The 6 forecast labels are the 6 months AFTER the anchor.
 * Falls back to new Date() if anchorDate not supplied.
 */
export default function ForecastChart({ historical = [], forecast = [], title, subtitle, anchorDate = null }) {
  const histData = historical.map(h => ({
    month: h.month_label,
    historical: h.spei,
  }));

  // Derive forecast month labels from the anchor date
  const forecastMonths = Array.from({ length: 6 }, (_, i) => {
    if (anchorDate && /^\d{4}-\d{2}$/.test(anchorDate)) {
      const [y, m] = anchorDate.split('-').map(Number);
      const d = new Date(y, m - 1 + i + 1, 1);
      return d.toLocaleString('default', { month:'short', year:'2-digit' });
    }
    // Fallback: compute from today
    const d = new Date();
    d.setMonth(d.getMonth() + i + 1, 1);
    return d.toLocaleString('default', { month:'short', year:'2-digit' });
  });

  const forecastData = forecast.map((v, i) => ({
    month:    forecastMonths[i],
    forecast: v,
  }));

  const allData = [...histData, ...forecastData];

  return (
    <div className="chart-container">
      {title    && <div className="chart-title">{title}</div>}
      {subtitle && <div className="chart-subtitle">{subtitle}</div>}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={allData} margin={{ top:8, right:16, left:-10, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} axisLine={{ stroke:'rgba(255,255,255,0.08)' }} interval={3} />
          <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(1)} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize:12, color:'var(--text-secondary)' }} />
          <ReferenceLine y={0}    stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
          <ReferenceLine y={-1}   stroke="rgba(243,156,18,0.3)"  strokeDasharray="3 3" label={{ value:'Moderate', position:'right', fill:'var(--amber)', fontSize:10 }} />
          <ReferenceLine y={-1.5} stroke="rgba(231,76,60,0.3)"   strokeDasharray="3 3" label={{ value:'Severe',   position:'right', fill:'var(--red)',   fontSize:10 }} />
          <Line type="monotone" dataKey="historical" stroke="#1ABC9C" strokeWidth={2}   dot={false} activeDot={{ r:4 }} name="Historical SPEI" />
          <Line type="monotone" dataKey="forecast"   stroke="#F39C12" strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill:'#F39C12', r:3 }} activeDot={{ r:5 }} name="Forecast SPEI" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
