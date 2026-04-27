-- Nigeria Drought Forecast Platform — PostgreSQL Schema
DROP TABLE IF EXISTS model_metrics CASCADE;
DROP TABLE IF EXISTS forecasts CASCADE;
DROP TABLE IF EXISTS historical_climate CASCADE;
DROP TABLE IF EXISTS states CASCADE;

CREATE TABLE states (
    id         SERIAL PRIMARY KEY,
    pcode      VARCHAR(10) UNIQUE NOT NULL,
    name       VARCHAR(100) NOT NULL,
    region     VARCHAR(50)  NOT NULL,
    lat        DECIMAL(8,5),
    lng        DECIMAL(8,5),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE historical_climate (
    id              SERIAL PRIMARY KEY,
    state_id        INTEGER REFERENCES states(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    chirps_rain_month DECIMAL(8,2),
    rfq             DECIMAL(6,2),
    r1q             DECIMAL(6,2),
    Mean_Temp_C     DECIMAL(5,2),
    PET_mm_day      DECIMAL(8,2),
    month_sin       DECIMAL(8,6),
    month_cos       DECIMAL(8,6),
    spei06          DECIMAL(6,4),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(state_id, year, month)
);

CREATE TABLE forecasts (
    id             SERIAL PRIMARY KEY,
    state_id       INTEGER REFERENCES states(id) ON DELETE CASCADE,
    anchor_year    INTEGER NOT NULL,
    anchor_month   INTEGER NOT NULL CHECK (anchor_month BETWEEN 1 AND 12),
    horizon        INTEGER NOT NULL CHECK (horizon BETWEEN 1 AND 6),
    spei_value     DECIMAL(6,4) NOT NULL,
    model_version  VARCHAR(50) DEFAULT 'transformer-v1.0',
    created_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE(state_id, anchor_year, anchor_month, horizon)
);

CREATE TABLE model_metrics (
    id            SERIAL PRIMARY KEY,
    horizon       INTEGER NOT NULL CHECK (horizon BETWEEN 1 AND 6),
    mae           DECIMAL(8,6) NOT NULL,
    rmse          DECIMAL(8,6) NOT NULL,
    baseline_mae  DECIMAL(8,6),
    r2_score      DECIMAL(6,4),
    model_version VARCHAR(50) DEFAULT 'transformer-v1.0',
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_forecasts_state_anchor ON forecasts(state_id, anchor_year, anchor_month);
CREATE INDEX idx_climate_state_period   ON historical_climate(state_id, year, month);
CREATE INDEX idx_states_pcode           ON states(pcode);

-- Seed states
INSERT INTO states (pcode,name,region,lat,lng) VALUES
('NG001','Abia','South East',5.4318,7.4883),
('NG002','Adamawa','North East',9.1626,12.2916),
('NG003','Akwa Ibom','South South',4.9905,7.7956),
('NG004','Anambra','South East',6.2485,6.9379),
('NG005','Bauchi','North East',10.9979,9.3258),
('NG006','Bayelsa','South South',4.7719,6.0699),
('NG007','Benue','North Central',7.3369,8.7407),
('NG008','Borno','North East',12.2454,13.1567),
('NG009','Cross River','South South',5.9000,8.5987),
('NG010','Delta','South South',5.6803,5.9705),
('NG011','Ebonyi','South East',6.2649,8.0137),
('NG012','Edo','South South',6.6442,5.9301),
('NG013','Ekiti','South West',7.7190,5.3110),
('NG014','Enugu','South East',6.4584,7.5464),
('NG015','FCT Abuja','North Central',8.8854,7.1697),
('NG016','Gombe','North East',10.3636,11.1993),
('NG017','Imo','South East',5.4921,7.0247),
('NG018','Jigawa','North West',12.2280,9.3615),
('NG019','Kaduna','North West',10.3764,7.7095),
('NG020','Kano','North West',11.7463,8.5249),
('NG021','Katsina','North West',12.4517,7.6586),
('NG022','Kebbi','North West',11.8267,4.1885),
('NG023','Kogi','North Central',7.6612,6.5698),
('NG024','Kwara','North Central',8.9667,4.3877),
('NG025','Lagos','South West',6.5244,3.3792),
('NG026','Nasarawa','North Central',8.4966,8.1999),
('NG027','Niger','North Central',9.9388,5.5981),
('NG028','Ogun','South West',7.1600,3.3500),
('NG029','Ondo','South West',7.2500,5.2000),
('NG030','Osun','South West',7.5629,4.5200),
('NG031','Oyo','South West',8.1574,3.6146),
('NG032','Plateau','North Central',9.2182,9.5179),
('NG033','Rivers','South South',4.8396,6.9112),
('NG034','Sokoto','North West',13.0059,5.2476),
('NG035','Taraba','North East',7.9993,10.7762),
('NG036','Yobe','North East',12.2939,11.4390),
('NG037','Zamfara','North West',12.1702,6.6607);

-- Seed real evaluation metrics
INSERT INTO model_metrics (horizon,mae,rmse,baseline_mae,r2_score) VALUES
(1,0.273,0.372,0.902,0.9120),
(2,0.302,0.415,0.920,0.8890),
(3,0.327,0.445,0.938,0.8630),
(4,0.359,0.484,0.952,0.8410),
(5,0.387,0.522,0.967,0.8170),
(6,0.424,0.574,0.979,0.7890);
