
import asyncio
from pathlib import Path
from datetime import datetime
import uuid

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .schemas import DefectPrediction, PredictionList, Metrics
from .inference import model_service
from .storage import store


app = FastAPI(title="Paint Defect API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


BASE_DIR: Path = Path(__file__).resolve().parent
STATIC_DIR: Path = BASE_DIR.parent / "model" / "detect" / "val_predictions"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR.parent.parent)), name="static")



@app.post("/api/predict", response_model=DefectPrediction)
async def predict(image: UploadFile = File(...), location: str = "구역 A - 차량 001"):
    # 1) 업로드 파일 저장
    from pathlib import Path
    from datetime import datetime
    import uuid

    ext = Path(image.filename).suffix or ".jpg"
    img_id = uuid.uuid4().hex
    save_path = STATIC_DIR / f"{img_id}{ext}"
    with open(save_path, "wb") as f:
        f.write(await image.read())

    # 2) YOLOv8 추론
    pred = model_service.predict(save_path)

    # YOLO 결과 이미지 경로 구성 (YOLO가 results 폴더 내에 저장함)
    # YOLO는 img_id 폴더를 생성하고 그 안에 원본 파일명으로 결과 이미지 저장
    result_img_path = STATIC_DIR / "results" / img_id / save_path.name
    
    # relative path for URL
    if result_img_path.exists():
        # STATIC_DIR.parent.parent = model 폴더이므로 model/detect/val_predictions부터의 상대경로
        rel_path = result_img_path.relative_to(STATIC_DIR.parent.parent)
        image_url = f"/static/{rel_path.as_posix()}"
    else:
        image_url = f"/static/detect/val_predictions/{save_path.relative_to(STATIC_DIR).as_posix()}"

    # 3) 요약 응답
    item = {
        "id": img_id,
        "status": pred["status"],
        "defect_type": pred.get("defect_type"),
        "confidence": round(float(pred["confidence"]) * 100, 1),  # 0~100%
        "location": location,
        "timestamp": datetime.utcnow().isoformat(),
        "image_url": image_url,
    }

    # 4) 저장 & SSE 브로드캐스트
    store.add(item)
    # await broadcast_sse({"type": "prediction", "data": item})
    return item


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": model is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
