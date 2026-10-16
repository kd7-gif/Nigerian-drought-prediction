# 🌦️ Nigeria Drought Forecast Intelligence Platform

A full-stack platform that forecasts drought conditions for all 37 Nigerian states
up to six months ahead, using deep learning models trained on historical climate data.
Built as my final-year project in Software Engineering at Bowen University.

<!-- dashboard screenshot here: ![Dashboard](docs/dashboard.png) -->

## Why it matters
Drought hits Nigerian agriculture and water supply hard, and early warning gives farmers,
planners and agencies time to act. This platform turns monthly climate data into
state-level drought forecasts that anyone can explore on an interactive dashboard.

## Key features
- **State-level forecasts** for all 37 states, measured with the SPEI drought index
- **Four deep learning models**: GRU and Transformer, each at 3-month and 6-month horizons
- **Interactive dashboard** with a drought map, state rankings by severity and per-state history
- **Selectable forecast periods** that use a rolling 24-month input window
- **Live data ingestion** through an API, so new monthly climate data updates forecasts without code changes
- **Evaluation endpoint** exposing real test-set metrics

## Results
The Transformer model cut forecast error by more than half compared with a persistence baseline.

| Metric | Transformer | Persistence Baseline |
|--------|-------------|----------------------|
| MAE    | 0.345       | 0.943                |
| RMSE   | 0.473       | 1.085                |
| R²     | 0.866       | n/a                  |

The improvement is statistically significant (Wilcoxon signed-rank test, p < 1e-300;
95% CI for improvement: [0.579, 0.616]).

## Architecture

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | React 18, Vite 5, CSS                            |
| Backend    | Node.js, Express                                 |
| ML Service | Python, FastAPI, PyTorch, pandas, scikit-learn   |
| Database   | PostgreSQL (optional)                            |

The React dashboard talks to the Express API, which forwards forecast requests to the
FastAPI service where the PyTorch models run.

---

## Quick Start

### 1. Backend
```bash
cd server
npm install
node index.js
# → http://localhost:5000
```

### 2. Frontend
```bash
cd client
npm install
npm run dev
# → http://localhost:3000
```

### 3. ML Service
```bash
cd ml
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Connect the ML service to Express
```bash
ML_SERVICE_URL=http://localhost:8000 node index.js
```

---

## How the Period Selector Works
The **Prediction period** dropdown sets which 24-month window the model uses as input,
and therefore which months it predicts.

| You select | 24-month input window | 6-month forecast    |
|------------|-----------------------|---------------------|
| March 2026 | Apr 2024 → Mar 2026   | Apr 2026 → Sep 2026 |
| Dec 2025   | Jan 2024 → Dec 2025   | Jan 2026 → Jun 2026 |

It defaults to the latest month with ingested data. Periods marked ✓ use real climate
data; others use deterministic mock data.

## Adding New Monthly Data
```http
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
Then push the data to the ML service with `POST /api/data/rebuild-parquet`.
See `GET /api/data/schema` for full field documentation.

## Models
Choose a model from the dashboard dropdown: `gru_3m`, `gru_6m`, `transformer_3m`,
`transformer_6m`. The backend and ML service adapt the forecast horizon automatically.

## API Reference
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /api/states?anchor=YYYY-MM | All 37 states with SPEI for a given anchor |
| GET  | /api/states/:pcode?anchor= | Single state detail and history |
| GET  | /api/forecasts/latest?horizon=N&anchor= | Map data for one horizon |
| GET  | /api/forecasts/ranking?anchor= | States ranked by drought severity |
| GET  | /api/evaluation/metrics | Test-set MAE and RMSE |
| GET  | /api/status | Model source, anchor and forecast period |
| GET  | /api/data/available-periods | Selectable periods for the dropdown |
| POST | /api/data/ingest | Add new monthly climate rows |
| GET  | /api/data/schema | Documented input format |
| POST | /api/data/rebuild-parquet | Push ingested data to the ML service |

## SPEI Classification
| SPEI Value   | Category         |
|--------------|------------------|
| ≥ 1.0        | Moderately Wet   |
| −1.0 to 1.0  | Near Normal      |
| −1.5 to −1.0 | Moderate Drought |
| −2.0 to −1.5 | Severe Drought   |
| ≤ −2.0       | Extreme Drought  |

---

**Author:** Ayomikunle Daramola · [LinkedIn](https://www.linkedin.com/in/ayomikunle-daramola-95b738260/) · [kunle.15daramola@gmail.com](mailto:kunle.15daramola@gmail.com)
