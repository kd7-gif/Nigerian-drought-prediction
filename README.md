# 🌦 Nigeria Drought Forecast Intelligence Platform

Final Year Project — multi-model drought forecasting (GRU/Transformer, 3M/6M) for all 37 Nigerian states.

---

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18 + Vite 5 + Vanilla CSS   |
| Backend    | Node.js + Express                 |
| ML Service | Python FastAPI (registry-driven)  |
| Database   | PostgreSQL (optional)             |

---

## Quick Start

### 1. Backend (Terminal 1)
```bash
cd server
npm install
node index.js
# → http://localhost:5000
```

### 2. Frontend (Terminal 2)
```bash
cd client
npm install
npm run dev
# → http://localhost:3000
```

### 3. ML Service (Terminal 3)
```bash
cd ml
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Connect ML service to Express
```bash
# Restart server with this env var:
ML_SERVICE_URL=http://localhost:8000 node index.js
```

---

## How the Period Selector Works

The **"Prediction period"** dropdown on the Dashboard controls which 24-month window
the model uses as input, and therefore which 6 months it predicts.

| You select  | 24-month input window     | 6-month forecast           |
|-------------|---------------------------|----------------------------|
| March 2026  | Apr 2024 → Mar 2026       | Apr 2026 → Sep 2026        |
| Dec 2025    | Jan 2024 → Dec 2025       | Jan 2026 → Jun 2026        |

**Default**: automatically set to the latest month that has ingested data.
If no data has been ingested, defaults to last complete calendar month.

Periods marked with **✓** have real ingested climate data.
Periods without ✓ use deterministic mock data.

---

## Adding New Monthly Data

```bash
POST http://localhost:5000/api/data/ingest
Content-Type: application/json

{
  "rows": [
    {
      "pcode": "NG001",
      "year": 2026,
      "month": 4,
      "chirps_rain_month": 134.5,
      "rfq": 88.2,
      "r1q": 91.0,
      "Mean_Temp_C": 29.3,
      "PET_mm_day": 148.0
    }
  ]
}
```

After ingesting, the default anchor automatically advances to the latest ingested month.
The forecast window shifts forward accordingly — no code changes needed.

To push new data to the ML service:
```bash
POST http://localhost:5000/api/data/rebuild-parquet
```

See `GET /api/data/schema` for full field documentation.

---

## Model Selection

The dashboard now supports four model keys:

- `gru_3m`
- `gru_6m`
- `transformer_3m`
- `transformer_6m`

Frontend model dropdown forwards `model_key` to all API routes, and the backend/ML layers automatically adapt forecast horizon (3 or 6 months).

---

## API Reference

| Method | Endpoint                        | Description                              |
|--------|---------------------------------|------------------------------------------|
| GET    | /api/states?anchor=YYYY-MM      | All 37 states with SPEI for given anchor |
| GET    | /api/states/:pcode?anchor=      | Single state full detail + history       |
| GET    | /api/forecasts/latest?horizon=N&anchor= | Map data for one horizon        |
| GET    | /api/forecasts/ranking?anchor=  | States ranked by drought severity        |
| GET    | /api/evaluation/metrics         | Real test-set MAE/RMSE from notebook     |
| GET    | /api/status                     | Model source, anchor, forecast period    |
| GET    | /api/data/available-periods     | Selectable periods for UI dropdown       |
| POST   | /api/data/ingest                | Add new monthly climate rows             |
| GET    | /api/data/schema                | Full documented input format             |
| POST   | /api/data/rebuild-parquet       | Push ingested data to ML service         |

---

## SPEI Classification

| SPEI Value    | Category          |
|---------------|-------------------|
| ≥ 1.0         | Moderately Wet    |
| −1.0 to 1.0   | Near Normal       |
| −1.5 to −1.0  | Moderate Drought  |
| −2.0 to −1.5  | Severe Drought    |
| ≤ −2.0        | Extreme Drought   |

---

## Model Results (from notebook)

| Metric     | Transformer | Persistence Baseline |
|------------|-------------|----------------------|
| MAE        | 0.345       | 0.943                |
| RMSE       | 0.473       | 1.085                |
| R²         | 0.866       | —                    |

Wilcoxon signed-rank test: p < 1e-300. CI for improvement: [0.579, 0.616].
# NIGERIANDROUGHTPREDICTIONPLATFORM
