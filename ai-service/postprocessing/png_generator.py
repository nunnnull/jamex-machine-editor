import logging

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

BLUR_KERNELS = {
    "light": {"gaussian": 31, "lens": 25, "depth": 31},
    "medium": {"gaussian": 71, "lens": 61, "depth": 71},
    "strong": {"gaussian": 151, "lens": 121, "depth": 151},
}


def apply_mask(
    original: Image.Image,
    mask: np.ndarray,
    mode: str = "blur",
    blur_strength: str = "medium",
    blur_type: str = "gaussian",
    auto_crop: bool = True,
    padding: int = 10,
    compress_level: int = 6,
) -> Image.Image:
    if mode == "transparent":
        return _apply_transparent(original, mask, auto_crop, padding)
    elif mode == "pixelate":
        return _apply_pixelate(original, mask, blur_strength)
    else:
        return _apply_blur(original, mask, blur_strength, blur_type)


def _apply_transparent(
    original: Image.Image,
    mask: np.ndarray,
    auto_crop: bool = True,
    padding: int = 10,
) -> Image.Image:
    if mask.max() <= 1.0:
        mask_int = (mask * 255).astype(np.uint8)
    else:
        mask_int = mask.astype(np.uint8)

    original = original.convert("RGBA")
    r, g, b, _ = original.split()
    alpha = Image.fromarray(mask_int, mode="L")
    result = Image.merge("RGBA", (r, g, b, alpha))

    if auto_crop:
        result = _trim_transparent(result, padding)

    return result


def _get_kernel_size(strength: str, blur_type: str) -> int:
    k = BLUR_KERNELS.get(strength, BLUR_KERNELS["medium"]).get(blur_type, 71)
    return k if k % 2 == 1 else k + 1


def _apply_blur(
    original: Image.Image,
    mask: np.ndarray,
    strength: str = "medium",
    blur_type: str = "gaussian",
) -> Image.Image:
    original_rgb = original.convert("RGB")
    img_np = np.array(original_rgb, dtype=np.float32)

    k = _get_kernel_size(strength, blur_type)

    if blur_type == "lens":
        blurred = cv2.blur(img_np, (k, k))
    elif blur_type == "depth":
        blurred = _apply_depth_blur(img_np, k)
    else:
        blurred = cv2.GaussianBlur(img_np, (k, k), k / 3)

    blurred = blurred.astype(np.float32)

    if mask.ndim == 3:
        mask = mask[:, :, 0]
    if mask.max() <= 1.0:
        mask = mask.astype(np.float32)
    else:
        mask = mask.astype(np.float32) / 255.0

    mask = np.clip(mask, 0, 1)
    mask_3ch = np.stack([mask] * 3, axis=-1)

    result = (img_np * mask_3ch + blurred * (1.0 - mask_3ch)).astype(np.uint8)
    return Image.fromarray(result, mode="RGB")


def _apply_depth_blur(img: np.ndarray, max_k: int) -> np.ndarray:
    h, w = img.shape[:2]
    result = np.zeros_like(img, dtype=np.float32)

    top_strip = int(h * 0.4)
    k_bg = max_k
    k_ground = max(9, k_bg // 4)

    blurred_strong = cv2.GaussianBlur(img, (k_bg, k_bg), k_bg / 3)
    blurred_none = img

    for y in range(h):
        if y < top_strip:
            alpha = 1.0
        else:
            t = (y - top_strip) / (h - top_strip)
            alpha = max(0, 1.0 - t * 1.5)

        result[y] = blurred_strong[y] * alpha + blurred_none[y] * (1.0 - alpha)

    return result


def _apply_pixelate(
    original: Image.Image,
    mask: np.ndarray,
    strength: str = "medium",
) -> Image.Image:
    original_rgb = original.convert("RGB")
    img_np = np.array(original_rgb, dtype=np.float32)
    h, w = img_np.shape[:2]

    factors = {"light": 60, "medium": 30, "strong": 15}
    factor = factors.get(strength, 30)
    pixel_size = max(max(w, h) // factor, 6)

    small = cv2.resize(img_np, (w // pixel_size, h // pixel_size), interpolation=cv2.INTER_LINEAR)
    pixelated = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST).astype(np.float32)

    if mask.ndim == 3:
        mask = mask[:, :, 0]
    if mask.max() > 1.0:
        mask = mask.astype(np.float32) / 255.0
    mask = np.clip(mask, 0, 1)

    mask_3ch = np.stack([mask] * 3, axis=-1)
    result = (img_np * mask_3ch + pixelated * (1.0 - mask_3ch)).astype(np.uint8)
    return Image.fromarray(result, mode="RGB")


def _trim_transparent(image, padding=10):
    alpha = image.split()[-1]
    bbox = alpha.getbbox()
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))
