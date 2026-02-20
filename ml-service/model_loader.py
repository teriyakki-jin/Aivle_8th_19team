"""
S3 Model & Sample Data Downloader Utility

Downloads ML model files and sample data from S3 at startup.
- If MODEL_BUCKET env var is not set, skips download (local dev mode).
- If a local file already exists, skips download.
"""

import os
import logging

logger = logging.getLogger(__name__)

# Model files relative to ml-service/ root (individual files)
MODEL_FILES = [
    "paint/best.pt",
    "press/best_cnn_model.keras",
    "press/best_lstm_ae.keras",
    "engine/cnn_best_model.h5",
    "body_assembly/models/bumper_best.pt",
    "body_assembly/models/door_best.pt",
    "body_assembly/models/headlamp_best.pt",
    "body_assembly/models/radiator_best.pt",
    "body_assembly/models/taillamp_best.pt",
    "welding_image/stage1_best.pt",
    "welding_image/stage2_best.pt",
    "windshield/svm_left_model.pkl",
    "windshield/svm_right_model.pkl",
]

# S3 prefixes containing sample images/data (downloaded as directories)
SAMPLE_DIRS = [
    "sample_data",                    # windshield CSV, engine ARFF
    "paint/sample_images",            # paint defect images
    "press/sample_images",            # press defect images
    "welding_image/sample_images",    # welding defect images
    "body_assembly/samples/door",     # body assembly per-part
    "body_assembly/samples/bumper",
    "body_assembly/samples/headlamp",
    "body_assembly/samples/taillamp",
    "body_assembly/samples/radiator",
]


def _download_s3_directory(s3, bucket: str, s3_prefix: str, local_dir: str) -> int:
    """Download all files under an S3 prefix to a local directory. Returns count."""
    paginator = s3.get_paginator("list_objects_v2")
    count = 0

    for page in paginator.paginate(Bucket=bucket, Prefix=s3_prefix):
        for obj in page.get("Contents", []):
            s3_key = obj["Key"]
            if s3_key.endswith("/"):
                continue

            rel = s3_key[len(s3_prefix):].lstrip("/")
            if not rel:
                continue

            local_path = os.path.join(local_dir, rel)

            if os.path.exists(local_path):
                continue

            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            try:
                s3.download_file(bucket, s3_key, local_path)
                count += 1
            except Exception as e:
                logger.warning("  [warn] Failed to download %s: %s", s3_key, e)

    return count


def download_models(base_dir: str) -> None:
    """Download model files and sample data from S3 if buckets are configured."""
    bucket = os.environ.get("MODEL_BUCKET")
    frontend_bucket = os.environ.get("FRONTEND_BUCKET")

    if not bucket and not frontend_bucket:
        logger.info("MODEL_BUCKET/FRONTEND_BUCKET not set — using local files")
        return

    env = os.environ.get("MODEL_ENV", "prod")

    try:
        import boto3
        s3 = boto3.client("s3")
    except ImportError:
        logger.warning("boto3 not installed — skipping S3 download")
        return

    # 1. Download individual model files (if MODEL_BUCKET set)
    if bucket:
        logger.info("Downloading models from s3://%s/%s/ ...", bucket, env)
        for rel_path in MODEL_FILES:
            local_path = os.path.join(base_dir, rel_path)

            if os.path.exists(local_path):
                logger.info("  [skip] %s (already exists)", rel_path)
                continue

            s3_key = f"{env}/{rel_path}"
            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            try:
                logger.info("  [download] s3://%s/%s -> %s", bucket, s3_key, local_path)
                s3.download_file(bucket, s3_key, local_path)
            except Exception as e:
                logger.error("  [error] Failed to download %s: %s", s3_key, e)
                raise

        # 2. Download sample data directories from model bucket
        for rel_dir in SAMPLE_DIRS:
            s3_prefix = f"{env}/{rel_dir}/"
            local_dir = os.path.join(base_dir, rel_dir)
            os.makedirs(local_dir, exist_ok=True)

            logger.info("  [sync] s3://%s/%s -> %s", bucket, s3_prefix, local_dir)
            try:
                count = _download_s3_directory(s3, bucket, s3_prefix, local_dir)
                if count > 0:
                    logger.info("  [done] %s: %d files downloaded", rel_dir, count)
                else:
                    logger.info("  [done] %s: up-to-date (or empty on S3)", rel_dir)
            except Exception as e:
                logger.warning("  [warn] Failed to sync %s: %s", rel_dir, e)

    # 3. Download sample data from frontend bucket (windshield CSV, engine ARFF)
    if frontend_bucket:
        local_sample_dir = os.path.join(base_dir, "sample_data")
        os.makedirs(local_sample_dir, exist_ok=True)

        logger.info("  [sync] s3://%s/data/ -> %s", frontend_bucket, local_sample_dir)
        try:
            count = _download_s3_directory(s3, frontend_bucket, "data/", local_sample_dir)
            if count > 0:
                logger.info("  [done] frontend sample_data: %d files downloaded", count)
            else:
                logger.info("  [done] frontend sample_data: up-to-date (or empty on S3)")
        except Exception as e:
            logger.warning("  [warn] Failed to sync frontend sample_data: %s", e)
