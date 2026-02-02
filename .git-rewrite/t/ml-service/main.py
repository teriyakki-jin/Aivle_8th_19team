from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os

# 모듈 불러오기 (배터리 예측 로직)
import battery 

app = FastAPI()

# CORS 설정 (프론트엔드에서 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 서버 시작 시 모델 로딩
@app.on_event("startup")
def startup_event():
    print("서버 시작: 모델 로딩 중...")
    battery.load_battery_models()

@app.get("/")
def read_root():
    return {"message": "ML Service API is running"}

# 배터리 예측 엔드포인트
@app.post("/predict")
def predict_endpoint(data: battery.BatteryPredictionRequest):
    try:
        # battery 모듈의 예측 함수 호출
        result = battery.predict_battery_quality(data)
        return {"prediction": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {
        "status": "ok", 
        "models_loaded": battery.model is not None
    }

if __name__ == "__main__":
    import uvicorn
    # 모든 네트워크 인터페이스에서 접근 가능하도록 0.0.0.0 설정
    uvicorn.run(app, host="0.0.0.0", port=8000)
