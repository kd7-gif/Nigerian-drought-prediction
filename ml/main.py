from __future__ import annotations

import json
import math
import os
from typing import Any, Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import joblib
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from state_metadata import STATES, STATES_MAP

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
NEW_ML_ROOT = os.environ.get("NEW_ML_ROOT", PROJECT_ROOT)
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
RAW_DATA_PATH = os.path.join(ARTIFACTS_DIR, "model_input_data.parquet")
FEATURE_DATA_PATH = os.path.join(ARTIFACTS_DIR, "feature_data.parquet")
SCALERS_PATH = os.path.join(ARTIFACTS_DIR, "scalers.pkl")
LOCAL_REGISTRY_PATH = os.path.join(ARTIFACTS_DIR, "model_registry.json")
LEGACY_RAW_DATA_PATH = os.path.join(BASE_DIR, "model_input_data.parquet")
LEGACY_FEATURE_DATA_PATH = os.path.join(BASE_DIR, "feature_data.parquet")
LEGACY_SCALERS_PATH = os.path.join(BASE_DIR, "scalers.pkl")
LEGACY_LOCAL_REGISTRY_PATH = os.path.join(BASE_DIR, "model_registry.json")
GLOBAL_REGISTRY_PATH = os.path.join(NEW_ML_ROOT, "models", "model_registry.json")
WINDOW = 24

EXOG_FEATURE_COLS = ["Precip_mm_month", "PET_mm_day", "Mean_Temp_C"]
STATIC_FEATURE_COLS = ["month_sin", "month_cos"]
MEMORY_FEATURE_COLS = [
    "spei06_curr",
    "spei06_lag1",
    "spei06_lag3",
    "spei06_lag6",
    "spei06_lag9",
    "spei06_lag12",
    "spei06_roll3",
    "spei06_roll6",
    "spei06_diff1",
    "spei06_diff3",
    "pre_roll3",
    "pre_roll6",
]
CHANGE_FEATURE_COLS = [
    "pre_diff1",
    "pre_diff3",
    "pet_diff1",
    "pet_diff3",
    "tmp_diff1",
    "tmp_diff3",
    "pre_anomaly3",
    "pre_anomaly6",
    "recovery_signal",
]
STATE_FEATURE_COLS = [f"state_{p}" for p in STATES_MAP.keys()]
FEATURE_COLS = EXOG_FEATURE_COLS + STATIC_FEATURE_COLS + MEMORY_FEATURE_COLS + CHANGE_FEATURE_COLS + STATE_FEATURE_COLS
SCALE_FEATURE_COLS = EXOG_FEATURE_COLS + MEMORY_FEATURE_COLS + [c for c in CHANGE_FEATURE_COLS if c != "recovery_signal"]

app = FastAPI(title="Nigeria Drought Forecast ML Service", version="5.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class DataUpdateRequest(BaseModel):
    ingested_data: dict[str, list[dict[str, Any]]]


class DatasetRowsRequest(BaseModel):
    rows: list[dict[str, Any]]


class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:, : x.size(1), :]


