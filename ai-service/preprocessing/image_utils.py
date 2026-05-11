import io
import logging
from typing import Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406])
IMAGENET_STD = np.array([0.229, 0.224, 0.225])


def load_image(file_bytes: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(file_bytes))
    if image.mode == "RGBA":
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")
    return image


def resize_for_inference(
    image: Image.Image, target_size: int = 1024
) -> Tuple[Image.Image, Tuple[int, int], Tuple[int, int]]:
    original_size = image.size
    w, h = original_size
    scale = target_size / max(w, h)
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))
    resized = image.resize((new_w, new_h), Image.BILINEAR)

    pad_w = target_size - new_w
    pad_h = target_size - new_h
    left = pad_w // 2
    top = pad_h // 2
    right = pad_w - left
    bottom = pad_h - top

    padded = Image.new("RGB", (target_size, target_size), (0, 0, 0))
    padded.paste(resized, (left, top))
    padding = (left, top, right, bottom)
    return padded, original_size, padding


def normalize_image(tensor: np.ndarray) -> np.ndarray:
    tensor = tensor.astype(np.float32) / 255.0
    for c in range(3):
        tensor[..., c] = (tensor[..., c] - IMAGENET_MEAN[c]) / IMAGENET_STD[c]
    return tensor


def bytes_to_numpy(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    return arr


def numpy_to_pil(arr: np.ndarray) -> Image.Image:
    if arr.dtype != np.uint8:
        arr = (arr * 255).clip(0, 255).astype(np.uint8)
    if arr.ndim == 2:
        return Image.fromarray(arr, mode="L")
    return Image.fromarray(arr)
