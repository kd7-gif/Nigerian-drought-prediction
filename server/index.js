const express = require('express');
const cors = require('cors');

const { STATES, STATES_MAP } = require('./config/states');
const { speiCategory } = require('./utils/spei');
const { anchorKey, forecastMonthLabels, resolveAnchor } = require('./utils/time');
const { mlGet, mlPost, ML_URL } = require('./services/mlClient');
const { ingestedData, saveIngestedData } = require('./store/ingestedData');

const app = express();
const PORT = process.env.PORT || 5000;
const ALLOW_DEMO_FALLBACK = process.env.ALLOW_DEMO_FALLBACK === 'true';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const REAL_METRICS = {
  gru_3m: {
    overall: { mae: 0.387536, rmse: 0.568741, r2: 0.0, dir_acc: 0.702202 },
    baseline: { mae: 0.481689, rmse: 0.679583, r2: 0.0 },
    by_horizon: [
      { horizon: 1, mae: 0.2964, rmse: 0.4376, dir_acc: 0.7053, baseline_mae: 0.4817, baseline_rmse: 0.6796 },
      { horizon: 2, mae: 0.3961, rmse: 0.5773, dir_acc: 0.6943, baseline_mae: 0.4817, baseline_rmse: 0.6796 },
      { horizon: 3, mae: 0.4701, rmse: 0.6676, dir_acc: 0.7070, baseline_mae: 0.4817, baseline_rmse: 0.6796 },
    ],
    statistical_test: { test: 'Validation-Gated Calibration', statistic: null, p_value: 'n/a', ci_low: null, ci_high: null, mean_improvement: 0.0, result: 'GRU 3M beats persistence on RMSE.' },
    model_info: {
      architecture: 'DroughtGRU',
      input_window: 24,
      output_horizon: '3 months',
      features: 63,
      optimizer: 'AdamW',
      loss_function: 'Composite (abs+delta+dir)',
      calibration: 'state_bias + isotonic (val-gated)',
    },
  },
  gru_6m: {
    overall: { mae: 0.500638, rmse: 0.707382, r2: 0.0, dir_acc: 0.694365 },
    baseline: { mae: 0.615317, rmse: 0.852422, r2: 0.0 },
    by_horizon: [
      { horizon: 1, mae: 0.2965, rmse: 0.4377, dir_acc: 0.7010, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 2, mae: 0.4048, rmse: 0.5888, dir_acc: 0.6902, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 3, mae: 0.4846, rmse: 0.6832, dir_acc: 0.6860, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 4, mae: 0.5435, rmse: 0.7481, dir_acc: 0.7025, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 5, mae: 0.6125, rmse: 0.8205, dir_acc: 0.6970, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 6, mae: 0.6620, rmse: 0.8743, dir_acc: 0.6895, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
    ],
    statistical_test: { test: 'Validation-Gated Calibration', statistic: null, p_value: 'n/a', ci_low: null, ci_high: null, mean_improvement: 0.0, result: 'GRU 6M beats persistence on RMSE.' },
    model_info: {
      architecture: 'DroughtGRU',
      input_window: 24,
      output_horizon: '6 months',
      features: 63,
      optimizer: 'AdamW',
      loss_function: 'Composite (abs+delta+dir)',
      calibration: 'state_bias + isotonic (val-gated)',
    },
  },
  transformer_3m: {
    overall: { mae: 0.398641, rmse: 0.574611, r2: 0.0, dir_acc: 0.678303 },
    baseline: { mae: 0.481689, rmse: 0.679583, r2: 0.0 },
    by_horizon: [
      { horizon: 1, mae: 0.2980, rmse: 0.4384, dir_acc: 0.6798, baseline_mae: 0.4817, baseline_rmse: 0.6796 },
      { horizon: 2, mae: 0.4155, rmse: 0.5910, dir_acc: 0.6646, baseline_mae: 0.4817, baseline_rmse: 0.6796 },
      { horizon: 3, mae: 0.4825, rmse: 0.6701, dir_acc: 0.6905, baseline_mae: 0.4817, baseline_rmse: 0.6796 },
    ],
    statistical_test: { test: 'Validation-Gated Calibration', statistic: null, p_value: 'n/a', ci_low: null, ci_high: null, mean_improvement: 0.0, result: 'Transformer 3M beats persistence on RMSE.' },
    model_info: {
      architecture: 'DroughtTransformer',
      input_window: 24,
      output_horizon: '3 months',
      features: 63,
      optimizer: 'AdamW',
      loss_function: 'Composite (abs+delta+dir)',
      calibration: 'state_bias + isotonic (val-gated)',
    },
  },
  transformer_6m: {
    overall: { mae: 0.533608, rmse: 0.735278, r2: 0.0, dir_acc: 0.661108 },
    baseline: { mae: 0.615317, rmse: 0.852422, r2: 0.0 },
    by_horizon: [
      { horizon: 1, mae: 0.3238, rmse: 0.4698, dir_acc: 0.6573, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 2, mae: 0.4407, rmse: 0.6217, dir_acc: 0.6504, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 3, mae: 0.5220, rmse: 0.7103, dir_acc: 0.6550, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 4, mae: 0.5979, rmse: 0.7939, dir_acc: 0.6552, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 5, mae: 0.6464, rmse: 0.8520, dir_acc: 0.6667, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
      { horizon: 6, mae: 0.6708, rmse: 0.8809, dir_acc: 0.6822, baseline_mae: 0.6153, baseline_rmse: 0.8524 },
    ],
    statistical_test: { test: 'Validation-Gated Calibration', statistic: null, p_value: 'n/a', ci_low: null, ci_high: null, mean_improvement: 0.0, result: 'Transformer 6M beats persistence on RMSE.' },
    model_info: {
      architecture: 'DroughtTransformer',
      input_window: 24,
      output_horizon: '6 months',
      features: 63,
      optimizer: 'AdamW',
      loss_function: 'Composite (abs+delta+dir)',
      calibration: 'state_bias + isotonic (val-gated)',
    },
  },
};

function requestedModel(req) {
  return (req.query.model_key || 'gru_3m').toString();
}

function modelHorizonMonths(modelKey) {
  return modelKey.includes('3m') ? 3 : 6;
}

function addMonthsKey(anchor, offsetMonths) {
  const [y, m] = anchor.split('-').map(Number);
  const d = new Date(y, m - 1 + offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyCmp(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  if (ay !== by) return ay - by;
  return am - bm;
}

const CACHE = new Map();
const CACHE_TTL = 60_000;

function cacheGet(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { CACHE.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value) { CACHE.set(key, { value, ts: Date.now() }); }
function clearCache() { CACHE.clear(); }

function demoFallbackForecast(state) {
  const seed = parseInt(state.pcode.slice(2), 10) * 137 + 31;
  const latNorm = (state.lat - 4.5) / 9.5;
  const base = -0.2 + latNorm * -1.8;
  return Array.from({ length: 6 }, (_, h) => {
    const seasonal = 0.3 * Math.sin(2 * Math.PI * (h + 1) / 12 + state.lng / 15);
    const noise = 0.08 * Math.sin(seed * (h + 1) * 0.9173);
    return parseFloat((base + seasonal + noise + h * 0.018).toFixed(3));
  });
}

async function fetchForecastFromMl(pcode, anchor, modelKey) {
  const key = `forecast:${pcode}:${anchor}:${modelKey}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const data = await mlGet(`/forecast/${pcode}?anchor=${encodeURIComponent(anchor)}&model_key=${encodeURIComponent(modelKey)}`);
    cacheSet(key, data);
    return data;
  } catch (e) {
    if (!ALLOW_DEMO_FALLBACK) throw e;
    const state = STATES_MAP[pcode];
    const predictions = demoFallbackForecast(state);
    const fallback = {
      pcode,
      anchor,
      current_spei: predictions[0],
      last_observation_date: `${anchor}-01`,
      window_start_date: `${anchor}-01`,
      window_end_date: `${anchor}-01`,
      predictions_abs: predictions,
      predictions,
      categories: predictions.map(v => speiCategory(v).label),
      forecast: predictions.map((spei, i) => ({ month_ahead:i+1, spei, category:speiCategory(spei).label })),
      model_used: modelKey === 'gru_3m' ? 'fallback' : `${modelKey}-fallback`,
    };
    cacheSet(key, fallback);
    return fallback;
  }
}

async function fetchHistoryFromMl(pcode, anchor, limit = 24) {
  const key = `history:${pcode}:${anchor}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const params = new URLSearchParams({ limit: String(limit) });
  if (anchor) params.set('anchor', anchor);
  const data = await mlGet(`/history/${pcode}?${params.toString()}`);
  cacheSet(key, data);
  return data;
}

async function fetchAvailableAnchors() {
  try {
    const data = await mlGet('/anchors');
    return data.anchors || [];
  } catch (_) {
    return [];
  }
}

function normalizeForecastPayload(state, forecast) {
  const predictions = forecast.predictions_abs || forecast.predictions || [];
  const monthOne = predictions[0] ?? forecast.current_spei ?? 0;
  return {
    ...state,
    anchor: forecast.anchor,
    current_spei: forecast.current_spei,
    forecast: predictions,
    model_used: forecast.model_used,
    last_observation_date: forecast.last_observation_date,
    ...speiCategory(monthOne),
  };
}

app.get('/api/states', async (req, res) => {
  const anchor = anchorKey(resolveAnchor(req.query.anchor));
  const modelKey = requestedModel(req);
  try {
    const rows = await Promise.all(STATES.map(async state => {
      const forecast = await fetchForecastFromMl(state.pcode, anchor, modelKey);
      return normalizeForecastPayload(state, forecast);
    }));
    res.json(rows);
  } catch (e) {
    res.status(502).json({ error: e.message, anchor });
  }
});

app.get('/api/states/:pcode', async (req, res) => {
  const pcode = req.params.pcode.toUpperCase();
  const state = STATES_MAP[pcode];
  if (!state) return res.status(404).json({ error:'State not found' });
  const anchor = anchorKey(resolveAnchor(req.query.anchor));
  const modelKey = requestedModel(req);
  try {
    const [forecast, history, availableAnchors] = await Promise.all([
      fetchForecastFromMl(pcode, anchor, modelKey),
      fetchHistoryFromMl(pcode, anchor, 24),
      fetchAvailableAnchors(),
    ]);
    const predictions = forecast.predictions_abs || forecast.predictions || [];
    const resolvedAnchor = forecast.anchor || anchor;
    const latestObservedAnchor = availableAnchors.length
      ? availableAnchors[availableAnchors.length - 1]
      : resolvedAnchor;
    const observedMonthKeys = availableAnchors.filter(
      mk => monthKeyCmp(mk, resolvedAnchor) > 0 && monthKeyCmp(mk, latestObservedAnchor) <= 0,
    );
    const observedRows = await Promise.all(observedMonthKeys.map(async monthKey => {
      try {
        const row = await fetchHistoryFromMl(pcode, monthKey, 1);
        const item = (row.history || [])[0];
        const exactKey = item ? `${item.year}-${String(item.month_num).padStart(2, '0')}` : null;
        const observed = exactKey === monthKey && Number.isFinite(item?.spei) ? item.spei : null;
        return {
          month_key: monthKey,
          month_label: item?.month_label || monthKey,
          spei: observed,
        };
      } catch (_) {
        return { month_key: monthKey, month_label: monthKey, spei: null };
      }
    }));
    const observedTimeline = observedRows;
    const observedByMonth = new Map(observedRows.map(row => [row.month_key, row.spei]));
    const forecastWithReal = predictions.map((predicted, i) => {
      const monthKey = addMonthsKey(resolvedAnchor, i + 1);
      const observed = monthKeyCmp(monthKey, latestObservedAnchor) <= 0
        ? (observedByMonth.has(monthKey) ? observedByMonth.get(monthKey) : null)
        : null;
      return {
        horizon: i + 1,
        month_key: monthKey,
        predicted,
        observed,
        ...speiCategory(predicted),
      };
    });
    res.json({
      ...normalizeForecastPayload(state, forecast),
      historical: history.history,
      forecast_with_real: forecastWithReal,
      observed_until_latest: observedTimeline,
      latest_observed_anchor: latestObservedAnchor,
    });
  } catch (e) {
    res.status(502).json({ error: e.message, anchor, pcode });
  }
});

app.get('/api/states/:pcode/forecast', async (req, res) => {
  const pcode = req.params.pcode.toUpperCase();
  const state = STATES_MAP[pcode];
  if (!state) return res.status(404).json({ error:'State not found' });
  const anchor = anchorKey(resolveAnchor(req.query.anchor));
  const modelKey = requestedModel(req);
  try {
    const forecast = await fetchForecastFromMl(pcode, anchor, modelKey);
    const months = forecastMonthLabels(anchor, (forecast.predictions_abs || forecast.predictions || []).length || 6);
    const preds = forecast.predictions_abs || forecast.predictions || [];
    res.json({
      state: state.name,
      pcode,
      model_used: forecast.model_used,
      anchor,
      forecast_window: `${months[0]} – ${months[months.length - 1]}`,
      current_spei: forecast.current_spei,
      forecast: preds.map((spei, i) => ({ month: months[i], horizon: i + 1, spei, ...speiCategory(spei) })),
    });
  } catch (e) {
    res.status(502).json({ error: e.message, anchor, pcode });
  }
});

app.get('/api/forecasts/latest', async (req, res) => {
  const anchor = anchorKey(resolveAnchor(req.query.anchor));
  const modelKey = requestedModel(req);
  const maxHorizon = modelHorizonMonths(modelKey);
  const horizon = Math.min(maxHorizon, Math.max(1, parseInt(req.query.horizon, 10) || 1));
  try {
    const rows = await mlGet(`/forecasts/latest?anchor=${encodeURIComponent(anchor)}&model_key=${encodeURIComponent(modelKey)}`);
    const byPcode = Object.fromEntries(rows.map(r => [r.pcode, r]));
    const result = STATES.map(state => {
      const row = byPcode[state.pcode];
      if (!row) return null;
      const preds = row.predictions_abs || row.predictions || [];
      const spei = preds[horizon - 1];
      return { ...state, spei, current_spei: row.current_spei, anchor: row.anchor, model_used: row.model_used, ...speiCategory(spei) };
    }).filter(Boolean);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message, anchor });
  }
});

app.get('/api/forecasts/ranking', async (req, res) => {
  const anchor = anchorKey(resolveAnchor(req.query.anchor));
  const modelKey = requestedModel(req);
  try {
    const rows = await mlGet(`/forecasts/latest?anchor=${encodeURIComponent(anchor)}&model_key=${encodeURIComponent(modelKey)}`);
    const result = rows.map(row => {
      const state = STATES_MAP[row.pcode];
      const preds = row.predictions_abs || row.predictions || [];
      const avg = parseFloat((preds.reduce((a, b) => a + b, 0) / preds.length).toFixed(3));
      return { ...state, avg_spei: avg, forecast: preds, anchor: row.anchor, model_used: row.model_used, ...speiCategory(avg) };
    }).sort((a, b) => a.avg_spei - b.avg_spei);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message, anchor });
  }
});

app.get('/api/evaluation/metrics', (req, res) => {
  const modelKey = requestedModel(req);
  res.json(REAL_METRICS[modelKey] || REAL_METRICS.gru_3m);
});

app.get('/api/models', async (req, res) => {
  try {
    const models = await mlGet('/models');
    res.json(models);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/status', async (req, res) => {
  const modelKey = requestedModel(req);
  let mlInfo = {};
  let mlOnline = false;
  let defaultAnchor = anchorKey(resolveAnchor(null));
  try {
    mlInfo = await mlGet('/health');
    mlOnline = mlInfo.ready === true;
    const anchors = await fetchAvailableAnchors();
    if (anchors.length) defaultAnchor = anchors[anchors.length - 1];
  } catch (_) {}
  const horizon = modelHorizonMonths(modelKey);
  const labels = forecastMonthLabels(defaultAnchor, horizon);
  res.json({
    ml_service_online: mlOnline,
    ml_url: ML_URL || 'not configured',
    active_source: mlOnline ? 'Registry-driven model service' : (ALLOW_DEMO_FALLBACK ? 'deterministic fallback' : 'unavailable'),
    default_anchor: defaultAnchor,
    forecast_period: `${labels[0]} – ${labels[labels.length - 1]}`,
    selected_model: modelKey,
    selected_horizon_months: horizon,
    ingested_states: Object.keys(ingestedData).length,
    ingested_months_total: Object.values(ingestedData).reduce((t, a) => t + a.length, 0),
    ml_info: mlInfo,
  });
});

app.get('/api/data/available-periods', async (req, res) => {
  const anchors = await fetchAvailableAnchors();
  const periods = anchors.map(p => {
    const d = new Date(`${p}-01T00:00:00Z`);
    const labels = forecastMonthLabels(p);
    return {
      value: p,
      label: d.toLocaleString('default', { month:'long', year:'numeric', timeZone:'UTC' }),
      short: d.toLocaleString('default', { month:'short', year:'2-digit', timeZone:'UTC' }),
      forecasts: `${labels[0]} – ${labels[5]}`,
      has_ingested_data: Object.values(ingestedData).some(rows => rows.some(r => `${r.year}-${String(r.month).padStart(2,'0')}` === p)),
    };
  });
  const fallbackDefault = periods.length ? periods[periods.length - 1].value : anchorKey(resolveAnchor(null));
  res.json({ default_anchor: fallbackDefault, periods });
});

app.post('/api/data/ingest', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error:'Body must have a "rows" array.' });
  }
  const REQUIRED = ['pcode','year','month','Mean_Temp_C','PET_mm_day','spei06'];
  const results = { inserted:0, skipped:0, errors:[] };

  for (const row of rows) {
    const missing = REQUIRED.filter(k => row[k] == null);
    const precip = row.Precip_mm_month ?? row.chirps_rain_month;
    if (precip == null) missing.push('Precip_mm_month');
    if (missing.length) { results.errors.push({ row, error:`Missing: ${missing.join(', ')}` }); results.skipped++; continue; }
    const pcode = row.pcode.toUpperCase();
    if (!STATES_MAP[pcode]) { results.errors.push({ row, error:`Unknown PCODE: ${pcode}` }); results.skipped++; continue; }
    const month = parseInt(row.month, 10);
    if (month < 1 || month > 12) { results.errors.push({ row, error:`Invalid month ${month}` }); results.skipped++; continue; }

    const record = {
      pcode,
      year: parseInt(row.year, 10),
      month,
      chirps_rain_month: parseFloat(row.chirps_rain_month),
      Precip_mm_month: parseFloat(precip),
      rfq: row.rfq != null ? parseFloat(row.rfq) : null,
      r1q: row.r1q != null ? parseFloat(row.r1q) : null,
      Mean_Temp_C: parseFloat(row.Mean_Temp_C),
      PET_mm_day: parseFloat(row.PET_mm_day),
      month_sin: parseFloat(Math.sin(2 * Math.PI * month / 12).toFixed(6)),
      month_cos: parseFloat(Math.cos(2 * Math.PI * month / 12).toFixed(6)),
      spei06: parseFloat(row.spei06),
      ingested_at: new Date().toISOString(),
    };
    if (!ingestedData[pcode]) ingestedData[pcode] = [];
    const idx = ingestedData[pcode].findIndex(r => r.year === record.year && r.month === record.month);
    if (idx >= 0) ingestedData[pcode][idx] = record; else ingestedData[pcode].push(record);
    ingestedData[pcode].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
    results.inserted++;
  }

  saveIngestedData();
  clearCache();
  res.json({
    ...results,
    total_stored: Object.values(ingestedData).reduce((t, a) => t + a.length, 0),
    message: results.inserted > 0 ? `Ingested ${results.inserted} row(s).` : 'No rows ingested.',
  });
});

