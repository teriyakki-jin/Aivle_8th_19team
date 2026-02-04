import os
import mimetypes
import uuid
import logging

logger = logging.getLogger(__name__)


def _get_results_bucket() -> str:
    return os.environ.get("RESULTS_BUCKET") or os.environ.get("MODEL_BUCKET", "")


def _get_results_env() -> str:
    return os.environ.get("RESULTS_ENV") or os.environ.get("MODEL_ENV", "prod")


def _get_results_prefix() -> str:
    return os.environ.get("RESULTS_PREFIX", "results")


def _get_results_base_url() -> str:
    # 예: https://d33...cloudfront.net
    return os.environ.get("RESULTS_BASE_URL", "").rstrip("/")


def _guess_content_type(path: str) -> str:
    content_type, _ = mimetypes.guess_type(path)
    return content_type or "application/octet-stream"


def public_url_for_file(abs_path: str, base_dir: str, process: str) -> str:
    """
    로컬 파일을 S3 results/<process>/ 로 업로드하고 공개 URL 반환.
    RESULTS_BUCKET 없으면 기존 /static 경로로 폴백.
    """
    bucket = _get_results_bucket()
    if not bucket:
        # fallback to /static
        rel = os.path.relpath(abs_path, base_dir).replace("\\", "/")
        return f"/static/{rel}"

    env = _get_results_env()
    prefix = _get_results_prefix()
    base_url = _get_results_base_url()

    ext = os.path.splitext(abs_path)[1].lower()
    filename = f"{uuid.uuid4().hex}{ext or ''}"
    s3_key = f"{env}/{prefix}/{process}/{filename}"

    try:
        import boto3
        s3 = boto3.client("s3")
        s3.upload_file(
            abs_path,
            bucket,
            s3_key,
            ExtraArgs={"ContentType": _guess_content_type(abs_path)},
        )
    except Exception as e:
        logger.warning("Failed to upload %s to s3://%s/%s: %s", abs_path, bucket, s3_key, e)
        rel = os.path.relpath(abs_path, base_dir).replace("\\", "/")
        return f"/static/{rel}"

    if base_url:
        return f"{base_url}/{s3_key}"
    return f"/{s3_key}"
