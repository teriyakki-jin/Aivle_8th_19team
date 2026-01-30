import os
import shutil
import uuid
import traceback

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from fastapi.responses import JSONResponse

import press
import windshield
import engine
from paint import service as paint_service
import body_assembly
from body_assembly import service as body_service
from welding_image.pipeline import full_pipeline
from welding_image.schemas import DefectResponse
import welding_image

app = FastAPI(title="ML Service API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



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


def to_public_url(abs_path: str) -> str:
    """
    abs_path(절대경로) -> /static/상대경로
    """
    rel = os.path.relpath(abs_path, BASE_DIR).replace("\\", "/")
    return "/static/" + rel


# =========================
# Startup
# =========================
@app.on_event("startup")
def startup_event():
    print("서버 시작: 모델 로딩 중...")
    try:
        windshield.load_windshield_models()
        engine.load_engine_model()
        global PAINT_CFG
        PAINT_CFG = paint_service.load_paint_model(BASE_DIR)
        body_service.load_body_models(BASE_DIR)
        press.load_press_models()

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
    original_url = to_public_url(temp_path)

    # ✅ 결과 이미지 URL (runs/predict에 저장된 경로를 /static/... 으로 노출)
    result_url = None
    if result.get("result_image_path"):
        result_url = to_public_url(result["result_image_path"])

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
        original_url = to_public_url(original_abs) if original_abs else None

        result_url = None
        if result.get("result_image_path"):
            result_url = to_public_url(result["result_image_path"])

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


@app.post("/api/v1/smartfactory/paint")
async def predict_paint_endpoint(file: UploadFile = File(...)):
    try:
        if PAINT_CFG is None:
            raise HTTPException(status_code=500, detail="paint config not initialized")

        result = paint_service.predict_paint_defect(
            file_obj=file.file,
            original_filename=file.filename,
            base_dir=BASE_DIR,
            save_image_dir=PAINT_CFG["SAVE_IMAGE_DIR"],
            save_label_dir=PAINT_CFG["SAVE_LABEL_DIR"],
            save_result_dir=PAINT_CFG["SAVE_RESULT_DIR"],
            backend_url="http://localhost:3001/api/paint-analysis",  # 필요하면 env로 빼기
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
            "original_image_url": to_public_url(temp_path),
            "result_image_url": to_public_url(out_path),
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
                "original_image_url": to_public_url(temp_path),
                "result_image_url": to_public_url(out_path),
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
            "original_image_url": to_public_url(original_abs) if original_abs else None,
            "result_image_url": to_public_url(out_path),
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
                    "original_image_url": to_public_url(original_abs) if original_abs else None,
                    "result_image_url": to_public_url(out_path),
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

# 프론트엔드 public/data 경로 (상대 경로)
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
