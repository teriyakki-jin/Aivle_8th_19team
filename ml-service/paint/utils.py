import os
from storage import public_url_for_file

def to_public_url(abs_path: str, base_dir: str) -> str:
    return public_url_for_file(abs_path, base_dir, "paint")
