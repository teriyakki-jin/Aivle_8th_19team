import os
import shutil
import uuid
import traceback
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import press
import windshield
import engine
from paint import service as paint_service

# chatbot import (실패해도 서버 시작 가능)
try:
    from chat_bot import chat as chatbot_chat
    CHATBOT_AVAILABLE = True
except Exception as e:
    print(f"Warning: chat_bot module failed to load: {e}")
    CHATBOT_AVAILABLE = False
    chatbot_chat = None
import body_assembly
from body_assembly import service as body_service
from welding_image.pipeline import full_pipeline
from welding_image.schemas import DefectResponse
import welding_image
from model_loader import download_models
from storage import public_url_for_file
from duedate_prediction.model_loader import ModelRegistry as DueDateModelRegistry
from duedate_prediction.pipeline import predict_pipeline as duedate_predict_pipeline
from duedate_prediction.schema import (
    PredictRequest as DueDatePredictRequest,
    PredictResponse as DueDatePredictResponse,
)

app = FastAPI(title="ML Service API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatbotRequest(BaseModel):
    session_id: str
    message: str


class ChatbotResponse(BaseModel):
    content: str
    dataSummary: Optional[str] = None



# =========================
# Static / Directories (본래와 동일한 방식)
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(BASE_DIR, "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ✅ 핵심: BASE_DIR 전체를 /static 으로 서빙
# - temp/xxx.jpg -> /static/temp/xxx.jpg
# - welding_image/runs/predict/yyy.jpg -> /static/welding_image/runs/predict/yyy.jpg
app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")


def to_public_url(abs_path: str, process: str) -> str:
    """
    abs_path(절대경로) -> results/<process>/ 로 업로드한 URL
    (RESULTS_BUCKET 없으면 /static 폴백)
    """
    return public_url_for_file(abs_path, BASE_DIR, process)


# =========================
# Startup
# =========================
@app.on_event("startup")
def startup_event():
    print("서버 시작: S3 모델 다운로드 확인...")
    download_models(BASE_DIR)

    print("서버 시작: 모델 로딩 중...")
    try:
        windshield.load_windshield_models()
        engine.load_engine_model()
        global PAINT_CFG
        PAINT_CFG = paint_service.load_paint_model(BASE_DIR)
        body_service.load_body_models(BASE_DIR)
        press.load_press_models()
        DueDateModelRegistry.load()

        print("모델 로딩 완료")
    except Exception:
        print("=== STARTUP ERROR ===")
        traceback.print_exc()
        raise


# =========================
# Health
# =========================
@app.get("/")
def read_root():
    return {"message": "ML Service API is running"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "windshield_left_loaded": getattr(windshield, "left_model", None) is not None,
        "windshield_right_loaded": getattr(windshield, "right_model", None) is not None,
        "engine_loaded": getattr(engine, "model", None) is not None,
        "paint_loaded": getattr(paint_service, "model", None) is not None,
        **press.get_press_status(),
        **body_service.get_body_status(),
    }

# =========================
# Chatbot (LangChain Agent + Tools)
# =========================
@app.post("/api/v1/smartfactory/chatbot", response_model=ChatbotResponse)
def chatbot_query(request: ChatbotRequest):
    """
    공정 관리 AI 챗봇 - 실시간 API 연동
    이 엔드포인트가 실패해도 다른 ML 서비스에 영향 없음
    """
    try:
        if not CHATBOT_AVAILABLE:
            return ChatbotResponse(
                content="죄송합니다. 챗봇 서비스가 현재 사용 불가능합니다. 관리자에게 문의해주세요."
            )

        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            return ChatbotResponse(
                content="죄송합니다. 챗봇 서비스 설정이 완료되지 않았습니다. 관리자에게 문의해주세요."
            )

        if not request.session_id or not request.message.strip():
            return ChatbotResponse(content="메시지를 입력해주세요.")

        answer = chatbot_chat(request.session_id, request.message)
        return ChatbotResponse(content=answer)

    except Exception as e:
        print(f"Chatbot error: {e}")
        traceback.print_exc()
        return ChatbotResponse(
            content="죄송합니다. 요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        )

# =========================
# Windshield (기존 유지)
# =========================
@app.post("/api/v1/smartfactory/windshield")
async def predict_windshield_endpoint(
    side: str = Form(...),
    file: UploadFile = File(...),
):
    try:
        s = side.strip().lower()
        if s not in ("left", "right"):
            raise HTTPException(status_code=400, detail="side must be 'Left' or 'Right'")

        csv_bytes = await file.read()
        prediction, judgement = windshield.predict_from_csv(s, csv_bytes)
        return {"prediction": prediction, "judgement": judgement}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# Engine (기존 유지)
# =========================
@app.post("/api/v1/smartfactory/engine")
async def predict_engine_endpoint(file: UploadFile = File(...)):
    try:
        arff_bytes = await file.read()
        prediction, judgement = engine.predict_from_arff(arff_bytes)
        return {"prediction": prediction, "judgement": judgement}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# Welding Image (본래 welding-image FastAPI 계약과 동일)
# - 입력: file
# - 출력: status, defects, original_image_url, result_image_url
# =========================
async def _welding_predict_core(file: UploadFile) -> DefectResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is empty")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    temp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}{ext}")

    # ✅ 원본 저장
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # ✅ pipeline 실행
    # result = {"status": ..., "defects": ..., "result_image_path": ...}
    result = full_pipeline(temp_path)

    # ✅ 원본 이미지 URL
    original_url = to_public_url(temp_path, "welding")

    # ✅ 결과 이미지 URL (runs/predict에 저장된 경로를 /static/... 으로 노출)
    result_url = None
    if result.get("result_image_path"):
        result_url = to_public_url(result["result_image_path"], "welding")

    return DefectResponse(
        status=result["status"],
        defects=result["defects"],
        original_image_url=original_url,
        result_image_url=result_url,
    )


# ✅ 본래 경로
@app.post("/api/v1/welding/image", response_model=DefectResponse)
async def predict_welding_original(file: UploadFile = File(...)):
    try:
        return await _welding_predict_core(file)
    except HTTPException:
        raise
    except Exception as e:
        print("=== WELDING ERROR ===")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ✅ 자동 입력(폴더 순차)
@app.post("/api/v1/smartfactory/welding/image/auto")
async def predict_welding_auto():
    try:
        # result = {"status","defects","result_image_path", "source","sequence","original_image_path"}
        result = welding_image.predict_welding_image_auto()

        original_abs = result.get("original_image_path")
        original_url = to_public_url(original_abs, "welding") if original_abs else None

        result_url = None
        if result.get("result_image_path"):
            result_url = to_public_url(result["result_image_path"], "welding")

        # DefectResponse 스키마 + 추가필드(source/sequence/note)
        return {
            "status": result["status"],
            "defects": result["defects"],
            "original_image_url": original_url,
            "result_image_url": result_url,
            "source": result.get("source"),
            "sequence": result.get("sequence"),
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ✅ 통합 경로(프론트가 쓰는 경로)
@app.post("/api/v1/smartfactory/welding/image", response_model=DefectResponse)
async def predict_welding_smartfactory(file: UploadFile = File(...)):
    try:
        return await _welding_predict_core(file)
    except HTTPException:
        raise
    except Exception as e:
        print("=== WELDING ERROR ===")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/smartfactory/paint/debug")
def paint_model_debug():
    """paint 모델 상태 및 간이 테스트"""
    m = paint_service.model
    if m is None:
        return {"loaded": False}
    info = {"loaded": True, "names": m.names, "task": m.task}
    # 간이 테스트: sample_images 첫 파일
    auto_dir = paint_service.paint_auto_state.get("auto_dir", "")
    if auto_dir and os.path.isdir(auto_dir):
        imgs = [f for f in sorted(os.listdir(auto_dir)) if f.lower().endswith(('.jpg','.png'))]
        if imgs:
            test_path = os.path.join(auto_dir, imgs[0])
            results = m.predict(source=test_path, conf=0.10, verbose=False)
            r = results[0]
            info["test_file"] = imgs[0]
            info["test_boxes"] = len(r.boxes)
            if len(r.boxes) > 0:
                best = max(r.boxes, key=lambda x: float(x.conf))
                info["test_best_class"] = m.names[int(best.cls)]
                info["test_best_conf"] = round(float(best.conf), 4)
    return info


@app.post("/api/v1/smartfactory/paint")
async def predict_paint_endpoint(file: UploadFile = File(...)):
    try:
        if PAINT_CFG is None:
            raise HTTPException(status_code=500, detail="paint config not initialized")

        # UploadFile 커서를 처음으로 되돌림
        await file.seek(0)

        result = paint_service.predict_paint_defect(
            file_obj=file.file,
            original_filename=file.filename,
            base_dir=BASE_DIR,
            save_image_dir=PAINT_CFG["SAVE_IMAGE_DIR"],
            save_label_dir=PAINT_CFG["SAVE_LABEL_DIR"],
            save_result_dir=PAINT_CFG["SAVE_RESULT_DIR"],
            backend_url="http://localhost:3001/api/paint-analysis",
        )
        return JSONResponse(status_code=200, content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/v1/smartfactory/paint/auto")
def predict_paint_auto():
    try:
        if PAINT_CFG is None:
            raise HTTPException(status_code=500, detail="paint config not initialized")

        result = paint_service.predict_paint_defect_auto(
            base_dir=BASE_DIR,
            save_image_dir=PAINT_CFG["SAVE_IMAGE_DIR"],
            save_label_dir=PAINT_CFG["SAVE_LABEL_DIR"],
            save_result_dir=PAINT_CFG["SAVE_RESULT_DIR"],
            backend_url="http://localhost:3001/api/paint-analysis",
        )
        return JSONResponse(status_code=200, content=result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# =========================
# PRESS APIs (SIM INPUT)
# =========================
@app.post("/api/v1/smartfactory/press/vibration")
def predict_press_vibration():
    try:
        return press.predict_vibration_anomaly_sim()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/smartfactory/press/image")
async def predict_press_image():
    try:
        return await press.predict_press_image_sim()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/v1/smartfactory/body/inspect")
async def body_inspect(
    part: str = Form(...),
    file: UploadFile = File(...),
    conf: float = Form(0.25),
):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is empty")

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        # 원본 저장 (기존 temp 저장 방식 유지)
        temp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}{ext}")
        contents = await file.read()
        with open(temp_path, "wb") as f:
            f.write(contents)

        pred = body_service.predict_part(part.strip().lower(), contents, conf=float(conf))
        out_path = body_service.save_annotated_image(pred["annotated_bgr"], BASE_DIR, filename_prefix=part)

        return {
            "part": pred["part"],
            "pass_fail": pred["pass_fail"],
            "detections": pred["detections"],
            "original_image_url": to_public_url(temp_path, "body_assembly"),
            "result_image_url": to_public_url(out_path, "body_assembly"),
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/smartfactory/body/inspect/batch")
async def body_inspect_batch(
    door_file: UploadFile = File(None),
    bumper_file: UploadFile = File(None),
    headlamp_file: UploadFile = File(None),
    taillamp_file: UploadFile = File(None),
    radiator_file: UploadFile = File(None),
    conf: float = Form(0.25),
):
    try:
        mapping = {
            "door": door_file,
            "bumper": bumper_file,
            "headlamp": headlamp_file,
            "taillamp": taillamp_file,
            "radiator": radiator_file,
        }

        results = {}
        for part, uf in mapping.items():
            if uf is None:
                results[part] = None
                continue

            ext = os.path.splitext(uf.filename)[1].lower()
            if ext not in ALLOWED_EXT:
                results[part] = {"error": f"Unsupported file type: {ext}"}
                continue

            temp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}{ext}")
            contents = await uf.read()
            with open(temp_path, "wb") as f:
                f.write(contents)

            pred = body_service.predict_part(part, contents, conf=float(conf))
            out_path = body_service.save_annotated_image(pred["annotated_bgr"], BASE_DIR, filename_prefix=part)

            results[part] = {
                "part": pred["part"],
                "pass_fail": pred["pass_fail"],
                "detections": pred["detections"],
                "original_image_url": to_public_url(temp_path, "body_assembly"),
                "result_image_url": to_public_url(out_path, "body_assembly"),
            }

        return {"results": results}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
# main.py (아래쪽 body endpoint들 근처에 추가)

@app.post("/api/v1/smartfactory/body/inspect/auto")
async def body_inspect_auto(
    part: str = Form(...),
    conf: float = Form(0.25),
):
    """
    samples 폴더에서 part 이미지를 자동으로 하나 꺼내서 검사
    """
    try:
        pred = body_service.predict_part_auto(part.strip().lower(), BASE_DIR, conf=float(conf))
        out_path = body_service.save_annotated_image(pred["annotated_bgr"], BASE_DIR, filename_prefix=part)

        original_abs = pred.get("original_image_path")
        return {
            "part": pred["part"],
            "pass_fail": pred["pass_fail"],
            "detections": pred["detections"],
            "original_image_url": to_public_url(original_abs, "body_assembly") if original_abs else None,
            "result_image_url": to_public_url(out_path, "body_assembly"),
            "source": pred.get("source"),
            "sequence": pred.get("sequence"),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/smartfactory/body/inspect/batch/auto")
async def body_inspect_batch_auto(
    conf: float = Form(0.25),
):
    """
    5개 파트 모두 samples에서 자동으로 하나씩 꺼내서 배치 검사
    """
    try:
        results = {}
        for part in ["door", "bumper", "headlamp", "taillamp", "radiator"]:
            try:
                pred = body_service.predict_part_auto(part, BASE_DIR, conf=float(conf))
                out_path = body_service.save_annotated_image(pred["annotated_bgr"], BASE_DIR, filename_prefix=part)

                original_abs = pred.get("original_image_path")
                results[part] = {
                    "part": pred["part"],
                    "pass_fail": pred["pass_fail"],
                    "detections": pred["detections"],
                    "original_image_url": to_public_url(original_abs, "body_assembly") if original_abs else None,
                    "result_image_url": to_public_url(out_path, "body_assembly"),
                    "source": pred.get("source"),
                    "sequence": pred.get("sequence"),
                }
            except Exception as inner:
                results[part] = {"error": str(inner)}

        return {"results": results}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# 납기 예측 API (Delay Prediction API)
# =========================
# 주문의 공정 이상이 누적될 경우 최종 납기가 지연될 확률과 예상 지연 시간 예측

@app.post("/api/v1/smartfactory/duedate", response_model=DueDatePredictResponse)
def predict_duedate(req: DueDatePredictRequest):
    try:
        return duedate_predict_pipeline(req)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/prediction/extract-and-train")
async def extract_and_train():
    """
    데이터베이스에서 데이터를 추출하고 납기 예측 모델을 훈련합니다.
    
    Returns:
        {
            "status": "success" | "error",
            "message": "훈련 완료 또는 오류 메시지",
            "model_metrics": {
                "classification": {...},
                "regression": {...}
            }
        }
    """
    try:
        from .delay_prediction_model import DelayPredictionModel
        from .data_extraction import DelayDataExtractor
        import logging
        
        logger = logging.getLogger(__name__)
        
        # 데이터 추출
        db_url = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost:5432/automobile_risk')
        extractor = DelayDataExtractor(db_url)
        features, targets = extractor.extract_and_engineer()
        
        # 모델 훈련
        model = DelayPredictionModel()
        metrics = model.train(features, targets['delay_flag'], targets['delay_hours'])
        
        # 모델 저장
        model.save_model('delay_prediction_model.pkl')
        
        return {
            "status": "success",
            "message": "납기 예측 모델 훈련 완료",
            "samples": len(features),
            "features": features.shape[1],
            "model_metrics": metrics
        }
    except Exception as e:
        logger.error(f"모델 훈련 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/prediction/model-info")
async def get_model_info():
    """
    현재 훈련된 모델의 정보를 조회합니다.
    
    Returns:
        {
            "model_version": "1.0.0",
            "last_trained": "2026-01-31T10:30:00",
            "features": 84,
            "targets": ["delay_flag", "delay_hours"],
            "evaluation": {...}
        }
    """
    try:
        from .delay_prediction_model import DelayPredictionModel
        
        model = DelayPredictionModel()
        
        # 모델 파일이 있으면 로드
        if os.path.exists('delay_prediction_model.pkl'):
            model.load_model('delay_prediction_model.pkl')
            return {
                "status": "success",
                "model_version": "1.0.0",
                "model_loaded": True,
                "message": "모델이 로드되었습니다"
            }
        else:
            return {
                "status": "info",
                "model_version": "1.0.0",
                "model_loaded": False,
                "message": "훈련된 모델이 없습니다. /api/v1/prediction/extract-and-train을 호출하세요"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/health")
async def health_check():
    """
    ML 서비스 헬스 체크
    """
    return {
        "status": "healthy",
        "service": "ML Service API",
        "version": "1.0.0",
        "timestamp": str(__import__('datetime').datetime.now())
    }

# WINDSHIELD AUTO (샘플 CSV 순차 재생)
# =========================
import pandas as pd
import io

# 샘플 데이터 경로 (S3에서 다운로드되거나 로컬 fallback)
WINDSHIELD_DATA_DIR = os.path.join(BASE_DIR, "sample_data")
# 로컬 개발 시 frontend/public/data fallback
if not os.path.isdir(WINDSHIELD_DATA_DIR):
    WINDSHIELD_DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend", "public", "data")

windshield_auto_state = {
    "left_rows": None,
    "right_rows": None,
    "left_idx": 0,
    "right_idx": 0,
}

def _load_windshield_csv():
    """윈드실드 샘플 CSV를 로드하여 행 단위로 저장"""
    left_path = os.path.join(WINDSHIELD_DATA_DIR, "2nd_process_left_data.csv")
    right_path = os.path.join(WINDSHIELD_DATA_DIR, "2nd_process_right_data.csv")

    if os.path.exists(left_path):
        df = pd.read_csv(left_path, header=None)
        windshield_auto_state["left_rows"] = df.values.tolist()

    if os.path.exists(right_path):
        df = pd.read_csv(right_path, header=None)
        windshield_auto_state["right_rows"] = df.values.tolist()

@app.post("/api/v1/smartfactory/windshield/auto")
def predict_windshield_auto(offset: int = 0):
    """
    윈드실드 자동 예측 - 샘플 CSV에서 순차적으로 행을 가져와 예측
    Left/Right 번갈아가며 예측
    """
    try:
        # 첫 호출 시 CSV 로드
        if windshield_auto_state["left_rows"] is None:
            _load_windshield_csv()

        left_rows = windshield_auto_state["left_rows"]
        right_rows = windshield_auto_state["right_rows"]

        if not left_rows and not right_rows:
            raise HTTPException(status_code=404, detail="No windshield sample CSV found")

        # offset 적용
        windshield_auto_state["left_idx"] = (windshield_auto_state["left_idx"] + offset) % len(left_rows) if left_rows else 0
        windshield_auto_state["right_idx"] = (windshield_auto_state["right_idx"] + offset) % len(right_rows) if right_rows else 0

        results = []

        # Left 예측
        if left_rows:
            row = left_rows[windshield_auto_state["left_idx"]]
            csv_bytes = ",".join(map(str, row)).encode("utf-8")
            pred, judgement = windshield.predict_from_csv("left", csv_bytes)
            results.append({
                "side": "left",
                "prediction": pred,
                "judgement": judgement,
                "row_index": windshield_auto_state["left_idx"],
            })
            windshield_auto_state["left_idx"] = (windshield_auto_state["left_idx"] + 1) % len(left_rows)

        # Right 예측
        if right_rows:
            row = right_rows[windshield_auto_state["right_idx"]]
            csv_bytes = ",".join(map(str, row)).encode("utf-8")
            pred, judgement = windshield.predict_from_csv("right", csv_bytes)
            results.append({
                "side": "right",
                "prediction": pred,
                "judgement": judgement,
                "row_index": windshield_auto_state["right_idx"],
            })
            windshield_auto_state["right_idx"] = (windshield_auto_state["right_idx"] + 1) % len(right_rows)

        # 하나라도 FAIL이면 전체 FAIL
        overall_pass = all(r["judgement"] == "PASS" for r in results)

        return {
            "status": "PASS" if overall_pass else "FAIL",
            "judgement": "PASS" if overall_pass else "FAIL",
            "results": results,
            "sequence": {
                "left_idx": windshield_auto_state["left_idx"],
                "right_idx": windshield_auto_state["right_idx"],
                "left_count": len(left_rows) if left_rows else 0,
                "right_count": len(right_rows) if right_rows else 0,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# ENGINE AUTO (샘플 ARFF 순차 재생)
# =========================
import arff

ENGINE_DATA_DIR = WINDSHIELD_DATA_DIR  # 같은 폴더에 있음

engine_auto_state = {
    "rows": None,
    "idx": 0,
}

def _load_engine_arff():
    """엔진 샘플 ARFF를 로드하여 행 단위로 저장"""
    arff_path = os.path.join(ENGINE_DATA_DIR, "FordA_TEST.arff")

    if os.path.exists(arff_path):
        with open(arff_path, "r", encoding="utf-8") as f:
            obj = arff.load(f)
            engine_auto_state["rows"] = obj.get("data", [])

@app.post("/api/v1/smartfactory/engine/auto")
def predict_engine_auto(offset: int = 0):
    """
    엔진 진동 자동 예측 - 샘플 ARFF에서 순차적으로 행을 가져와 예측
    """
    try:
        # 첫 호출 시 ARFF 로드
        if engine_auto_state["rows"] is None:
            _load_engine_arff()

        rows = engine_auto_state["rows"]

        if not rows:
            raise HTTPException(status_code=404, detail="No engine sample ARFF found")

        # offset 적용
        engine_auto_state["idx"] = (engine_auto_state["idx"] + offset) % len(rows)

        # 현재 행 가져오기
        row = rows[engine_auto_state["idx"]]

        # ARFF 형식으로 변환하여 예측
        # 마지막 컬럼이 label일 수 있으므로 그대로 전달 (predict_from_arff에서 처리)
        import numpy as np
        x = np.array([row], dtype=np.float32)

        # 마지막 컬럼이 label인지 확인하고 제거
        if x.shape[1] >= 2:
            last_col = x[:, -1]
            uniq = set(np.unique(last_col).tolist())
            if uniq.issubset({0.0, 1.0}) or uniq.issubset({-1.0, 1.0}):
                x = x[:, :-1]

        # 모델 입력 shape 맞추기
        if x.ndim == 2:
            x = x[..., np.newaxis]

        y = engine.model.predict(x, verbose=0)

        # 결과 해석
        if y.ndim == 2 and y.shape[1] == 1:
            score = float(y[0, 0])
            pred = 1 if score >= 0.5 else 0
        elif y.ndim == 2 and y.shape[1] >= 2:
            pred = int(np.argmax(y[0]))
        else:
            score = float(y.reshape(-1)[0])
            pred = 1 if score >= 0.5 else 0

        judgement = "NORMAL" if pred == 1 else "ABNORMAL"

        current_idx = engine_auto_state["idx"]
        engine_auto_state["idx"] = (engine_auto_state["idx"] + 1) % len(rows)

        return {
            "status": judgement,
            "judgement": judgement,
            "prediction": pred,
            "row_index": current_idx,
            "sequence": {
                "idx": engine_auto_state["idx"],
                "count": len(rows),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# 주문별(datasets) 라우팅
# =========================
import json as _json

DATASETS_DIR = os.path.join(BASE_DIR, "datasets")


@app.get("/api/v1/smartfactory/orders")
def list_orders():
    """datasets/ 내 사용 가능한 주문(production) 목록을 반환"""
    if not os.path.isdir(DATASETS_DIR):
        return {"orders": []}
    dirs = sorted([
        d for d in os.listdir(DATASETS_DIR)
        if os.path.isdir(os.path.join(DATASETS_DIR, d))
    ])
    orders = []
    for d in dirs:
        order_path = os.path.join(DATASETS_DIR, d)
        sub = [s for s in os.listdir(order_path) if os.path.isdir(os.path.join(order_path, s))]
        orders.append({"order_id": d, "processes": sorted(sub)})
    return {"orders": orders}


# ── Paint (주문별: 폴더 내 모든 이미지 배치 분석) ──
@app.post("/api/v1/smartfactory/order/{order_id}/paint")
def predict_paint_by_order(order_id: str):
    """
    datasets/{order_id}/paint/ 폴더 안의 모든 이미지를 한 번에 분석한다.
    """
    try:
        if PAINT_CFG is None:
            raise HTTPException(status_code=500, detail="paint config not initialized")

        paint_folder = os.path.join(DATASETS_DIR, order_id, "paint")
        if not os.path.isdir(paint_folder):
            raise HTTPException(status_code=404, detail=f"paint folder not found for order {order_id}")

        result = paint_service.predict_paint_defect_batch(
            folder_path=paint_folder,
            base_dir=BASE_DIR,
            save_image_dir=PAINT_CFG["SAVE_IMAGE_DIR"],
            save_label_dir=PAINT_CFG["SAVE_LABEL_DIR"],
            save_result_dir=PAINT_CFG["SAVE_RESULT_DIR"],
            backend_url="http://localhost:3001/api/paint-analysis",
        )
        result["order_id"] = order_id
        return JSONResponse(status_code=200, content=result)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Press 진동 (주문별) ──
@app.post("/api/v1/smartfactory/order/{order_id}/press/vibration")
def predict_press_vibration_by_order(order_id: str):
    """
    datasets/{order_id}/press/press_vibration_*.json 을 읽어
    LSTM AE 모델에 입력하여 이상 여부를 판정한다.
    """
    try:
        press_folder = os.path.join(DATASETS_DIR, order_id, "press")
        if not os.path.isdir(press_folder):
            raise HTTPException(status_code=404, detail=f"press folder not found for order {order_id}")

        # JSON 파일 찾기
        json_files = sorted([
            f for f in os.listdir(press_folder) if f.endswith(".json")
        ])
        if not json_files:
            raise HTTPException(status_code=404, detail=f"no vibration JSON in {press_folder}")

        results = []
        for jf in json_files:
            jpath = os.path.join(press_folder, jf)
            with open(jpath, "r", encoding="utf-8") as fp:
                sensor_data = _json.load(fp)

            # sensor_data 를 LSTM 버퍼에 주입하여 예측
            result = _predict_vibration_from_json(sensor_data)
            result["source_file"] = jf
            results.append(result)

        overall = "NORMAL" if all(r.get("is_anomaly", 0) == 0 for r in results) else "ABNORMAL"
        return {"order_id": order_id, "overall": overall, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _predict_vibration_from_json(sensor_data: dict):
    """
    sensor JSON({"sensor_0": [...], ...})을 LSTM AE에 넣어 이상 탐지 수행
    """
    import numpy as np

    if press.lstm_ae_model is None:
        return {"reconstruction_error": 0.0, "is_anomaly": 0, "threshold": 0.05, "note": "LSTM not loaded"}

    # sensor 값을 타임스텝 x 피처 행렬로 변환
    keys = sorted(sensor_data.keys())
    columns = [sensor_data[k] for k in keys]
    max_len = max(len(c) for c in columns)
    for i, c in enumerate(columns):
        if len(c) < max_len:
            columns[i] = c + [0.0] * (max_len - len(c))

    arr = np.array(columns, dtype=np.float32).T  # (T_data, F_data)

    shp = press.lstm_ae_model.input_shape
    if isinstance(shp, list):
        shp = shp[0]
    T_model = int(shp[1])
    F_model = int(shp[2])

    # 피처 수 맞추기
    if arr.shape[1] < F_model:
        pad = np.zeros((arr.shape[0], F_model - arr.shape[1]), dtype=np.float32)
        arr = np.concatenate([arr, pad], axis=1)
    elif arr.shape[1] > F_model:
        arr = arr[:, :F_model]

    # 타임스텝 맞추기
    if arr.shape[0] < T_model:
        pad = np.zeros((T_model - arr.shape[0], F_model), dtype=np.float32)
        arr = np.concatenate([pad, arr], axis=0)
    elif arr.shape[0] > T_model:
        arr = arr[-T_model:]

    x = arr.reshape(1, T_model, F_model)
    reconst = press.lstm_ae_model.predict(x, verbose=0)
    mse = float(np.mean(np.power(x - reconst, 2)))
    threshold = float(press.threshold_state["threshold"])
    is_anomaly = 1.0 if mse > threshold else 0.0

    sensor_summary = {}
    for i, k in enumerate(keys):
        if i < F_model:
            sensor_summary[k] = float(arr[-1, i])

    return {
        "reconstruction_error": mse,
        "is_anomaly": is_anomaly,
        "threshold": threshold,
        "sensor_values": sensor_summary,
    }


# ── Press 이미지 (주문별) ──
@app.post("/api/v1/smartfactory/order/{order_id}/press/image")
async def predict_press_image_by_order(order_id: str):
    """
    datasets/{order_id}/press/ 내 이미지 파일을 CNN 모델로 분석한다.
    """
    try:
        press_folder = os.path.join(DATASETS_DIR, order_id, "press")
        if not os.path.isdir(press_folder):
            raise HTTPException(status_code=404, detail=f"press folder not found for order {order_id}")

        img_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
        img_files = sorted([f for f in os.listdir(press_folder) if os.path.splitext(f)[1].lower() in img_exts])
        if not img_files:
            raise HTTPException(status_code=404, detail=f"no press images in {press_folder}")

        results = []
        for fname in img_files:
            img_path = os.path.join(press_folder, fname)
            result = press._predict_press_image_from_path(img_path)
            result["source_file"] = fname
            results.append(result)

        return {"order_id": order_id, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Welding (주문별) ──
@app.post("/api/v1/smartfactory/order/{order_id}/welding/image")
async def predict_welding_by_order(order_id: str):
    """
    datasets/{order_id}/welding/ 내 이미지를 용접 결함 분석한다.
    """
    try:
        weld_folder = os.path.join(DATASETS_DIR, order_id, "welding")
        if not os.path.isdir(weld_folder):
            raise HTTPException(status_code=404, detail=f"welding folder not found for order {order_id}")

        img_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
        img_files = sorted([f for f in os.listdir(weld_folder) if os.path.splitext(f)[1].lower() in img_exts])
        if not img_files:
            raise HTTPException(status_code=404, detail=f"no welding images in {weld_folder}")

        results = []
        for fname in img_files:
            img_path = os.path.join(weld_folder, fname)
            result = full_pipeline(img_path)

            original_url = to_public_url(img_path, "welding")
            result_url = None
            if result.get("result_image_path"):
                result_url = to_public_url(result["result_image_path"], "welding")

            results.append({
                "source_file": fname,
                "status": result["status"],
                "defects": result["defects"],
                "original_image_url": original_url,
                "result_image_url": result_url,
            })

        overall = "PASS" if all(r["status"] == "PASS" for r in results) else "FAIL"
        return {"order_id": order_id, "overall": overall, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Body Assembly (주문별 배치) ──
@app.post("/api/v1/smartfactory/order/{order_id}/body/inspect")
async def body_inspect_by_order(order_id: str, conf: float = 0.25):
    """
    datasets/{order_id}/body_assembly/ 내 파트 이미지를 각각 분석한다.
    파일명에서 파트명을 추출 (door_*, bumper_*, headlamp_*, taillamp_*, radiator_*)
    """
    try:
        body_folder = os.path.join(DATASETS_DIR, order_id, "body_assembly")
        if not os.path.isdir(body_folder):
            raise HTTPException(status_code=404, detail=f"body_assembly folder not found for order {order_id}")

        img_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
        img_files = sorted([f for f in os.listdir(body_folder) if os.path.splitext(f)[1].lower() in img_exts])
        if not img_files:
            raise HTTPException(status_code=404, detail=f"no body images in {body_folder}")

        part_keywords = ["door", "bumper", "headlamp", "taillamp", "radiator"]

        results = {}
        for fname in img_files:
            img_path = os.path.join(body_folder, fname)
            fname_lower = fname.lower()

            # 파트명 추출
            part = None
            for kw in part_keywords:
                if kw in fname_lower:
                    part = kw
                    break
            if part is None:
                part = "unknown"

            with open(img_path, "rb") as f:
                contents = f.read()

            try:
                pred = body_service.predict_part(part, contents, conf=float(conf))
                out_path = body_service.save_annotated_image(pred["annotated_bgr"], BASE_DIR, filename_prefix=part)

                results[fname] = {
                    "part": pred["part"],
                    "pass_fail": pred["pass_fail"],
                    "detections": pred["detections"],
                    "original_image_url": to_public_url(img_path, "body_assembly"),
                    "result_image_url": to_public_url(out_path, "body_assembly"),
                }
            except Exception as inner:
                results[fname] = {"part": part, "error": str(inner)}

        overall = "PASS" if all(
            r.get("pass_fail") == "PASS" for r in results.values() if "error" not in r
        ) else "FAIL"
        return {"order_id": order_id, "overall": overall, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Windshield (주문별) ──
@app.post("/api/v1/smartfactory/order/{order_id}/windshield")
def predict_windshield_by_order(order_id: str):
    """
    datasets/{order_id}/inspection/windshield_*.csv 를 읽어 윈드실드 분석 수행
    """
    try:
        insp_folder = os.path.join(DATASETS_DIR, order_id, "inspection")
        if not os.path.isdir(insp_folder):
            raise HTTPException(status_code=404, detail=f"inspection folder not found for order {order_id}")

        csv_files = sorted([f for f in os.listdir(insp_folder) if f.startswith("windshield") and f.endswith(".csv")])
        if not csv_files:
            raise HTTPException(status_code=404, detail=f"no windshield CSV in {insp_folder}")

        results = []
        for cf in csv_files:
            cpath = os.path.join(insp_folder, cf)
            with open(cpath, "rb") as fp:
                csv_bytes = fp.read()

            # side 추출 (파일명에서 left/right 판별)
            side = "left" if "left" in cf.lower() else "right"
            pred, judgement = windshield.predict_from_csv(side, csv_bytes)
            results.append({
                "source_file": cf,
                "side": side,
                "prediction": pred,
                "judgement": judgement,
            })

        overall = "PASS" if all(r["judgement"] == "PASS" for r in results) else "FAIL"
        return {"order_id": order_id, "overall": overall, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Engine (주문별) ──
@app.post("/api/v1/smartfactory/order/{order_id}/engine")
def predict_engine_by_order(order_id: str):
    """
    datasets/{order_id}/inspection/engine.arff 를 읽어 엔진 진동 분석 수행
    """
    try:
        insp_folder = os.path.join(DATASETS_DIR, order_id, "inspection")
        if not os.path.isdir(insp_folder):
            raise HTTPException(status_code=404, detail=f"inspection folder not found for order {order_id}")

        arff_files = sorted([f for f in os.listdir(insp_folder) if f.endswith(".arff")])
        if not arff_files:
            raise HTTPException(status_code=404, detail=f"no engine ARFF in {insp_folder}")

        results = []
        for af in arff_files:
            apath = os.path.join(insp_folder, af)
            with open(apath, "rb") as fp:
                arff_bytes = fp.read()

            pred, judgement = engine.predict_from_arff(arff_bytes)
            results.append({
                "source_file": af,
                "prediction": pred,
                "judgement": judgement,
            })

        overall = "PASS" if all(r["judgement"] in ("PASS", "NORMAL") for r in results) else "FAIL"
        return {"order_id": order_id, "overall": overall, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── 주문 전체 공정 일괄 분석 ──
@app.post("/api/v1/smartfactory/order/{order_id}/all")
async def predict_all_by_order(order_id: str):
    """
    datasets/{order_id}/ 안에 있는 모든 공정 데이터를 한 번에 분석한다.
    """
    try:
        order_dir = os.path.join(DATASETS_DIR, order_id)
        if not os.path.isdir(order_dir):
            raise HTTPException(status_code=404, detail=f"order not found: {order_id}")

        all_results = {"order_id": order_id}

        # Paint (배치)
        paint_folder = os.path.join(order_dir, "paint")
        if os.path.isdir(paint_folder) and PAINT_CFG is not None:
            try:
                all_results["paint"] = paint_service.predict_paint_defect_batch(
                    folder_path=paint_folder,
                    base_dir=BASE_DIR,
                    save_image_dir=PAINT_CFG["SAVE_IMAGE_DIR"],
                    save_label_dir=PAINT_CFG["SAVE_LABEL_DIR"],
                    save_result_dir=PAINT_CFG["SAVE_RESULT_DIR"],
                    backend_url="http://localhost:3001/api/paint-analysis",
                )
            except Exception as e:
                all_results["paint"] = {"status": "error", "message": str(e)}

        # Welding
        weld_folder = os.path.join(order_dir, "welding")
        if os.path.isdir(weld_folder):
            try:
                img_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
                weld_imgs = sorted([f for f in os.listdir(weld_folder) if os.path.splitext(f)[1].lower() in img_exts])
                weld_results = []
                for fname in weld_imgs:
                    r = full_pipeline(os.path.join(weld_folder, fname))
                    weld_results.append({"source_file": fname, "status": r["status"], "defects": r["defects"]})
                all_results["welding"] = {"results": weld_results}
            except Exception as e:
                all_results["welding"] = {"status": "error", "message": str(e)}

        # Press (vibration + image)
        press_folder = os.path.join(order_dir, "press")
        if os.path.isdir(press_folder):
            try:
                json_files = sorted([f for f in os.listdir(press_folder) if f.endswith(".json")])
                vib_results = []
                for jf in json_files:
                    with open(os.path.join(press_folder, jf), "r", encoding="utf-8") as fp:
                        sd = _json.load(fp)
                    vr = _predict_vibration_from_json(sd)
                    vr["source_file"] = jf
                    vib_results.append(vr)
                all_results["press_vibration"] = {"results": vib_results}
            except Exception as e:
                all_results["press_vibration"] = {"status": "error", "message": str(e)}

            try:
                img_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
                p_imgs = sorted([f for f in os.listdir(press_folder) if os.path.splitext(f)[1].lower() in img_exts])
                press_img_results = []
                for fname in p_imgs:
                    r = press._predict_press_image_from_path(os.path.join(press_folder, fname))
                    r["source_file"] = fname
                    press_img_results.append(r)
                all_results["press_image"] = {"results": press_img_results}
            except Exception as e:
                all_results["press_image"] = {"status": "error", "message": str(e)}

        # Body Assembly
        body_folder = os.path.join(order_dir, "body_assembly")
        if os.path.isdir(body_folder):
            try:
                img_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
                b_imgs = sorted([f for f in os.listdir(body_folder) if os.path.splitext(f)[1].lower() in img_exts])
                part_keywords = ["door", "bumper", "headlamp", "taillamp", "radiator"]
                body_results = {}
                for fname in b_imgs:
                    part = next((kw for kw in part_keywords if kw in fname.lower()), "unknown")
                    with open(os.path.join(body_folder, fname), "rb") as f:
                        contents = f.read()
                    pred = body_service.predict_part(part, contents, conf=0.25)
                    out_path = body_service.save_annotated_image(pred["annotated_bgr"], BASE_DIR, filename_prefix=part)
                    body_results[fname] = {"part": pred["part"], "pass_fail": pred["pass_fail"], "detections": pred["detections"]}
                all_results["body_assembly"] = {"results": body_results}
            except Exception as e:
                all_results["body_assembly"] = {"status": "error", "message": str(e)}

        # Inspection (windshield + engine)
        insp_folder = os.path.join(order_dir, "inspection")
        if os.path.isdir(insp_folder):
            # Windshield
            ws_files = sorted([f for f in os.listdir(insp_folder) if f.startswith("windshield") and f.endswith(".csv")])
            if ws_files:
                try:
                    ws_results = []
                    for cf in ws_files:
                        with open(os.path.join(insp_folder, cf), "rb") as fp:
                            csv_bytes = fp.read()
                        side = "left" if "left" in cf.lower() else "right"
                        pred, judgement = windshield.predict_from_csv(side, csv_bytes)
                        ws_results.append({"source_file": cf, "side": side, "prediction": pred, "judgement": judgement})
                    all_results["windshield"] = {"results": ws_results}
                except Exception as e:
                    all_results["windshield"] = {"status": "error", "message": str(e)}

            # Engine
            arff_files = sorted([f for f in os.listdir(insp_folder) if f.endswith(".arff")])
            if arff_files:
                try:
                    eng_results = []
                    for af in arff_files:
                        with open(os.path.join(insp_folder, af), "rb") as fp:
                            arff_bytes = fp.read()
                        pred, judgement = engine.predict_from_arff(arff_bytes)
                        eng_results.append({"source_file": af, "prediction": pred, "judgement": judgement})
                    all_results["engine"] = {"results": eng_results}
                except Exception as e:
                    all_results["engine"] = {"status": "error", "message": str(e)}

        return all_results
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
