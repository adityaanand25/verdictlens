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
    os.getenv("VERDICTLENS_MODEL_PATH", "ai_models/VerdictLens_Final_Model")
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


def is_valid_indian_legal_document(text: str) -> tuple[bool, str]:
    """
    NLU Gatekeeper: Checks if the extracted PDF text contains standard structural
    markers and vocabulary unique to Indian Court Judgments [1].
    
    Returns:
        (bool, reason_string): True if valid, False with a descriptive error if invalid.
    """
    text_upper = text.upper()
    
    # 1. Broad Court Indicators (At least one must match)
    court_indicators = [
        "SUPREME COURT OF INDIA", "HIGH COURT OF", "DISTRICT COURT", 
        "SESSIONS COURT", "FAMILY COURT", "BENCH", "TRIBUNAL"
    ]
    has_court = any(indicator in text_upper for indicator in court_indicators)
    
    # 2. Case Party Indicators (At least two must match to verify legal nature)
    party_indicators = ["APPELLANT", "RESPONDENT", "PETITIONER", "ACCUSED", "PROSECUTION", "DEFENDANT", "PLAINTIFF"]
    matched_parties = [party for party in party_indicators if party in text_upper]
    has_legal_parties = len(matched_parties) >= 2
    
    # 3. Judicial Document Indicators (At least one must match)
    document_indicators = ["JUDGMENT", "ORDER", "WRIT PETITION", "CRIMINAL APPEAL", "CIVIL APPEAL", "ADVOCATE", "COUNSEL"]
    has_judicial_content = any(indicator in text_upper for indicator in document_indicators)
    
    # Run the gating evaluation logic
    if not (has_court and has_legal_parties and has_judicial_content):
        # Diagnose what is missing to give the user clean feedback
        reasons_failed = []
        if not has_court:
            reasons_failed.append("Missing Indian Court identifiers (e.g., 'Supreme Court' or 'High Court') [1].")
        if not has_legal_parties:
            reasons_failed.append("Missing key legal party terms (e.g., 'Appellant', 'Respondent', 'Petitioner') [1].")
        if not has_judicial_content:
            reasons_failed.append("Missing judicial text indicators (e.g., 'Judgment', 'Order', 'Writ Petition') [1].")
            
        error_msg = " | ".join(reasons_failed)
        return False, f"Not a valid Indian Court Judgment. Reasons: {error_msg}"
        
    return True, "Valid legal document verified."


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts raw text directly from PDF file bytes."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    full_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text.append(text)
    return "\n".join(full_text)


# Place this helper function above extract_nlu_legal_entities

def extract_case_citations(text: str) -> list:
    """
    NLU Helper: Extracts Indian Court case citations (AIR, SCC, SCR, Neutral Citations)
    and common "vs." case name patterns from the judgment text.
    """
    citations = []

    # 1. Regex for Reporter & Neutral Citations (e.g., "AIR 1960 SC 845", "(2014) 8 SCC 273", "2024 INSC 835")
    citation_patterns = [
        # Neutral Citations (Supreme Court & High Courts) -> e.g., "2024 INSC 835" or "2023:DHC:2720"
        r"\b\d{4}\s+INSC\s+\d+\b",
        r"\b\d{4}:[A-Z]{3,4}:\d+\b",
        
        # Reporter Citations -> e.g., "(2014) 8 SCC 273", "AIR 1999 SC 22", "1995 CriLJ 124"
        r"\b(?:\(\d{4}\)|\d{4})\s+\d*\s*(?:SCC|SCR|AIR|Scale|JT|CriLJ|CrLJ|ILR|MHC|DHC)\s+\d*\s*\d*\b",
    ]
    
    # 2. Regex for Case Names (e.g., "Arnesh Kumar v. State of Bihar" or "John Doe vs. Jane Doe")
    case_name_pattern = r"\b([A-Z][a-zA-Z'\s\.]+)\s+(?:v\.|vs\.|versus)\s+([A-Z][a-zA-Z'\s\.]+)\b"

    # Match Structured Citations
    for pattern in citation_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            clean_match = re.sub(r'\s+', ' ', match).strip()
            if clean_match not in citations:
                citations.append(clean_match)

    # Match Case Name Patterns (captures common precedent references)
    case_name_matches = re.findall(case_name_pattern, text)
    for match in case_name_matches:
        # Reconstruct "Party A v. Party B" format
        party_a = match[0].strip()
        party_b = match[1].strip()
        
        # Eliminate false positive matches from general English capitals
        if len(party_a.split()) <= 4 and len(party_b.split()) <= 4:
            case_name = f"{party_a} v. {party_b}"
            if case_name not in citations:
                citations.append(case_name)

    return list(set(citations))[:8]  # De-duplicate and return top 8 citations