class DroughtTransformer(nn.Module):
    def __init__(self, input_dim: int, output_dim: int, d_model: int, n_heads: int, num_layers: int, ff_dim: int, dropout: float):
        super().__init__()
        self.inp = nn.Linear(input_dim, d_model)
        self.inp_norm = nn.LayerNorm(d_model)
        self.pe = PositionalEncoding(d_model)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=ff_dim,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.enc = nn.TransformerEncoder(enc_layer, num_layers=num_layers)
        self.attn_pool = nn.Sequential(nn.Linear(d_model, d_model // 2), nn.Tanh(), nn.Linear(d_model // 2, 1))
        self.drop = nn.Dropout(dropout)
        self.out = nn.Linear(d_model, output_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.inp(x)
        x = self.inp_norm(x)
        x = self.pe(x)
        x = self.enc(x)
        scores = self.attn_pool(x).squeeze(-1)
        attn = torch.softmax(scores, dim=1)
        pooled = torch.sum(x * attn.unsqueeze(-1), dim=1)
        return self.out(self.drop(pooled))


class DroughtTransformerMultiHead(nn.Module):
    def __init__(self, input_dim: int, output_dim: int, d_model: int, n_heads: int, num_layers: int, ff_dim: int, dropout: float):
        super().__init__()
        self.inp = nn.Linear(input_dim, d_model)
        self.inp_norm = nn.LayerNorm(d_model)
        self.pe = PositionalEncoding(d_model)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=ff_dim,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.enc = nn.TransformerEncoder(enc_layer, num_layers=num_layers)
        self.attn_pool = nn.Sequential(nn.Linear(d_model, d_model // 2), nn.Tanh(), nn.Linear(d_model // 2, 1))
        self.drop = nn.Dropout(dropout)
        self.shared = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(d_model, d_model // 2),
            nn.ReLU(),
        )
        self.abs_heads = nn.ModuleList([nn.Linear(d_model // 2, 1) for _ in range(output_dim)])
        self.delta_heads = nn.ModuleList([nn.Linear(d_model // 2, 1) for _ in range(output_dim)])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.inp(x)
        x = self.inp_norm(x)
        x = self.pe(x)
        x = self.enc(x)
        scores = self.attn_pool(x).squeeze(-1)
        attn = torch.softmax(scores, dim=1)
        pooled = torch.sum(x * attn.unsqueeze(-1), dim=1)
        shared = self.shared(self.drop(pooled))
        abs_pred = [head(shared) for head in self.abs_heads]
        return torch.cat(abs_pred, dim=1)


class DroughtGRU(nn.Module):
    def __init__(self, input_dim: int, output_dim: int, hidden_dim: int = 128, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.gru = nn.GRU(input_size=input_dim, hidden_size=hidden_dim, num_layers=num_layers, batch_first=True, dropout=dropout)
        self.norm = nn.LayerNorm(hidden_dim)
        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, output_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.gru(x)
        last = self.norm(out[:, -1, :])
        return self.head(last)


class DroughtGRUMultiHead(nn.Module):
    def __init__(self, input_dim: int, output_dim: int, hidden_dim: int = 128, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.gru = nn.GRU(input_size=input_dim, hidden_size=hidden_dim, num_layers=num_layers, batch_first=True, dropout=dropout)
        self.norm = nn.LayerNorm(hidden_dim)
        self.shared = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
        )
        self.abs_heads = nn.ModuleList([nn.Linear(hidden_dim // 2, 1) for _ in range(output_dim)])
        self.delta_heads = nn.ModuleList([nn.Linear(hidden_dim // 2, 1) for _ in range(output_dim)])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.gru(x)
        last = self.norm(out[:, -1, :])
        shared = self.shared(last)
        # Forecast endpoint serves absolute SPEI trajectory.
        abs_pred = [head(shared) for head in self.abs_heads]
        return torch.cat(abs_pred, dim=1)


raw_df: pd.DataFrame | None = None
feat_df: pd.DataFrame | None = None
registry: dict[str, Any] = {}
loaded_models: dict[str, dict[str, Any]] = {}
scalers_by_pcode: dict[str, Any] = {}


def _first_existing_path(*paths: str) -> str | None:
    for path in paths:
        if path and os.path.exists(path):
            return path
    return None


def _ensure_registry() -> dict[str, Any]:
    path = _first_existing_path(GLOBAL_REGISTRY_PATH, LOCAL_REGISTRY_PATH, LEGACY_LOCAL_REGISTRY_PATH)
    if not path:
        raise FileNotFoundError("No model registry found in models/ or ml/artifacts/")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_raw_data() -> pd.DataFrame | None:
    path = _first_existing_path(
        RAW_DATA_PATH,
        FEATURE_DATA_PATH,
        LEGACY_RAW_DATA_PATH,
        LEGACY_FEATURE_DATA_PATH,
    )
    if not path:
        return None
    df = pd.read_parquet(path)
    if "Date" not in df.columns:
        return None
    df["Date"] = pd.to_datetime(df["Date"])
    if "chirps_rain_month" in df.columns and "Precip_mm_month" not in df.columns:
        df["Precip_mm_month"] = df["chirps_rain_month"]
    required = ["PCODE", "Date", "Precip_mm_month", "PET_mm_day", "Mean_Temp_C", "spei06"]
    if not set(required).issubset(set(df.columns)):
        return None
    return df[required].copy().sort_values(["PCODE", "Date"]).reset_index(drop=True)


def _build_feature_table(source: pd.DataFrame) -> pd.DataFrame:
    df = source.copy()
    df["PCODE"] = df["PCODE"].astype(str).str.upper().str.strip()
    df = df[df["PCODE"].isin(STATES_MAP.keys())].copy()
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(["PCODE", "Date"]).reset_index(drop=True)
    month = df["Date"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * month / 12)
    df["month_cos"] = np.cos(2 * np.pi * month / 12)
    grp = df.groupby("PCODE")
    df["spei06_curr"] = df["spei06"]
    for lag in [1, 3, 6, 9, 12]:
        df[f"spei06_lag{lag}"] = grp["spei06"].shift(lag)
    df["spei06_roll3"] = grp["spei06"].transform(lambda s: s.rolling(3).mean())
    df["spei06_roll6"] = grp["spei06"].transform(lambda s: s.rolling(6).mean())
    df["spei06_diff1"] = grp["spei06"].diff(1)
    df["spei06_diff3"] = grp["spei06"].diff(3)
    df["pre_roll3"] = grp["Precip_mm_month"].transform(lambda s: s.rolling(3).mean())
    df["pre_roll6"] = grp["Precip_mm_month"].transform(lambda s: s.rolling(6).mean())
    df["pre_diff1"] = grp["Precip_mm_month"].diff(1)
    df["pre_diff3"] = grp["Precip_mm_month"].diff(3)
    df["pet_diff1"] = grp["PET_mm_day"].diff(1)
    df["pet_diff3"] = grp["PET_mm_day"].diff(3)
    df["tmp_diff1"] = grp["Mean_Temp_C"].diff(1)
    df["tmp_diff3"] = grp["Mean_Temp_C"].diff(3)
    df["pre_anomaly3"] = df["Precip_mm_month"] - df["pre_roll3"]
    df["pre_anomaly6"] = df["Precip_mm_month"] - df["pre_roll6"]
    df["recovery_signal"] = (df["spei06_curr"] - df["spei06_lag3"]).fillna(0.0)
    for pcode in STATES_MAP.keys():
        df[f"state_{pcode}"] = (df["PCODE"] == pcode).astype(np.float32)
    df = df.dropna(subset=["spei06_lag12"]).reset_index(drop=True)
    return df[["PCODE", "Date"] + FEATURE_COLS + ["spei06"]].copy()


def _model_info(model_key: Optional[str]) -> tuple[str, dict[str, Any]]:
    key = model_key or registry.get("default_model", "gru_3m")
    if key not in registry.get("models", {}):
        raise HTTPException(status_code=404, detail=f"Unknown model_key: {key}")
    return key, registry["models"][key]


def _checkpoint_path(info: dict[str, Any]) -> str:
    rel_path = info.get("checkpoint_path", "")
    return os.path.join(NEW_ML_ROOT, rel_path)


def _build_model_from_state(state: dict[str, torch.Tensor]) -> nn.Module:
    if "gru.weight_ih_l0" in state:
        input_dim = int(state["gru.weight_ih_l0"].shape[1])
        hidden = int(state["gru.weight_ih_l0"].shape[0] // 3)
        num_layers = sum(1 for k in state if k.startswith("gru.weight_ih_l"))
        abs_head_keys = [k for k in state if k.startswith("abs_heads.") and k.endswith(".weight")]
        if abs_head_keys:
            output_dim = len(abs_head_keys)
            model = DroughtGRUMultiHead(input_dim=input_dim, output_dim=output_dim, hidden_dim=hidden, num_layers=num_layers)
        else:
            output_dim = int(state["head.4.weight"].shape[0])
            model = DroughtGRU(input_dim=input_dim, output_dim=output_dim, hidden_dim=hidden, num_layers=num_layers)
    else:
        input_dim = int(state["inp.weight"].shape[1])
        d_model = int(state["inp.weight"].shape[0])
        ff_dim = int(state["enc.layers.0.linear1.weight"].shape[0])
        layer_ids = sorted({int(k.split(".")[2]) for k in state if k.startswith("enc.layers.")})
        n_heads = 4
        abs_head_keys = [k for k in state if k.startswith("abs_heads.") and k.endswith(".weight")]
        if abs_head_keys:
            output_dim = len(abs_head_keys)
            model = DroughtTransformerMultiHead(
                input_dim=input_dim,
                output_dim=output_dim,
                d_model=d_model,
                n_heads=n_heads,
                num_layers=len(layer_ids),
                ff_dim=ff_dim,
                dropout=0.2,
            )
        else:
            output_dim = int(state["out.weight"].shape[0])
            model = DroughtTransformer(
                input_dim=input_dim,
                output_dim=output_dim,
                d_model=d_model,
                n_heads=n_heads,
                num_layers=len(layer_ids),
                ff_dim=ff_dim,
                dropout=0.2,
            )
    model.load_state_dict(state)
    model.eval()
    return model


def _load_models() -> dict[str, dict[str, Any]]:
    models: dict[str, dict[str, Any]] = {}
    for key, info in registry.get("models", {}).items():
        ckpt = _checkpoint_path(info)
        if not os.path.exists(ckpt):
            continue
        state = torch.load(ckpt, map_location="cpu")
        if any(k.startswith("module.") for k in state):
            state = {k.replace("module.", ""): v for k, v in state.items()}
        model = _build_model_from_state(state)
        models[key] = {"model": model, "horizon": int(info["horizon_months"]), "family": info.get("family", "unknown")}
    return models


def _load_scalers() -> dict[str, Any]:
    scaler_path = _first_existing_path(SCALERS_PATH, LEGACY_SCALERS_PATH)
    if scaler_path:
        loaded = joblib.load(scaler_path)
        if isinstance(loaded, dict):
            return loaded
    return {}


def _state_rows(pcode: str, anchor: Optional[str]) -> pd.DataFrame:
    if feat_df is None or feat_df.empty:
        raise HTTPException(status_code=503, detail="Feature data is not loaded")
    rows = feat_df[feat_df["PCODE"] == pcode].copy()
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"Unknown PCODE: {pcode}")
    if anchor:
        rows = rows[rows["Date"] <= pd.Timestamp(f"{anchor}-01")]
    rows = rows.sort_values("Date").reset_index(drop=True)
    if rows.empty:
        raise HTTPException(status_code=422, detail=f"No rows available for PCODE={pcode} at anchor={anchor}")
    return rows


def _scaled_features_for_rows(rows: pd.DataFrame, pcode: str) -> np.ndarray:
    out = rows[FEATURE_COLS].copy()
    out[SCALE_FEATURE_COLS] = out[SCALE_FEATURE_COLS].astype("float64")
    scaler = scalers_by_pcode.get(pcode)
    if scaler is not None:
        out.loc[:, SCALE_FEATURE_COLS] = scaler.transform(out[SCALE_FEATURE_COLS])
    else:
        med = out[SCALE_FEATURE_COLS].median()
        iqr = out[SCALE_FEATURE_COLS].quantile(0.75) - out[SCALE_FEATURE_COLS].quantile(0.25)
        iqr = iqr.replace(0, 1.0)
        out.loc[:, SCALE_FEATURE_COLS] = (out[SCALE_FEATURE_COLS] - med) / iqr
    return out.values.astype(np.float32)


def _spei_category(v: float) -> str:
    if v >= 1.0:
        return "Moderately Wet"
    if v >= -1.0:
        return "Near Normal"
    if v >= -1.5:
        return "Moderate Drought"
    if v >= -2.0:
        return "Severe Drought"
    return "Extreme Drought"


def _forecast_for_state(pcode: str, anchor: Optional[str], model_key: str, horizon: int) -> dict[str, Any]:
    rows = _state_rows(pcode, anchor)
    if len(rows) < WINDOW:
        raise HTTPException(status_code=422, detail=f"Need at least {WINDOW} rows for inference, got {len(rows)}")
    loaded = loaded_models.get(model_key)
    if not loaded:
        raise HTTPException(status_code=503, detail=f"Model not loaded: {model_key}")
    window_rows = rows.tail(WINDOW).reset_index(drop=True)
    x = _scaled_features_for_rows(window_rows, pcode)
    x_t = torch.tensor(x[np.newaxis, :, :], dtype=torch.float32)
    with torch.no_grad():
        delta = loaded["model"](x_t).cpu().numpy().squeeze()
    if np.isscalar(delta):
        delta = np.array([float(delta)], dtype=float)
    current = float(window_rows["spei06"].iloc[-1])
    # Checkpoints in this project are trained to predict absolute future SPEI.
    preds = [round(float(np.clip(d, -3.0, 3.0)), 4) for d in delta.tolist()[:horizon]]
    return {
        "pcode": pcode,
        "anchor": window_rows["Date"].iloc[-1].strftime("%Y-%m"),
        "current_spei": round(current, 4),
        "last_observation_date": str(window_rows["Date"].iloc[-1].date()),
        "window_start_date": str(window_rows["Date"].iloc[0].date()),
        "window_end_date": str(window_rows["Date"].iloc[-1].date()),
        "predictions_abs": preds,
        "predictions": preds,
        "categories": [_spei_category(v) for v in preds],
        "forecast": [{"month_ahead": i + 1, "spei": v, "category": _spei_category(v)} for i, v in enumerate(preds)],
        "model_used": model_key,
    }


@app.get("/")
def root():
    return {"service": "Nigeria Drought Forecast ML Service", **health()}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "ready": feat_df is not None and not feat_df.empty and len(loaded_models) > 0,
        "feature_rows": int(len(feat_df)) if feat_df is not None else 0,
        "pcodes": int(feat_df["PCODE"].nunique()) if feat_df is not None else 0,
        "default_model": registry.get("default_model"),
        "loaded_models": sorted(list(loaded_models.keys())),
        "scalers_loaded": len(scalers_by_pcode),
        "new_ml_root": NEW_ML_ROOT,
    }


@app.get("/models")
def models():
    return {"default_model": registry.get("default_model"), "models": registry.get("models", {}), "loaded_models": sorted(list(loaded_models.keys()))}


@app.get("/anchors")
def anchors():
    if feat_df is None or feat_df.empty:
        return {"anchors": [], "pcodes": []}
    dates = sorted(feat_df["Date"].dt.strftime("%Y-%m").unique().tolist())
    pcodes = sorted(feat_df["PCODE"].dropna().unique().tolist())
    return {"anchors": dates, "pcodes": pcodes}


@app.get("/data/schema")
def data_schema():
    return {
        "required_fields": ["PCODE", "Date", "Precip_mm_month", "PET_mm_day", "Mean_Temp_C", "spei06"],
        "date_format": "YYYY-MM-DD",
        "example": {
            "PCODE": "NG025",
            "Date": "2023-11-01",
            "Precip_mm_month": 120.5,
            "PET_mm_day": 146.2,
            "Mean_Temp_C": 28.9,
            "spei06": 0.55,
        },
    }


@app.get("/forecast/{pcode}")
def forecast_get(pcode: str, anchor: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"), model_key: Optional[str] = None):
    pcode = pcode.upper().strip()
    if pcode not in STATES_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown PCODE: {pcode}")
    key, info = _model_info(model_key)
    return _forecast_for_state(pcode, anchor, key, int(info["horizon_months"]))


@app.get("/forecasts/latest")
def forecasts_latest(anchor: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"), model_key: Optional[str] = None):
    key, info = _model_info(model_key)
    horizon = int(info["horizon_months"])
    out = []
    for pcode in STATES_MAP.keys():
        try:
            out.append(_forecast_for_state(pcode, anchor, key, horizon))
        except HTTPException:
            continue
    return out


@app.get("/history/{pcode}")
def history_get(
    pcode: str,
    anchor: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    limit: int = Query(default=24, ge=1, le=120),
):
    pcode = pcode.upper().strip()
    if pcode not in STATES_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown PCODE: {pcode}")
    rows = _state_rows(pcode, anchor).tail(limit).reset_index(drop=True)
    history = []
    for i, row in enumerate(rows.itertuples(index=False), start=1):
        history.append(
            {
                "month": i,
                "month_label": row.Date.strftime("%b %y"),
                "year": int(row.Date.year),
                "month_num": int(row.Date.month),
                "rainfall": float(getattr(row, "Precip_mm_month", 0.0)),
                "temperature": float(getattr(row, "Mean_Temp_C", 0.0)),
                "pet": float(getattr(row, "PET_mm_day", 0.0)),
                "spei": float(row.spei06),
                "is_real": True,
            }
        )
    return {"pcode": pcode, "anchor": rows["Date"].iloc[-1].strftime("%Y-%m"), "current_spei": float(rows["spei06"].iloc[-1]), "history": history}


@app.post("/data/update")
def data_update(req: DataUpdateRequest):
    global raw_df, feat_df
    try:
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)
        new_rows = []
        for pcode, records in req.ingested_data.items():
            pcode = pcode.upper().strip()
            for r in records:
                month = int(r["month"])
                new_rows.append(
                    {
                        "PCODE": pcode,
                        "Date": pd.Timestamp(int(r["year"]), month, 1),
                        "Precip_mm_month": float(r.get("Precip_mm_month", r.get("chirps_rain_month", 0))),
                        "Mean_Temp_C": float(r.get("Mean_Temp_C", 0)),
                        "PET_mm_day": float(r.get("PET_mm_day", 0)),
                        "spei06": float(r["spei06"]) if r.get("spei06") is not None else float("nan"),
                    }
                )
        if not new_rows:
            return {"updated": False, "message": "No rows to process"}

        new_df = pd.DataFrame(new_rows)
        old_df = raw_df.copy() if raw_df is not None else pd.DataFrame()
        if not old_df.empty:
            key_cols = ["PCODE", "Date"]
            existing = old_df[~old_df.set_index(key_cols).index.isin(new_df.set_index(key_cols).index)].copy()
            combined = pd.concat([existing, new_df], ignore_index=True)
        else:
            combined = new_df.copy()
        combined = combined.sort_values(["PCODE", "Date"]).reset_index(drop=True)
        combined = combined[["PCODE", "Date", "Precip_mm_month", "PET_mm_day", "Mean_Temp_C", "spei06"]]
        raw_df = combined
        feat_df = _build_feature_table(raw_df)
        raw_df.to_parquet(RAW_DATA_PATH, index=False)
        feat_df.to_parquet(FEATURE_DATA_PATH, index=False)
        return {"updated": True, "total_rows": len(feat_df), "pcodes": int(feat_df["PCODE"].nunique())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/data/upload")
def data_upload(req: DatasetRowsRequest):
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in req.rows:
        required = ["PCODE", "Date", "Precip_mm_month", "PET_mm_day", "Mean_Temp_C", "spei06"]
        missing = [k for k in required if k not in row]
        if missing:
            raise HTTPException(status_code=422, detail=f"Missing columns: {missing}")
        pcode = str(row["PCODE"]).upper().strip()
        dt = pd.Timestamp(row["Date"])
        grouped.setdefault(pcode, []).append(
            {
                "year": int(dt.year),
                "month": int(dt.month),
                "Precip_mm_month": float(row["Precip_mm_month"]),
                "PET_mm_day": float(row["PET_mm_day"]),
                "Mean_Temp_C": float(row["Mean_Temp_C"]),
                "spei06": float(row["spei06"]),
            }
        )
    return data_update(DataUpdateRequest(ingested_data=grouped))


@app.get("/states")
def states():
    return {"states": STATES}


registry = _ensure_registry()
raw_df = _load_raw_data()
feat_df = _build_feature_table(raw_df) if raw_df is not None else None
loaded_models = _load_models()
scalers_by_pcode = _load_scalers()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
