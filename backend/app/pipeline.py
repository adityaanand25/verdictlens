# app/pipeline.py
import os
import io
import re
from pathlib import Path

import spacy
import torch
from dotenv import load_dotenv
from pypdf import PdfReader
from summa import summarizer
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# 1. Resolve Local Paths
BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")
MODEL_PATH = Path(
    os.getenv("VERDICTLENS_MODEL_PATH", "ai_models/verdictlens_led_model")
)
if not MODEL_PATH.is_absolute():
    MODEL_PATH = BASE_DIR / MODEL_PATH

print("⏳ Initializing models... (This may take a moment)")

# Load Local Tokenizer & Model
if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Could not find model weights at '{MODEL_PATH}'. "
        "Please ensure your downloaded folder is placed inside 'backend/ai_models/'."
    )

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_PATH)

# Enforce local GPU if available
device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)

# Load spacy for NLU
nlp = spacy.load("en_core_web_sm")

print(f"✅ Models loaded successfully on: {device.upper()}")

def preprocess_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts raw text directly from PDF file bytes."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    full_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text.append(text)
    return "\n".join(full_text)

def extract_nlu_legal_entities(text: str) -> dict:
    """Extracts legal statutes, dates, and parties using NLU rules."""
    nlu_data = {"acts_sections": [], "dates": [], "parties": []}
    
    # Rule-based NLU for Indian Statutes
    section_pattern = r"(?:Section\s+\d+[A-Za-z]*(?:\s*\([0-9a-zA-Z]+\))*|\bIPC\b|\bCrPC\b|\bCPC\b|\bPOSCO\b|\bNDPS\b|Article\s+\d+)"
    acts_found = list(set(re.findall(section_pattern, text, flags=re.IGNORECASE)))
    nlu_data["acts_sections"] = acts_found[:8]
    
    # Statistical NLU using spaCy NER
    doc = nlp(text[:10000])  # Scan the critical introductory chapters of the judgment
    for ent in doc.ents:
        if ent.label_ == "DATE" and ent.text not in nlu_data["dates"]:
            nlu_data["dates"].append(ent.text)
        elif ent.label_ in ["PERSON", "ORG"] and len(ent.text) > 3:
            if ent.text not in nlu_data["parties"]:
                nlu_data["parties"].append(ent.text)
                
    nlu_data["dates"] = nlu_data["dates"][:4]
    nlu_data["parties"] = nlu_data["parties"][:6]
    return nlu_data

def generate_summary_pipeline(pdf_bytes: bytes) -> dict:
    """Combines PDF extraction, NLU metadata generation, and abstractive summarizing."""
    # 1. Parse PDF
    raw_text = extract_text_from_pdf(pdf_bytes)
    if not raw_text.strip():
        raise ValueError("Could not extract readable text from the uploaded PDF.")
    
    # 2. Extract NLU Metadata
    entities = extract_nlu_legal_entities(raw_text)
    
    # Build anchor header
    header = "[CASE METADATA]\n"
    if entities["acts_sections"]:
        header += f"Statutes/Provisions: {', '.join(entities['acts_sections'])}\n"
    if entities["parties"]:
        header += f"Parties/Entities: {', '.join(entities['parties'])}\n"
    if entities["dates"]:
        header += f"Key Dates: {', '.join(entities['dates'])}\n"
    header += "[ARGUMENTS & EVIDENCE]\n"
    
    # 3. Two-Stage Extractive Condensation (TextRank)
    cleaned = preprocess_text(raw_text)
    condensed_text = summarizer.summarize(cleaned, ratio=0.25) or cleaned[:6000]
    
    # 4. Concatenate and run Abstractive Generation (Your LED Model)
    augmented_input = header + condensed_text
    inputs = tokenizer(augmented_input, max_length=4096, truncation=True, return_tensors="pt").to(device)
    
    with torch.no_grad():
        summary_ids = model.generate(
    inputs.input_ids,
    attention_mask=inputs.attention_mask,
    num_beams=4,              # 🔄 Edit this: Higher numbers (3-5) increase quality but slow down generation.
    min_length=100,           # 🔄 Edit this: Enforce a minimum length for long judgments.
    max_length=400,           # 🔄 Edit this: Enforce a strict word ceiling.
    no_repeat_ngram_size=3,   # 🔄 Edit this: Prevents the model from repeating 3-word phrases.
    temperature=0.3,          # 🔄 Edit this: Lower values (0.1 - 0.3) make the output highly factual; higher values (0.7+) make it creative.
    early_stopping=True
)

        
    final_summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True, clean_up_tokenization_spaces=True)
    
    return {
        "metadata": entities,
        "summary": final_summary,
        "word_counts": {
            "original_count": len(raw_text.split()),
            "summary_count": len(final_summary.split())
        }
    }