app.get('/api/data/latest', (req, res) => {
  const result = {};
  for (const [p, rows] of Object.entries(ingestedData)) if (rows.length) result[p] = rows[rows.length - 1];
  res.json({ states: result, count: Object.keys(result).length });
});

app.get('/api/data/schema', (req, res) => {
  res.json({
    description: 'POST /api/data/ingest — add new monthly climate rows for real inference.',
    required_fields: {
      pcode:             { type:'string',  example:'NG001', note:'NG001–NG037' },
      year:              { type:'integer', example:2026 },
      month:             { type:'integer', example:4, note:'1–12' },
      Precip_mm_month:   { type:'number',  example:134.5, note:'or use chirps_rain_month alias' },
      Mean_Temp_C:       { type:'number',  example:29.3 },
      PET_mm_day:        { type:'number',  example:148.0 },
      spei06:            { type:'number',  example:0.21, note:'latest observed target value' },
    },
    optional_fields: { chirps_rain_month:{ type:'number', note:'accepted alias for Precip_mm_month' } },
    auto_computed: ['month_sin','month_cos','lags','rolling features','state dummies'],
    example_body: { rows:[
      { pcode:'NG001', year:2026, month:4, Precip_mm_month:134.5, Mean_Temp_C:29.3, PET_mm_day:148.0, spei06:0.15 },
      { pcode:'NG008', year:2026, month:4, Precip_mm_month:22.1,  Mean_Temp_C:33.1, PET_mm_day:172.0, spei06:-1.02 },
    ]},
  });
});

app.post('/api/data/rebuild-parquet', async (req, res) => {
  if (!ML_URL) return res.status(503).json({ error:'ML_SERVICE_URL not set.' });
  try {
    const response = await mlPost('/data/update', { ingested_data: ingestedData });
    clearCache();
    res.json({ success:true, response, message:'ML service updated. Cache cleared.' });
  } catch (e) {
    res.status(502).json({ error:`ML unreachable: ${e.message}` });
  }
});

app.delete('/api/data/clear', (req, res) => {
  Object.keys(ingestedData).forEach(k => delete ingestedData[k]);
  saveIngestedData();
  clearCache();
  res.json({ message:'All ingested data cleared.' });
});

app.listen(PORT, () => {
  console.log(`\n🌦 Nigeria Drought Forecast API → http://localhost:${PORT}`);
  console.log(`   ML service: ${ML_URL || 'not configured'}`);
  console.log(`   Demo fallback enabled: ${ALLOW_DEMO_FALLBACK ? 'yes' : 'no'}\n`);
});
