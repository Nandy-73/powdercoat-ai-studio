# 🎨 PowderCoat AI Studio

**Enterprise AI Platform for Powder Coating Research, Formulation, Color Matching, Manufacturing, Quality Control, Procurement, and Business Intelligence.**

A production-grade, full-stack platform that replaces Excel-based formulation management for powder coating R&D. It combines a FastAPI + PostgreSQL backend, real machine-learning models (XGBoost, scikit-learn), a physics-informed color-science engine (CIEDE2000 / CIELAB), and a premium React 19 + TypeScript frontend with dark/light glassmorphism UI.

---

## ✨ Feature Modules

| # | Module | Highlights |
|---|--------|-----------|
| 1 | **Executive Dashboard** | Live KPIs, cost/quality/color trends, material consumption, Recharts visualizations |
| 2 | **Smart Formulation Builder** | Epoxy / polyester / hybrid / PU / acrylic / custom; auto weight %, resin ratio, binder, pigment loading, **PVC**, cost/kg |
| 3 | **Material Database** | 37 seeded industrial raw materials with density, chemical family, cost, supplier, safety, TDS/SDS links |
| 4 | **AI Formulation Validation** | Rule engine detects wrong resin ratio, pigment overload, flow-agent excess, bad PVC, cure issues, incompatibilities — each with explanation + correction |
| 5 | **AI Color Matching** ⭐ | CIEDE2000 ΔE, RGB↔LAB↔HEX, RAL estimation, image upload with dominant-color extraction, hue diagnosis, live preview |
| 6 | **AI Color Correction** | Quantified pigment adjustments (increase/reduce/replace) before any lab trial |
| 7 | **Finish Prediction** | Gloss (XGBoost) + finish classifier: smooth / fine / sand texture / wrinkle / orange peel |
| 8 | **Mechanical Prediction** | Hardness, adhesion, flexibility, impact, chemical/weather/salt-spray/humidity/outdoor with test estimates |
| 9 | **Manufacturing Intelligence** | Extrusion, cooling, grinding, particle size, sprayability, transfer efficiency, cure schedule, risks |
| 10 | **AI Optimization Engine** | Random-restart local search over composition space toward gloss/hardness/flex/texture/weather/cost targets |
| 11 | **Batch Calculator** | Lab → pilot → production → factory scaling with exact percentages |
| 12 | **Cost Intelligence** | Material/production cost, margin, lower-cost alternative suggestions |
| 13 | **Knowledge Base** | Version history, trial history, AI similarity search |
| 14 | **AI Assistant** | Natural-language: "reduce cost by 10%", "increase gloss to 95", "correct this red", "suggest low-cost black" |
| 15 | **Supplier Intelligence** | 14 global suppliers with products, MOQ, lead time, certifications |
| 16 | **Price Intelligence** | Country-level benchmarks ranked by price / quality / delivery / rating |
| 17 | **Machinery Intelligence** | 18 machines: mixers, extruders, cooling, crushers, grinding, sieving, packaging, lab |
| 18 | **Market Intelligence** | Technology, trend, shortage, price, alternative, sustainability, regulation insights |
| 19 | **Reports** | CSV/Excel exports + printable formulation dossiers (Print → PDF) |
| 20 | **User Roles** | 9 roles, JWT auth, role-based access control |

---

## 🏗️ Tech Stack

**Frontend** — React 19, TypeScript, Vite 6, Tailwind CSS, React Router 7, Framer Motion, TanStack Query, React Hook Form, Recharts
**Backend** — Python 3.12, FastAPI, SQLAlchemy 2, PostgreSQL (SQLite fallback), Alembic, JWT (python-jose), WebSocket
**AI/ML** — NumPy, Pandas, scikit-learn, XGBoost, Pillow; custom CIEDE2000 color engine
**Deployment** — Docker, Docker Compose, Nginx

---

## 🚀 Quick Start

### Option A — Docker (recommended)

```bash
cp .env.example .env      # edit secrets for production
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API + docs: http://localhost:8000/docs

The backend auto-creates tables and seeds industrial reference data on first boot.

### Option B — Local development

**Backend**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000  (uses SQLite by default)
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173  (proxies /api to :8000)
```

---

## 🔑 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Administrator | `admin@powdercoat.ai` | `admin123` |
| Senior R&D Manager | `rd.manager@powdercoat.ai` | `manager123` |
| R&D Engineer | `rd.engineer@powdercoat.ai` | `engineer123` |
| Color Engineer | `color@powdercoat.ai` | `color123` |
| Production Manager | `production@powdercoat.ai` | `production123` |
| QC Engineer | `qc@powdercoat.ai` | `qc123` |
| Procurement Manager | `procurement@powdercoat.ai` | `procure123` |
| Viewer | `viewer@powdercoat.ai` | `viewer123` |

The login screen has one-click buttons for the main demo roles.

---

## 🧪 Testing

```bash
cd backend
.venv\Scripts\python -m pytest tests -q   # 24 tests: color science, formulation engine, full API
```

Frontend type-check + production build:
```bash
cd frontend
npm run build
```

---

## 📁 Project Structure

```
powder_coating_new/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/                 # migrations
│   └── app/
│       ├── main.py              # FastAPI app + router wiring
│       ├── core/                # config, security (JWT), logging
│       ├── db/                  # session, seed data
│       ├── models/              # SQLAlchemy models
│       ├── schemas/             # Pydantic schemas
│       ├── api/routes/          # 13 routers (auth, materials, formulations, color, ai, …)
│       └── ai/                  # color_science, formulation_engine, prediction, optimizer, cost, assistant
│   └── tests/
└── frontend/
    ├── Dockerfile + nginx.conf
    └── src/
        ├── api/                 # typed client, hooks, types
        ├── context/             # Auth + Theme
        ├── components/          # UI kit, layout, pickers
        └── pages/               # 20 module pages
```

---

## 🔬 Notable Engineering

- **Color science from scratch** — sRGB→XYZ→CIELAB (D65) and full **CIEDE2000** ΔE implemented in NumPy, plus nearest-RAL search over 30 seeded RAL classic colors.
- **Physics-informed ML** — models train on a 10k-sample synthetic dataset generated from domain response functions (PVC, stoichiometry, flow, cure index) so predictions are directionally correct, not random.
- **Real formulation math** — PVC via volume fractions using material densities, resin:hardener stoichiometry windows per chemistry system, category loading limits.
- **SQLite fallback** — runs with zero infrastructure locally; switches to PostgreSQL via `DATABASE_URL` in Docker.

---

## ⚙️ Configuration

Backend reads environment variables (see `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite:///./powdercoat.db` | DB connection (Postgres in Docker) |
| `SECRET_KEY` | dev key | JWT signing — **change in production** |
| `SEED_DATA` | `true` | Seed reference data on startup |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | JWT lifetime |

---

*Built as a complete, deployable reference platform for the powder coating industry.*