def classify_citation_treatment(text: str, case_name: str) -> str:
    """
    Semantic NLU Classifier: Analyzes the sentence surrounding a case precedent
    to classify how the judge treated it (Overruled/Distinguished, Followed/Upheld, or Referenced).
    """
    # Extract the sentence containing the case name to capture local context
    sentences = re.split(r'(?<=[.!?])\s+', text)
    context_sentence = ""
    for sentence in sentences:
        if case_name.lower() in sentence.lower():
            context_sentence = sentence
            break
            
    if not context_sentence:
        return "Referenced"
        
    context_upper = context_sentence.upper()
    
    # Define semantic keyword sets reflecting legal treatments
    overruled_indicators = ["OVERRULED", "DISTINGUISHED", "INAPPLICABLE", "ERRONEOUS", "REVERSED", "NOT APPLICABLE"]
    followed_indicators = ["FOLLOWED", "UPHELD", "RELIED UPON", "SUPPORTED BY", "AFFIRMED", "CONCURRED"]
    
    if any(indicator in context_upper for indicator in overruled_indicators):
        return "Distinguished / Overruled"
    elif any(indicator in context_upper for indicator in followed_indicators):
        return "Followed / Upheld"
    
    return "Referenced"


def extract_nlu_legal_entities(text: str) -> dict:
    """
    NLU Component: Extracts legal statutes (IPC/CrPC), articles, 
    key dates, parties, and previous case citations (precedents) with 
    their classified semantic legal treatments (Followed, Overruled, etc.) [1].
    """
    nlu_data = {
        "acts_sections": [],
        "case_precedents": [],
        "dates": [],
        "parties": []
    }
    
    # 🏛️ 1. STATUTES & DETAILED SECTIONS REGEX:
    # Matches detailed provisions: "Section 302 of IPC", "Section 498-A CrPC", "Article 21"
    statute_pattern = (
        r"(?:"
        r"Section\s+\d+[A-Za-z]*(?:\s*\([0-9a-zA-Z]+\))*\s*(?:of\s+)?(?:IPC|CrPC|CPC|Indian\s+Penal\s+Code)?"
        r"|Article\s+\d+[A-Za-z]*\s*(?:of\s+)?(?:the\s+)?(?:Constitution)?"
        r"|\bIPC\b|\bCrPC\b|\bCPC\b"
        r"|\bPOCSO\b|\bNDPS\b"
        r"|\bUAPA\b"
        r"|\bIT\s+Act\b"
        r"|\bCompanies\s+Act\b"
        r")"
    )
    
    acts_found = re.findall(statute_pattern, text, flags=re.IGNORECASE)
    unique_acts = []
    for act in acts_found:
        clean_act = re.sub(r'\s+', ' ', act).strip()
        # Clean naming conventions (standardizing case)
        if clean_act.lower() in ["ipc", "crpc", "cpc", "pocso", "ndps", "uapa"]:
            clean_act = clean_act.upper()
        if clean_act not in unique_acts:
            unique_acts.append(clean_act)
            
    nlu_data["acts_sections"] = unique_acts[:10]
    
    # 📚 2. CASE CITATIONS & PRECEDENTS:
    # ✅ Upgrade: Analyzes surrounding context to extract citation treatments!
    raw_citations = extract_case_citations(text)
    structured_precedents = []
    
    for case in raw_citations:
        treatment = classify_citation_treatment(text, case)
        structured_precedents.append({
            "case_name": case,
            "treatment": treatment
        })
        
    nlu_data["case_precedents"] = structured_precedents[:6] # Top 6 precedents
    
    # 📅 3. STATISTICAL NLU (spaCy NER) for Dates & Core Parties
    doc = nlp(text[:10000])  # Focus on the background sections of the case
    for ent in doc.ents:
        if ent.label_ == "DATE" and ent.text not in nlu_data["dates"]:
            nlu_data["dates"].append(ent.text)
        elif ent.label_ in ["PERSON", "ORG"] and len(ent.text) > 3:
            # Prevent adding common legal citations as general parties
            if "v." not in ent.text and "vs." not in ent.text:
                if ent.text not in nlu_data["parties"]:
                    nlu_data["parties"].append(ent.text)
                
    nlu_data["dates"] = nlu_data["dates"][:4]
    nlu_data["parties"] = nlu_data["parties"][:6]
    
    return nlu_data


