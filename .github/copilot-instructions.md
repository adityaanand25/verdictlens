Project: VerdictLens, entity-grounded summarization of Indian Supreme Court judgments.
Rules: Python 3.11, pathlib, type hints, logging, pytest tests for every module.
Hardware limit: 8GB VRAM, 24GB RAM. fp16, gradient checkpointing, batch size 1,
max source length 4096 tokens. Never keep two models on GPU at once; free GPU
(del model; torch.cuda.empty_cache()) between stages. Seed 42 everywhere.
Config lives in configs/*.yaml. Outputs go to outputs/. No hidden network calls
except model/data downloads. Layout: src/verdictlens/{preprocess,entities,
extractive,abstractive,verify,agent,evaluate}.py, scripts/, tests/.
Do not change these decisions; ask me if something is impossible.
