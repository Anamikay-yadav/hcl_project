# Bank Muscat Customer Review Sentiment Analyzer

A customer-review analytics project with a React dashboard, a Python API and Streamlit dashboard, and a TF-IDF sentiment classifier. It includes a 5,000-record review dataset, model-training code, and PDF-analysis/reporting modules.

## Features

- Review sentiment classification using TF-IDF features and logistic regression.
- Dashboard and review-management screens in the React application.
- FastAPI endpoints for authentication, sentiment analysis, review data, and reporting.
- A Streamlit dashboard for exploring sentiment, ratings, channels, and categories.
- PDF text extraction and report-generation modules in `server/`.
- Model-training scripts in Python and JavaScript.

## Technology stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, and Motion.
- **API and analytics:** FastAPI, Streamlit, pandas, and MongoDB/PyMongo.
- **Machine learning:** scikit-learn TF-IDF vectorization and logistic regression.
- **PDF processing:** `pdfjs-dist` and `pdf-lib`.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | React application, pages, components, and bundled model data |
| `backend/` | FastAPI application, MongoDB access, authentication, and model training |
| `server/` | PDF extraction and report-generation modules |
| `data/` | Dataset used by the Python API and Streamlit dashboard |
| `dataset/` | An identical copy of the project review dataset |
| `data/data_dictionary.csv` | Field definitions for the review dataset |
| `notebooks/eda.ipynb` | Exploratory data analysis notebook |
| `streamlit_app.py` | Standalone Streamlit analytics dashboard |
| `tests/` | Node.js tests for PDF analysis |

## Dataset

The project dataset contains 5,000 review records. Its fields include review ID and date, review text, sentiment label, rating, service category, channel, location, language, and anomaly flag. See [`data/data_dictionary.csv`](data/data_dictionary.csv) for definitions. The notebook reads the CSV from `data/` and computes its summaries and charts when run.

## Setup and execution

### Python API

1. Create and activate a virtual environment:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install dependencies and prepare local configuration:

   ```powershell
   python -m pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

3. Edit `.env` with your own MongoDB connection string and a newly generated JWT secret. For example, generate a secret with:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

   Never commit `.env` or use a shared production secret.

4. Start the API:

   ```powershell
   uvicorn backend.main:app --reload --port 8000
   ```

The API uses `MONGODB_URI` for persistence and requires `JWT_SECRET` for authentication. A local MongoDB URI is provided as a non-secret default in `.env.example`.

### Streamlit dashboard

With the Python dependencies installed, start the standalone dataset dashboard:

```powershell
streamlit run streamlit_app.py
```

### React application and Node.js checks

Install the JavaScript dependencies and run the available build, type-check, and test commands:

```powershell
npm install
npm run build
npm run lint
npm test
```

The current `dev` and `start` scripts reference `server.ts`, which is not present in this project folder; they cannot start the frontend as currently configured. The React source and PDF processing modules are included.

### Train the model

The Python API can train and save the model artifacts on first use. To train explicitly:

```powershell
python -m backend.train_model
```

The generated `.joblib` files are local artifacts and are excluded from Git. A JavaScript training script is also available:

```powershell
node scripts/train_model.js
```

### Explore the data

Install Jupyter if needed, then launch the notebook from the project root:

```powershell
python -m pip install notebook
jupyter notebook notebooks/eda.ipynb
```

## Tests and checks

```powershell
npm test
npm run lint
npm run build
```

The Node.js tests cover PDF extraction and analysis behavior. The lint script runs the TypeScript compiler without emitting files.
