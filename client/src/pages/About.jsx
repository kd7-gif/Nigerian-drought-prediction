import { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/About.css';

export default function About() {
  const [models, setModels] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [status, setStatus] = useState(null);
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    axios.get('/api/models').then(r => {
      const modelMap = r?.data?.models || {};
      setModels(Object.entries(modelMap).map(([key, info]) => ({ key, ...info })));
    }).catch(() => {});

    axios.get('/api/data/available-periods').then(r => {
      setPeriods(r?.data?.periods || []);
    }).catch(() => {});

    axios.get('/api/status').then(r => setStatus(r.data)).catch(() => {});
    axios.get('/api/data/schema').then(r => setSchema(r.data)).catch(() => {});
  }, []);

  const availablePeriods = periods.length;
  const latestPeriod = periods.length ? periods[periods.length - 1].value : '—';
  const earliestPeriod = periods.length ? periods[0].value : '—';
  const requiredFields = Object.keys(schema?.required_fields || {});

  return (
    <div className="about-container">
      <div className="about-hero">
        <h1>Nigeria Drought Forecast Intelligence Platform</h1>
        <p>
          A production-oriented, registry-driven forecasting platform for Nigerian drought intelligence, combining
          model-governed inference, state-level SPEI projections, and horizon-aware forecast delivery.
        </p>
      </div>

      <div className="about-section">
        <div className="about-section-title">What is Drought Forecasting?</div>
        <div className="about-card">
          <p>
            Drought forecasting estimates future moisture stress from historical climate observations and model-led pattern learning.
            Early-warning visibility supports proactive planning for agriculture, water resource governance, and humanitarian response.
          </p>
          <p>
            Nigeria faces recurring drought pressure, especially across the semi-arid northern belt. States such as Borno, Yobe,
            Zamfara, and Katsina are consistently exposed to rainfall deficits and elevated evapotranspiration risk.
          </p>
          <div className="about-feature-grid">
            <div className="about-feature"><div className="about-feature-icon">🌍</div><div className="about-feature-title">37 Nigerian States</div><div className="about-feature-desc">Nationwide state-level coverage for operational monitoring</div></div>
            <div className="about-feature"><div className="about-feature-icon">📅</div><div className="about-feature-title">3M + 6M Horizons</div><div className="about-feature-desc">Short- and medium-range forecast support windows</div></div>
            <div className="about-feature"><div className="about-feature-icon">🧠</div><div className="about-feature-title">{models.length || 4} Registered Models</div><div className="about-feature-desc">Versioned model inventory resolved dynamically at runtime</div></div>
            <div className="about-feature"><div className="about-feature-icon">📊</div><div className="about-feature-title">63 Engineered Features</div><div className="about-feature-desc">Climate, temporal, anomaly, memory, and state-encoding signals</div></div>
          </div>
        </div>
      </div>

      <div className="about-section">
        <div className="about-section-title">Understanding SPEI-6</div>
        <div className="about-card">
          <h4>Standardised Precipitation-Evapotranspiration Index</h4>
          <p>SPEI accounts for both precipitation and temperature effects on drought. The <strong style={{ color:'var(--teal)' }}>-6 timescale</strong> means a 6-month accumulation window capturing medium-term agricultural drought.</p>
          <table className="spei-table" style={{ marginTop:16 }}>
            <thead><tr><th>SPEI Range</th><th>Classification</th><th>Impact</th></tr></thead>
            <tbody>
              {[['≥ 2.0','Extremely Wet','Flood risk'],['1.0 – 2.0','Moderately Wet','Above-normal rainfall'],
                ['−1.0 – 1.0','Near Normal','Typical conditions'],['−1.0 – −1.5','Moderate Drought','Crop stress begins'],
                ['−1.5 – −2.0','Severe Drought','Significant yield losses'],['≤ −2.0','Extreme Drought','Humanitarian crisis risk']
              ].map(([r,c,i]) => (
                <tr key={r}>
                  <td style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--teal)' }}>{r}</td>
                  <td style={{ color:'var(--text-primary)' }}>{c}</td>
                  <td style={{ color:'var(--text-secondary)', fontSize:12 }}>{i}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="about-section">
        <div className="about-section-title">Model Architecture and Inference</div>
        <div className="about-card">
          <h4>Registry-Driven Multi-Model Forecasting</h4>
          <p><strong>Model set:</strong> {models.length ? models.map(m => <code key={m.key} style={{ marginRight:8 }}>{m.key}</code>) : <>loading model registry…</>}</p>
          <p>
            <strong>Inference input:</strong> 24-month sequences across 63 engineered features spanning exogenous climate variables,
            cyclical encodings, lag-memory terms, anomaly/change signals, and state one-hot representations.
          </p>
          <p>
            <strong>Inference output:</strong> horizon-specific absolute SPEI trajectories for direct downstream drought categorization.
          </p>
          <p>
            <strong>Core preprocessing artifacts:</strong> <code>ml/artifacts/model_input_data.parquet</code>, <code>ml/artifacts/feature_data.parquet</code>, <code>ml/artifacts/scalers.pkl</code>, and <code>ml/artifacts/model_registry.json</code>.
          </p>
          <p><strong>ML service status:</strong> {status?.ml_service_online ? 'Online' : 'Offline'} · <strong>Default anchor:</strong> {status?.default_anchor || 'Not available'}</p>
        </div>
      </div>

      <div className="about-section">
        <div className="about-section-title">Adding New Data</div>
        <div className="about-card">
          <h4>Operational Data Ingestion Workflow</h4>
          <p>
            1) Submit monthly observations via <strong>POST /api/data/ingest</strong> using a structured <strong>rows</strong> payload.
          </p>
          <p>
            2) Propagate merged records into ML artifacts through <strong>POST /api/data/rebuild-parquet</strong>.
          </p>
          <p>
            3) Validate schema contract and payload examples through <strong>GET /api/data/schema</strong>.
          </p>
          <p>
            Required fields include <code>pcode</code>, <code>year</code>, <code>month</code>, <code>Precip_mm_month</code> (or <code>chirps_rain_month</code>),
            <code>Mean_Temp_C</code>, <code>PET_mm_day</code>, and <code>spei06</code>.
          </p>
        </div>
      </div>

      <div className="about-section">
        <div className="about-section-title">Runtime Dataset Coverage</div>
        <div className="about-card">
          {[['📆 Available monthly anchors', `${availablePeriods} months (${earliestPeriod} → ${latestPeriod})`],
            ['🗂 Feature table', 'ml/artifacts/feature_data.parquet (63 engineered predictors)'],
            ['🧪 Raw modeling table', 'ml/artifacts/model_input_data.parquet (PCODE, Date, climate variables, SPEI)'],
            ['⚖ Scaling artifacts', 'ml/artifacts/scalers.pkl (state-level robust scaling objects)'],
            ['🧠 Model registry', 'ml/artifacts/model_registry.json (active model definitions and metadata)'],
          ].map(([src,desc]) => (
            <div key={src} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, minWidth:200, fontWeight:500, color:'var(--text-primary)' }}>{src}</div>
              <div style={{ fontSize:13, color:'var(--text-secondary)' }}>{desc}</div>
            </div>
          ))}
          <div style={{ marginTop:12, fontSize:13, color:'var(--text-secondary)' }}>
            <strong style={{ color:'var(--text-primary)' }}>Current ingestion schema fields:</strong>{' '}
            {requiredFields.length ? requiredFields.map(f => <code key={f} style={{ marginRight:8 }}>{f}</code>) : 'Loading schema metadata…'}
          </div>
        </div>
      </div>

      <div className="about-section">
        <div className="about-section-title">Upstream Data Sources & Methods</div>
        <div className="about-card">
          {[['🛰 CRU TS v4.08 (University of East Anglia / CEDA)', 'Monthly gridded climate variables, including temperature and PET-related drivers, used for upstream feature engineering.'],
            ['🌧 CHIRPS v2.0 (UCSB Climate Hazards Center / USGS)', 'High-resolution monthly precipitation estimates used as core rainfall inputs in drought computation workflows.'],
            ['🌍 Nigeria Admin-1 Boundaries (OCHA HDX)', 'State boundary geometries and PCODE mapping (NG001–NG037) used for spatial harmonization and state-level aggregation.'],
            ['📐 SPEI Methodology Reference (Vicente-Serrano et al., 2010)', 'Log-logistic SPEI framework applied for derivation and validation of the drought target signal.'],
          ].map(([src, desc]) => (
            <div key={src} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, minWidth:260, fontWeight:500, color:'var(--text-primary)' }}>{src}</div>
              <div style={{ fontSize:13, color:'var(--text-secondary)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
