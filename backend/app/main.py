# app/main.py
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.pipeline import generate_summary_pipeline

app = FastAPI(
    title="VerdictLens API",
    description="Backend API hosting NLU legal extraction and LED summaries",
    version="1.0.0"
)

# Enable CORS (Allows your frontend to send requests to this server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your specific frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "VerdictLens Backend API is running successfully!"}

@app.post("/summarize")
async def summarize_pdf(file: UploadFile = File(...)):
    """Receives a multipart PDF upload, processes it, and returns NLU + Summary JSON [1]."""
    # 1. Validation check
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        # Read uploaded bytes
        pdf_bytes = await file.read()
        
        # Execute the AI Pipeline
        result = generate_summary_pipeline(pdf_bytes)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Start the server locally
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
