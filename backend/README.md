# VerdictLens Backend

This service runs the local fine-tuned LED model through an NLU, TextRank, and
generation pipeline. It does not download model files when serving requests.

## Model files

The model path defaults to `backend/ai_models/VerdictLens_Final_Model` and is
configured in `backend/.env`. The folder must contain `config.json`, model
weights, and tokenizer files. After training, run the model export cell in
`sumamodel.ipynb` and download `verdictlens_led_model.zip`. From the repository
root, extract it with:

```powershell
Expand-Archive "$HOME\Downloads\verdictlens_led_model.zip" `
  -DestinationPath ".\backend\ai_models\VerdictLens_Final_Model" -Force
```

Override the model location by editing `VERDICTLENS_MODEL_PATH` in
`backend/.env`. Relative paths are resolved from the `backend` directory.

## Run

Install PyTorch for your hardware, then install the backend dependencies and
spaCy English model. Run these commands from the repository root:

```powershell
python -m pip install -r backend/requirements.txt
python -m spacy download en_core_web_sm
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the interactive API. `GET /health`
reports model readiness. `POST /summarize` accepts JSON such as:

```json
{
  "text": "Paste the judgment text here.",
  "max_new_tokens": 256,
  "num_beams": 3
}
```

The response includes the generated summary and detected entities. LED input
is truncated to 4096 tokens, and model inference is serialized to limit GPU
memory use.