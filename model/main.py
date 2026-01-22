from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import shutil
import uuid
import os
import cv2
import time
import requests
from datetime import datetime

# =====================================================
# 기본 설정
# =====================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

SAVE_IMAGE_DIR = os.path.join(BASE_DIR, "detect", "val_predictions", "images")
SAVE_LABEL_DIR = os.path.join(BASE_DIR, "detect", "val_predictions", "labels")
SAVE_RESULT_DIR = os.path.join(BASE_DIR, "detect", "val_predictions", "results")

os.makedirs(SAVE_IMAGE_DIR, exist_ok=True)
os.makedirs(SAVE_LABEL_DIR, exist_ok=True)
os.makedirs(SAVE_RESULT_DIR, exist_ok=True)

CLASS_NAMES = {
    0: "orange_peel",
    1: "runs_sags",
    2: "solvent_pop",
    3: "water_spotting"
}

CLASS_NAMES_KO = {
    0: "오렌지 필",
    1: "흘러내림",
    2: "솔벤트 팝",
    3: "물자국"
}

# Backend API URL
BACKEND_URL = "http://localhost:3001/api/paint-analysis"

def to_public_url(abs_path: str) -> str:
    """절대 경로를 public URL로 변환"""
    rel = os.path.relpath(abs_path, BASE_DIR).replace("\\", "/")
    return f"/static/{rel}"


