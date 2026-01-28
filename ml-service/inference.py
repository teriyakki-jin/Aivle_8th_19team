
# backend/app/inference.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Optional

import torch
import numpy as np
from PIL import Image
from ultralytics import YOLO


class YoloService:
    """
    YOLOv8n detector inference service.
    - weights_path: best.pt (학습 산출물)
    - device: "cuda"|"cpu"|None (None면 자동 결정)
    - conf_threshold: object confidence 임계값 (기본 0.25)
    - iou_threshold: NMS IOU 임계값 (기본 0.7; args.yaml 참고)
    - save_annotated: 추론 시 어노테이션 이미지 생성 여부
    """
    def __init__(
        self,
        weights_path: str | Path,
        device: Optional[str] = None,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.7,
        save_annotated: bool = True,
    ):
        self.weights_path = Path(weights_path)
        if not self.weights_path.exists():
            raise FileNotFoundError(f"weights not found: {self.weights_path}")

        # device 결정
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device

        # YOLO 모델 로드
        self.model = YOLO(str(self.weights_path))  # YOLOv8n best.pt 로드
        # 주의: TorchScript 내보낸 파일이라면 이 로드가 실패할 수 있습니다.

        # 추론 하이퍼파라미터
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.save_annotated = save_annotated

        # 클래스 라벨 (모델 안에 내장됨)
        try:
            self.names = self.model.names  # 예: {0:'scratch', 1:'dent', ...}
        except Exception:
            self.names = None

    def predict(self, img_path: Path) -> Dict:
        """
        검출 결과를 요약하여 반환:
          - status: "defect" | "normal"
          - defect_type: 최상위 클래스명 또는 None
          - confidence: 최상위 객체 신뢰도 (0~1 실수)
        또한, 필요하면 어노테이션 이미지를 생성/저장
        """
        # YOLO 추론
        results = self.model(
            source=str(img_path),
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            device=0 if self.device.startswith("cuda") else self.device,  # 'cpu' or GPU index
            verbose=False,
        )
        res = results[0]

        # 박스가 없으면 정상
        if res.boxes is None or len(res.boxes) == 0:
            # 필요시 원본 이미지를 그대로 복사하여 썸네일/정적 제공
            return {
                "status": "normal",
                "defect_type": None,
                "confidence": 0.99,  # 임의의 높은 신뢰도로 표시(요약용)
            }

        # 최상위 박스(가장 높은 conf) 선택
        confs = res.boxes.conf.cpu().numpy()
        top_idx = int(np.argmax(confs))
        top_conf = float(confs[top_idx])
        top_cls = int(res.boxes.cls[top_idx].item())
        label = self._resolve_label(top_cls)

        # (선택) 어노테이션 이미지 저장
        # res.plot() -> np.ndarray (BGR)
        if self.save_annotated:
            try:
                ann = res.plot()  # OpenCV BGR
                rgb = ann[..., ::-1]  # to RGB for PIL
                Image.fromarray(rgb).save(self._annotated_path(img_path))
            except Exception:
                pass  # 어노테이션 생성 실패는 치명적 에러로 보지 않음

        return {
            "status": "defect",
            "defect_type": label,
            "confidence": top_conf,  # 0~1
        }

    # ---------- helpers ----------

    def _resolve_label(self, cls_idx: int) -> str:
        if isinstance(self.names, dict) and cls_idx in self.names:
            return str(self.names[cls_idx])
        return f"class_{cls_idx}"

    def _annotated_path(self, img_path: Path) -> Path:
        p = Path(img_path)
        return p.with_name(f"{p.stem}_pred{p.suffix}")


# 기본 싱글톤 서비스: backend/app/models/best.pt
_default_weights = Path(__file__).resolve().parent / "models" / "best.pt"
# args.yaml에서 IOU=0.7을 사용하셨으므로 기본 iou_threshold도 0.7로 설정합니다. [1](https://ktaivle-my.sharepoint.com/personal/a086161_aivle_kt_co_kr/Documents/Microsoft%20Copilot%20Chat%20%ED%8C%8C%EC%9D%BC/args.yaml)
model_service = YoloService(
    weights_path=_default_weights,
    device=None,            # None이면 자동(cpu/cuda) 선택
    conf_threshold=0.25,    # args.yaml의 conf가 null이라 기본값 0.25 채택
    iou_threshold=0.7,      # args.yaml: iou=0.7 [1](https://ktaivle-my.sharepoint.com/personal/a086161_aivle_kt_co_kr/Documents/Microsoft%20Copilot%20Chat%20%ED%8C%8C%EC%9D%BC/args.yaml)
    save_annotated=True,
)
