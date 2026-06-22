import os
import json
import logging
from groq import Groq
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Load API keys from environment
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

DEFAULT_METADATA = {
    "title": "Unknown Title",
    "authors": [],
    "publication_year": "Unknown",
    "research_domain": "Unknown",
    "keywords": [],
    "methodologies": [],
    "datasets": [],
    "evaluation_metrics": [],
    "key_findings": [],
    "limitations": [],
    "future_work": [],
    "confidence_score": 0.0
}

EXTRACTION_PROMPT = """
You are a highly advanced academic research paper parser.
Extract the metadata from the following research paper text.
Return ONLY a valid JSON object matching the exact format schema below. Do not include markdown code block syntax (like ```json ... ```), preamble, or explanations. Just return raw JSON.

JSON Schema:
{
    "title": "string (the paper title)",
    "authors": ["string (author name)", ...],
    "publication_year": "string (the 4-digit publication year or 'Unknown')",
    "research_domain": "string (field of study / subject area)",
    "keywords": ["string", ...],
    "methodologies": ["string", ...],
    "datasets": ["string (name of datasets used, or 'Custom Dataset')", ...],
    "evaluation_metrics": ["string (e.g. F1-Score, accuracy, RMSE)", ...],
    "key_findings": ["string (main results / contributions)", ...],
    "limitations": ["string (limitations of the work)", ...],
    "future_work": ["string (proposed future research directions)", ...],
    "confidence_score": 0.0-1.0 (float reflecting your confidence in this extraction)
}

Paper text content (truncated):
{paper_text}
"""

def validate_and_clean_metadata(data: dict) -> dict:
    """Ensures all expected keys are present, type-correct, and calculates/cleans the confidence score."""
    cleaned = {}
    for key, val in DEFAULT_METADATA.items():
        if key not in data:
            cleaned[key] = val
        else:
            # Type assertion
            if isinstance(val, list):
                cleaned[key] = [str(x).strip() for x in data[key]] if isinstance(data[key], list) else []
            elif isinstance(val, float):
                try:
                    cleaned[key] = float(data[key])
                except:
                    cleaned[key] = 0.0
            else:
                cleaned[key] = str(data[key]).strip()

    # Programmatic check for confidence adjustment
    empty_fields = 0
    total_fields = len(DEFAULT_METADATA) - 1 # exclude confidence_score
    for key, val in cleaned.items():
        if key == "confidence_score":
            continue
        if not val or val == "Unknown" or val == "Unknown Title":
            empty_fields += 1
            
    programmatic_confidence = (total_fields - empty_fields) / total_fields
    # Blend LLM confidence with programmatic confidence
    cleaned["confidence_score"] = round((cleaned.get("confidence_score", 0.5) * 0.5) + (programmatic_confidence * 0.5), 2)
    return cleaned

def extract_via_groq(text: str, client: Groq) -> dict:
    """Performs extraction using Groq llama-3.3-70b-versatile."""
    # Truncate text to avoid context limits (using about 8000 tokens / 30000 characters)
    truncated_text = text[:30000]
    prompt = EXTRACTION_PROMPT.format(paper_text=truncated_text)
    
    # Try calling Groq with JSON Mode
    response = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        temperature=0.1,
        response_format={"type": "json_object"}
    )
    raw_content = response.choices[0].message.content.strip()
    return json.loads(raw_content)

def extract_via_gemini(text: str) -> dict:
    """Performs extraction using Google Gemini fallback."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")
        
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    truncated_text = text[:30000]
    prompt = EXTRACTION_PROMPT.format(paper_text=truncated_text)
    
    response = model.generate_content(prompt)
    if not response or not response.text:
        raise RuntimeError("Gemini returned empty response")
        
    raw_content = response.text.strip()
    
    # Remove markdown code fencing if Gemini returned it
    if raw_content.startswith("```"):
        lines = raw_content.split("\n")
        # remove first and last lines
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        raw_content = "\n".join(lines).strip()
        
    return json.loads(raw_content)

def extract_paper_metadata(pdf_text: str) -> dict:
    """
    Core function to extract paper metadata.
    Uses Groq as primary, fallback to Gemini.
    Validates output and retries up to 3 times if JSON is malformed.
    """
    if not pdf_text or not pdf_text.strip():
        logger.warning("Empty PDF text provided. Returning defaults.")
        return DEFAULT_METADATA.copy()

    # Try Groq first
    if GROQ_API_KEY:
        client = Groq(api_key=GROQ_API_KEY)
        for attempt in range(1, 4):
            try:
                logger.info(f"Attempting Groq metadata extraction (Attempt {attempt})...")
                extracted_data = extract_via_groq(pdf_text, client)
                return validate_and_clean_metadata(extracted_data)
            except Exception as e:
                logger.warning(f"Groq extraction attempt {attempt} failed: {e}")
                
    # Fallback to Gemini
    if GEMINI_API_KEY:
        for attempt in range(1, 4):
            try:
                logger.info(f"Attempting Gemini fallback metadata extraction (Attempt {attempt})...")
                extracted_data = extract_via_gemini(pdf_text)
                return validate_and_clean_metadata(extracted_data)
            except Exception as e:
                logger.warning(f"Gemini fallback attempt {attempt} failed: {e}")

    logger.error("All extraction attempts failed. Returning default metadata.")
    return DEFAULT_METADATA.copy()