def save_to_backend(analysis_data: dict):
    """백엔드 DB에 분석 결과 저장"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/save",
            json=analysis_data,
            timeout=5
        )
        if response.status_code == 200:
            print(f"✅ Successfully saved to backend DB: {analysis_data['resultId']}")
        else:
            print(f"⚠️ Failed to save to backend: {response.status_code}")
    except Exception as e:
        print(f"❌ Error saving to backend: {e}")


# =====================================================
# FastAPI 앱 생성
# =====================================================
app = FastAPI(title="Paint Defect Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙
app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")

# =====================================================
# YOLO 모델 로드
# =====================================================
print(f"Loading YOLO model from: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("✅ YOLO model loaded successfully")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "backend_url": BACKEND_URL
    }

# =====================================================
# 예측 API
# =====================================================
@app.post("/api/v1/paint")
async def predict_paint_defect(file: UploadFile = File(...)):
    """
    도장 결함 이미지 분석 API
    - 이미지 분석 후 결과를 백엔드 DB에 저장
    - 원본 이미지는 분석 후 삭제
    """
    start_time = time.time()
    
    # 1) 고유 ID 생성
    img_id = f"pt{uuid.uuid4().hex[:8]}"
    result_id = f"{img_id}_{int(time.time())}"
    original_name = file.filename
    img_name = f"{img_id}.jpg"
    
    print(f"📸 Received file: {original_name}, processing as: {img_name}")
    
    # 2) 원본 이미지 임시 저장
    image_path = os.path.join(SAVE_IMAGE_DIR, img_name)
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # 3) YOLOv8 추론
        print(f"🔍 Running YOLO inference...")
        results = model.predict(
            source=image_path,
            conf=0.25,
            save=True,
            project=SAVE_RESULT_DIR,
            name=img_id
        )
        r = results[0]
        
        inference_time = int((time.time() - start_time) * 1000)
        
        # 4) 결함 없음 처리
        if len(r.boxes) == 0:
            print(f"✅ No defects detected")
            
            # 결과 이미지 경로 (결함 없어도 annotated 이미지 사용)
            result_img_fs = os.path.join(SAVE_RESULT_DIR, img_id, os.path.basename(image_path))
            if not os.path.exists(result_img_fs):
                result_dir = os.path.join(SAVE_RESULT_DIR, img_id)
                if os.path.isdir(result_dir):
                    files = [f for f in os.listdir(result_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
                    if files:
                        result_img_fs = os.path.join(result_dir, files[0])
            
            public_img_path = to_public_url(image_path)
            public_result_img = to_public_url(result_img_fs) if os.path.exists(result_img_fs) else public_img_path
            
            # 백엔드에 저장할 데이터
            backend_data = {
                "resultId": result_id,
                "sessionId": f"session_{datetime.now().strftime('%Y%m%d')}",
                "imageFilename": original_name,
                "imagePath": image_path,
                "imageUrl": public_img_path,
                "resultImageUrl": public_result_img,
                "imageSizeKb": int(os.path.getsize(image_path) / 1024),
                "status": "PASS",
                "primaryDefectType": None,
                "confidence": 100.0,
                "modelVersion": "YOLOv8-best",
                "inferenceTimeMs": inference_time,
                "locationCode": "도장실-A",
                "detectedDefects": []
            }
            
            # 백엔드 DB에 저장
            save_to_backend(backend_data)
            
            # 원본 이미지 삭제
            if os.path.exists(image_path):
                os.remove(image_path)
                print(f"🗑️ Original image deleted: {image_path}")
            
            return JSONResponse(status_code=200, content={
                "status": "success",
                "message": "no defect detected",
                "data": {
                    "result_id": result_id,
                    "img_id": img_id,
                    "img_name": img_name,
                    "img_path": public_img_path,
                    "img_result": public_result_img,
                    "defect_type": -1,
                    "defect_score": 1.0,
                    "label_name": None,
                    "label_path": None,
                    "label_name_text": "없음",
                    "inference_time_ms": inference_time
                }
            })
        
        # 5) 결함 발견 처리
        best_box = max(r.boxes, key=lambda x: float(x.conf))
        class_id = int(best_box.cls)
        score = float(best_box.conf)
        
        print(f"⚠️ Defect detected: {CLASS_NAMES[class_id]} (confidence: {score:.2%})")
        
        # 라벨 저장
        label_name = f"{img_id}.txt"
        label_path_fs = os.path.join(SAVE_LABEL_DIR, label_name)
        with open(label_path_fs, "w") as f:
            for box in r.boxes:
                cls = int(box.cls)
                conf = float(box.conf)
                xyxy = box.xyxy[0].tolist()
                f.write(f"{cls} {conf:.4f} {xyxy}\n")
        
        # 결과 이미지 경로 찾기
        result_img_fs = os.path.join(SAVE_RESULT_DIR, img_id, os.path.basename(image_path))
        if not os.path.exists(result_img_fs):
            result_dir = os.path.join(SAVE_RESULT_DIR, img_id)
            if os.path.isdir(result_dir):
                files = [f for f in os.listdir(result_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
                if files:
                    result_img_fs = os.path.join(result_dir, files[0])
        
        # URL 변환
        public_img_path = to_public_url(image_path)
        public_result_img = to_public_url(result_img_fs)
        public_label_path = to_public_url(label_path_fs)
        
        # 결함 상세 정보
        detected_defects = []
        for box in r.boxes:
            cls = int(box.cls)
            conf = float(box.conf)
            xyxy = box.xyxy[0].tolist()
            bbox_area = int((xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1]))
            
            # 심각도 계산
            severity = "LOW"
            if conf >= 0.9:
                severity = "CRITICAL"
            elif conf >= 0.7:
                severity = "HIGH"
            elif conf >= 0.5:
                severity = "MEDIUM"
            
            detected_defects.append({
                "resultId": result_id,
                "defectClass": CLASS_NAMES[cls],
                "defectNameKo": CLASS_NAMES_KO[cls],
                "defectNameEn": CLASS_NAMES[cls],
                "confidence": round(conf * 100, 2),
                "bboxX1": int(xyxy[0]),
                "bboxY1": int(xyxy[1]),
                "bboxX2": int(xyxy[2]),
                "bboxY2": int(xyxy[3]),
                "bboxArea": bbox_area,
                "severityLevel": severity
            })
        
        # 백엔드에 저장할 데이터
        backend_data = {
            "resultId": result_id,
            "sessionId": f"session_{datetime.now().strftime('%Y%m%d')}",
            "imageFilename": original_name,
            "imagePath": image_path,
            "imageUrl": public_img_path,
            "resultImageUrl": public_result_img,
            "imageSizeKb": int(os.path.getsize(image_path) / 1024),
            "status": "FAIL",
            "primaryDefectType": CLASS_NAMES[class_id],
            "confidence": round(score * 100, 2),
            "modelVersion": "YOLOv8-best",
            "inferenceTimeMs": inference_time,
            "locationCode": "도장실-A",
            "detectedDefects": detected_defects
        }
        
        # 백엔드 DB에 저장
        save_to_backend(backend_data)
        
        # 원본 이미지 삭제
        if os.path.exists(image_path):
            os.remove(image_path)
            print(f"🗑️ Original image deleted: {image_path}")
        
        return JSONResponse(status_code=200, content={
            "status": "success",
            "message": "defect detected",
            "data": {
                "result_id": result_id,
                "img_id": img_id,
                "img_name": img_name,
                "img_path": public_img_path,
                "img_result": public_result_img,
                "defect_type": class_id,
                "defect_score": round(score, 4),
                "label_name": label_name,
                "label_path": public_label_path,
                "label_name_text": CLASS_NAMES[class_id],
                "label_name_ko": CLASS_NAMES_KO[cls],
                "inference_time_ms": inference_time,
                "detected_defects": detected_defects
            }
        })
        
    except Exception as e:
        # 에러 발생 시 원본 이미지 삭제
        if os.path.exists(image_path):
            os.remove(image_path)
        print(f"❌ Error during inference: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Paint Defect Detection API...")
    print(f"📁 Base directory: {BASE_DIR}")
    print(f"🤖 Model path: {MODEL_PATH}")
    print(f"💾 Backend URL: {BACKEND_URL}")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)