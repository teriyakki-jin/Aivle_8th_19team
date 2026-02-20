from fastapi import FastAPI
from duedate_prediction.schema import PredictRequest, PredictResponse
from duedate_prediction.pipeline import predict_pipeline
from duedate_prediction.model_loader import ModelRegistry

app = FastAPI(title="Rolling Due Date Prediction API")

@app.on_event("startup")
def load_models():
    ModelRegistry.load()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/v1/smartfactory/duedate", response_model=PredictResponse)
def predict(req: PredictRequest):
    return predict_pipeline(req)
