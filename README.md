# RAG-Based Research Paper & IEEE Generator (Flask + Premium UI)

This project is a Flask application that lets you:

- Upload IEEE-style research papers in PDF format
- Automatically extract structured metadata (Paper Intelligence layer) before indexing
- Build a Retrieval-Augmented Generation (RAG) index over those papers
- Generate:
  - A unified literature review
  - Research gaps and novel research ideas
  - A full IEEE-style research paper (grounded in the uploaded corpus)
  - A DOCX version of the generated paper
- Browse extracted figures from PDFs
- Ask arbitrary questions over all uploaded papers
- View all structured paper intelligence metadata on a dedicated dashboard

The app combines **LangChain + FAISS** for retrieval, **Groq LLMs** for analysis and metadata extraction, and **Gemini** for long-form IEEE-style paper generation.

---

## Features

- **Research Paper Intelligence Extraction Layer**
  - Extract structured metadata (JSON format) containing: Title, Authors, Publication Year, Research Domain, Keywords, Methodologies, Datasets, Evaluation Metrics, Key Findings, Limitations, and Future Work.
  - Automatically calculates extraction confidence score.
  - Persists metadata to disk in `metadata_store/`.
  
- **RAG-backed literature analysis**
  - Upload multiple IEEE PDFs and build an in-memory FAISS vector store
  - Semantic chunking with overlapping windows for better recall
  - Similarity search powered by `sentence-transformers/all-MiniLM-L6-v2`

- **Groq-powered insights**
  - Unified literature review across all uploaded papers
  - Research gaps and 3+ novel research ideas
  - Free-form Q&A over the indexed corpus

- **Gemini IEEE paper generator**
  - Multi-step prompting to produce a structured IEEE paper:
    - Title & Abstract
    - I. Introduction
    - II. Literature Survey
    - III. Proposed Methodology
    - IV. Expected Results
    - V. Conclusion
    - VI. References (grounded in uploaded papers)

- **DOCX export**
  - Automatically converts the generated paper into a `.docx` file
  - Optionally appends extracted figures in an "Appendix" section

- **Visual figures view**
  - Extracts sufficiently large images from PDFs and displays them in the UI

---

## Tech Stack

- **Frontend / UI**: HTML5 + Vanilla CSS (Premium Glassmorphism Dark Theme) + Vanilla JS (AJAX)
- **Backend API**: Flask + Flask-CORS
- **LLMs**:
  - Groq: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`
  - Google Gemini: `gemini-2.5-flash`
- **RAG / Retrieval**:
  - LangChain `RecursiveCharacterTextSplitter`
  - `HuggingFaceEmbeddings` with `all-MiniLM-L6-v2`
  - FAISS in-memory vector store
- **PDF Parsing**:
  - `pypdf` (or fallback `PyPDF2`)
  - `Pillow` for image extraction
- **Export**:
  - `python-docx` for DOCX generation
- **Config**:
  - `python-dotenv` for local environment variable loading

---

## Project Structure

- `app.py` – Main Flask web application and RAG/LLM orchestration
- `paper_intelligence.py` – Core metadata extraction engine
- `test_paper_intelligence.py` – Automated unit test cases
- `templates/index.html` – Premium Web Dashboard template
- `static/` – Stylesheet (`style.css`) and script (`main.js`)
- `requirements.txt` – Python dependencies

---

## Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/prasadchaudhari2005/RAG-Based-Research-Paper-Generator.git
cd RAG-Based-Research-Paper-Generator
```

### 2. Create and activate a virtual environment
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
Create a `.env` file in the project root with:
```env
GROQ_API_KEY="your_groq_key_here"
GEMINI_API_KEY="your_gemini_key_here"
```

---

## Running the App

From the project root:
```bash
python app.py
```

This will run the server locally. Open **`http://localhost:5000`** in your browser.

---

## API Endpoints Reference

### Ingestion & RAG
- `POST /api/upload`: Uploads PDF files, extracts metadata and builds/merges the FAISS index.
- `GET /api/status`: Returns whether any paper is indexed.

### Intelligence Layer
- `GET /api/metadata`: Returns all persisted metadata JSON.
- `GET /api/metadata/<paper_name>`: Returns metadata for a specific paper.

### Text Generation & Utilities
- `POST /api/review`: Generates literature review using Groq.
- `POST /api/gaps`: Analyzes gaps & suggests 3 novel ideas using Groq.
- `POST /api/generate-paper`: Generates a structured IEEE paper using Gemini.
- `GET /api/download-docx`: Downloads the generated paper as a `.docx` file.
- `POST /api/ask`: Semantic search question-answering.
- `GET /api/images` & `GET /api/image/<img_id>`: Retrieves extracted figures.