def verify_factual_integrity(
    source_entities: dict[str, list[str | dict[str, str]]],
    summary_entities: dict[str, list[str | dict[str, str]]],
) -> dict[str, object]:
    """Report which source entities are also detected in the generated summary."""
    categories = ("acts_sections", "case_precedents", "dates", "parties")
    preserved_entities = {}
    missing_entities = {}
    source_entity_count = 0
    preserved_entity_count = 0

    for category in categories:
        source_values = source_entities.get(category, [])
        source_names = [
            entity["case_name"] if isinstance(entity, dict) else entity
            for entity in source_values
        ]
        summary_values = {
            (entity["case_name"] if isinstance(entity, dict) else entity)
            .strip()
            .casefold()
            for entity in summary_entities.get(category, [])
        }
        preserved = [
            entity
            for entity in source_names
            if entity.strip().casefold() in summary_values
        ]
        missing = [
            entity
            for entity in source_names
            if entity.strip().casefold() not in summary_values
        ]
        preserved_entities[category] = preserved
        missing_entities[category] = missing
        source_entity_count += len(source_names)
        preserved_entity_count += len(preserved)

    return {
        "passed": not any(missing_entities.values()),
        "coverage": (
            round(preserved_entity_count / source_entity_count, 4)
            if source_entity_count
            else 1.0
        ),
        "preserved_entities": preserved_entities,
        "missing_entities": missing_entities,
    }


def is_legal_judgment(text: str) -> bool:
    """Check for court, decision, and proceeding signals in extracted text."""
    normalized_text = text.casefold()
    has_court_reference = bool(
        re.search(
            r"\b(?:supreme court|high court|district court|sessions court)\b|"
            r"\b(?:in|before) the (?:[a-z]+\s+){0,5}court\b|"
            r"\b\d{4}\s+insc\s+\d+\b",
            normalized_text,
        )
    )
    has_decision_reference = bool(
        re.search(r"\bjudg(?:e)?ment\b|\border\b|\bdecision\b", normalized_text)
    )
    has_proceeding_reference = bool(
        re.search(
            r"\b(?:appeal|petition|appellant|respondent|writ)\b",
            normalized_text,
        )
    )
    return (
        has_court_reference
        and has_decision_reference
        and has_proceeding_reference
    )


def segment_rhetorical_zones(text: str) -> dict:
    """
    NLU Structural Helper: Partitions raw judgment text into three distinct 
    legal rhetorical zones: Facts, Court Rationale (Ratio), and Final Ruling (Held).
    """
    sentences = re.split(r'(?<=[.!?])\s+', text)
    total_sentences = len(sentences)
    
    # Default boundaries based on document length percentages (failsafe defaults)
    facts_end = int(total_sentences * 0.35)
    rationale_end = int(total_sentences * 0.85)
    
    # Scan dynamically for structural marker shifts
    for i, sentence in enumerate(sentences):
        sent_upper = sentence.upper()
        # Look for court entering the analysis stage
        if any(marker in sent_upper for marker in ["WE HAVE CONSIDERED", "THE QUESTION FOR CONSIDERATION", "IT IS REASONED", "THE MAIN QUESTION"]):
            facts_end = min(i, int(total_sentences * 0.50))
        # Look for the final executable ruling
        if any(marker in sent_upper for marker in ["IN THE RESULT", "THE APPEAL IS", "ORDERED ACCORDINGLY", "HELD THAT"]):
            rationale_end = min(i, int(total_sentences * 0.90))
            
    facts_text = " ".join(sentences[:facts_end])
    rationale_text = " ".join(sentences[facts_end:rationale_end])
    held_text = " ".join(sentences[rationale_end:])
    
    return {
        "facts": facts_text,
        "rationale": rationale_text,
        "held": held_text
    }


def clean_generated_summary(text: str) -> str:
    """
    Post-Processor: Strips prompt leakage markers, raw tab characters,
    and formats final spacing for legal summaries.
    """
    # 1. Strip raw tab characters
    text = text.replace("\t", " ")
    
    # 2. Strip internal prompt leakages/zone tags
    text = re.sub(r"\[ZONE:\s*[^\]]+\]", "", text)
    
    # 3. Clean up double/excess spaces resulting from string cleaning
    text = re.sub(r"\s+", " ", text)
    
    # 4. Correct paragraph newlines so our structured headers stay on their own lines
    text = text.replace("📌 FACTS OF THE CASE:", "\n📌 FACTS OF THE CASE:\n")
    text = text.replace("🧠 COURT RATIONALE (RATIO DECIDENDI):", "\n\n🧠 COURT RATIONALE (RATIO DECIDENDI):\n")
    text = text.replace("⚖️ FINAL ORDER & HELD:", "\n\n⚖️ FINAL ORDER & HELD:\n")
    
    return text.strip()


