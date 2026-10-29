import base64
import hashlib
import io
from PIL import Image, ImageOps

MEDGEMMA_RESOLUTION = 896
PROCESSOR_VERSION = "1.5.0-896px-letterbox"


def normalize_medical_image_896(raw_bytes: bytes) -> tuple[Image.Image, str]:
    """
    Applies deterministic aspect-ratio-preserving bicubic letterbox padding to 896x896 RGB.
    Returns both the PIL.Image and its SHA-256 digest for parity auditing against Transformers.
    """
    src_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    padded_img = ImageOps.pad(
        src_img,
        (MEDGEMMA_RESOLUTION, MEDGEMMA_RESOLUTION),
        method=Image.Resampling.BICUBIC,
        color=(0, 0, 0),
    )
    png_buf = io.BytesIO()
    padded_img.save(png_buf, format="PNG")
    digest = hashlib.sha256(png_buf.getvalue()).hexdigest()
    return padded_img, digest


def decode_and_normalize_b64_images(
    images_payload: list[dict[str, str]],
) -> tuple[list[Image.Image], list[str]]:
    pil_images: list[Image.Image] = []
    digests: list[str] = []
    for item in images_payload:
        raw_bytes = base64.b64decode(item["base64_png"])
        img, sha_hex = normalize_medical_image_896(raw_bytes)
        pil_images.append(img)
        digests.append(sha_hex)
    return pil_images, digests

