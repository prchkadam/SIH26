<div align="center">

# CIRAS — Criminal Intelligence & Relationship Analysis System

**Turning unstructured crime data into a structured, evidence-backed investigation workspace.**

**[🔗 Live Demo](http://187.124.96.95/)**

</div>

---

## Overview

**CIRAS** is a data analysis platform designed to ingest unstructured text (FIRs, statements, phone logs), normalize it into structured entities, and process it through multiple analysis engines: knowledge graph, temporal, anomaly detection, and similarity search. It provides an AI copilot to query the processed data and features a tamper-evident audit trail where every action is hash-chained to ensure data integrity.

---

## Project Structure

```text
SIH26/
├── backend/                  # FastAPI backend
│   ├── app/                  # Application core (routers, models, logic)
│   ├── migrate_db.py         # Database schema migrations
│   ├── seed.py               # Synthetic data generation
│   └── requirements.txt      # Python dependencies
└── frontend/                 # React + Vite frontend
    ├── src/                  # React components, pages, and API clients
    ├── package.json          # Node dependencies
    └── vite.config.js        # Vite configuration
```

---

## Local Setup & Installation

### Prerequisites

To run this project locally, ensure you have the following installed:
- **Node.js** (v18+ recommended)
- **Python 3.9+**
- **PostgreSQL** (Running locally or via Docker)
- **Tesseract OCR** (Must be installed and added to your system PATH)

### 1. Clone the Repository

```bash
git clone https://github.com/prchkadam/SIH26.git
cd SIH26
```

### 2. Environment Configuration

You will need to configure environment variables for the backend. Create a `.env` file in the `backend/` directory:

```bash
# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/ciras_db
SECRET_KEY=your_super_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```
*(Note: Modify the `DATABASE_URL` to match your local PostgreSQL credentials. If using SQLite, adjust accordingly.)*

### 3. Backend Setup (FastAPI)

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required dependencies
pip install -r requirements.txt

# Run database setup and seed initial data
python migrate_db.py
python seed.py

# Start the FastAPI development server
uvicorn app.main:app --reload
```
The backend API documentation will be available at `http://127.0.0.1:8000/docs`.

### 4. Frontend Setup (React + Vite)

Open a new terminal window for these steps.

```bash
# From the project root, navigate to the frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Start the Vite development server
npm run dev
```
The investigator dashboard will be accessible at `http://localhost:5173`.

---

## Architecture

### Data Ingestion & Access Control

```mermaid
flowchart TD
    A["Unstructured data<br/>FIRs · statements · phone logs"] --> B["OCR<br/>Tesseract / Google Cloud OCR"]
    B --> C["RegEx extraction"]
    C --> D["LLM-based NER"]
    D --> E["Entity normalization<br/>canonicalize sections · dedupe names"]
    F["Structured data<br/>NCRB · I4C · CCTNS"] --> G[("PostgreSQL")]
    E --> G
    G --> H{{"Attribute-Based<br/>Access Control"}}
    H -->|"granted"| I["Available to<br/>analysis pipeline"]
    H -.->|"every attempt logged"| J["Audit log"]

    classDef input fill:#E6F1FB,stroke:#185FA5,color:#042C53;
    classDef process fill:#E1F5EE,stroke:#0F6E56,color:#04342C;
    classDef store fill:#F1EFE8,stroke:#5F5E5A,color:#2C2C2A;
    classDef gate fill:#FAEEDA,stroke:#854F0B,color:#412402;
    class A,F input;
    class B,C,D,E process;
    class G,I store;
    class H,J gate;
```

Every database read/write is checked against case assignment, clearance level, and department.

### Analysis Pipeline

```mermaid
flowchart TD
    A[("PostgreSQL")] --> B["Engine analysis pipeline"]
    B --> C1["Knowledge graph engine"]
    B --> C2["Temporal engine"]
    B --> C3["Pattern & anomaly engine"]
    B --> C4["Similarity search engine"]
    C1 --> D{{"Trust layer<br/>SHA-256 hash chain + external checkpointing"}}
    C2 --> D
    C3 --> D
    C4 --> D
    D --> E["Investigator dashboard<br/>React + Tailwind"]

    classDef store fill:#F1EFE8,stroke:#5F5E5A,color:#2C2C2A;
    classDef engine fill:#EEEDFE,stroke:#534AB7,color:#26215C;
    classDef trust fill:#FAEEDA,stroke:#854F0B,color:#412402;
    classDef output fill:#EAF3DE,stroke:#3B6D11,color:#173404;
    class A store;
    class B,C1,C2,C3,C4 engine;
    class D trust;
    class E output;
```

---

## Tech Stack

| Layer | Tools |
|---|---|
| Data Ingestion | Tesseract OCR, RegEx, LLM-based NER |
| Structured Storage | PostgreSQL |
| Knowledge Graph | NetworkX *(or Neo4j AuraDB)* |
| Temporal Engine | Pandas |
| Anomaly Engine | scikit-learn, PrefixSpan |
| Similarity Search | Sentence-Transformers, FAISS, RapidFuzz, TF-IDF |
| Frontend | React, Tailwind CSS |

---

## Testing & Contributing

*(Testing scripts and CI workflows are currently in development.)*

- **Frontend Linting:** Run `npm run lint` (uses `oxlint`) to check for code quality issues.
- Please ensure you are running against a local database when developing new features.

---

<br/>

<div align="center">

### Hackathon Details

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-1a73e8?style=flat-square)](https://sih.gov.in)
![Problem Statement](https://img.shields.io/badge/PS%20ID-26189-6c47ff?style=flat-square)
![Theme](https://img.shields.io/badge/Theme-Blockchain%20%26%20Cybersecurity-0f9d58?style=flat-square)
![Team](https://img.shields.io/badge/Team-Uncool%20Coders-e8710a?style=flat-square)

**Uncool Coders** — Smart India Hackathon 2026 · Team ID 149682

</div>