def generate_summary_pipeline(pdf_bytes: bytes) -> dict:
    """
    Advanced VerdictLens Pipeline: Implements Rhetorical Role Segmentation 
    and Semantic Precedent Treatment Classification [1].
    """
    # 1. Parse PDF
    raw_text = extract_text_from_pdf(pdf_bytes)
    if not raw_text.strip():
        raise ValueError("Could not extract readable text from the uploaded PDF.")
        
    # Validation Gatekeeper (Ensures it's an Indian legal PDF)
    is_legal, validation_message = is_valid_indian_legal_document(raw_text)
    if not is_legal:
        raise ValueError(validation_message)
        
    # 2. Execute Advanced NLU Metadata Extraction (With Citation Treatments!)
    entities = extract_nlu_legal_entities(raw_text)
    
    # 3. Partition Document into Rhetorical Zones [1]
    zones = segment_rhetorical_zones(raw_text)
    
    # 4. Generate Summaries for Each Zone using your fine-tuned model
    print("🧠 Summarizing structured legal zones...")
    summarized_zones = {}
    
    # Build target formatting inputs for each zone
    zone_prompts = {
        "facts": f"[ZONE: FACTS AND BACKGROUND]\n{summarizer.summarize(zones['facts'], ratio=0.25) or zones['facts'][:4000]}",
        "rationale": f"[ZONE: COURT RATIONALE & RATIO]\n{summarizer.summarize(zones['rationale'], ratio=0.25) or zones['rationale'][:4000]}",
        "held": f"[ZONE: FINAL RULING AND ORDER]\n{zones['held'][:2000]}"
    }
    
        # Locate this generation loop inside your generate_summary_pipeline function:
    for zone_name, prompt_text in zone_prompts.items():
        inputs = tokenizer(prompt_text, max_length=4096, truncation=True, return_tensors="pt").to(device)
        with torch.no_grad():
            summary_ids = model.generate(
                inputs.input_ids,
                attention_mask=inputs.attention_mask,
                num_beams=4,              # Focus on beam search for legal precision
                min_length=60,            # Force descriptive summaries per zone
                max_length=150,           # Keep individual zones concise
                
                # 🔴 CRITICAL ANTI-REPETITION PENALTIES ADDED HERE:
                repetition_penalty=1.2,   # Strongly penalizes model for repeating words/phrases [1]
                no_repeat_ngram_size=3,   # Ensures no 3-word sequence can repeat [1]
                
                early_stopping=True
            )
        summarized_zones[zone_name] = tokenizer.decode(summary_ids[0], skip_special_tokens=True).strip()
        
    # 5. Construct the Final Structured Legal Summary [1]
    final_structured_summary = (
        f"📌 FACTS OF THE CASE:\n{summarized_zones['facts']}\n\n"
        f"🧠 COURT RATIONALE (RATIO DECIDENDI):\n{summarized_zones['rationale']}\n\n"
        f"⚖️ FINAL ORDER & HELD:\n{summarized_zones['held']}"
    )
    
    # 🔴 APPLY POST-PROCESSING CLEAN-UP BEFORE RETURNING!
    final_structured_summary = clean_generated_summary(final_structured_summary)
    
    # 6. Closed-loop verification check [1]
    summary_entities = extract_nlu_legal_entities(final_structured_summary)
    audit_report = verify_factual_integrity(entities, summary_entities)
    
    return {
        "metadata": entities,
        "summary": final_structured_summary, # Contains clean, non-repetitive summaries
        "verification_audit": audit_report,
        "word_counts": {
            "original_count": len(raw_text.split()),
            "summary_count": len(final_structured_summary.split())
        }
    }

        
    # 5. Construct the Final Structured Legal Summary [1]
    final_structured_summary = (
        f"📌 FACTS OF THE CASE:\n{summarized_zones['facts']}\n\n"
        f"🧠 COURT RATIONALE (RATIO DECIDENDI):\n{summarized_zones['rationale']}\n\n"
        f"⚖️ FINAL ORDER & HELD:\n{summarized_zones['held']}"
    )
    
    # 6. Closed-loop verification check [1]
    summary_entities = extract_nlu_legal_entities(final_structured_summary)
    audit_report = verify_factual_integrity(entities, summary_entities)
    
    return {
        "metadata": entities,
        "summary": final_structured_summary,
        "verification_audit": audit_report,
        "word_counts": {
            "original_count": len(raw_text.split()),
            "summary_count": len(final_structured_summary.split())
        }
    }
