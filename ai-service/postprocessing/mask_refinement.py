import logging

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def refine_mask(mask: np.ndarray, original: Image.Image, safety_margin: int = 3) -> np.ndarray:
    """Refine segmentation mask with edge preservation and safety margin.

    Creates a mask that errs on the side of including background rather than
    cutting into machinery, then applies a smooth feather only on the
    background side so no blur ever touches the machine.

    Args:
        mask: Raw model output mask (H, W) in [0,1] or [0,255]
        original: Original image for size reference
        safety_margin: Pixels to shrink the foreground to prevent blur bleed

    Returns:
        Refined mask in [0, 1] with safe, feathered edges
    """
    original_size = original.size

    mask = cv2.resize(mask, original_size, interpolation=cv2.INTER_LINEAR)

    if mask.max() <= 1.0:
        mask = (mask * 255).astype(np.uint8)
    else:
        mask = mask.astype(np.uint8)

    blurred = cv2.GaussianBlur(mask, (5, 5), 1.5)
    _, binary = cv2.threshold(blurred, 127, 255, cv2.THRESH_BINARY)

    kernel_close = np.ones((5, 5), np.uint8)
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel_close, iterations=2)

    kernel_open = np.ones((3, 3), np.uint8)
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_open, iterations=1)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        cleaned, connectivity=8
    )
    if num_labels > 1:
        sizes = stats[1:, -1]
        largest_idx = int(np.argmax(sizes)) + 1
        largest = np.zeros_like(cleaned)
        largest[labels == largest_idx] = 255
    else:
        largest = cleaned

    smoothed = cv2.medianBlur(largest, 5)

    if safety_margin > 0:
        kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        foreground = cv2.erode(smoothed, kernel_erode, iterations=safety_margin)
    else:
        foreground = smoothed

    dist_out = cv2.distanceTransform(
        255 - foreground, cv2.DIST_L2, 3
    )
    max_out = dist_out.max()
    if max_out > 0:
        dist_out = dist_out / max_out

    feather_radius = min(safety_margin * 4 + 4, 16)
    dist_out = np.clip(dist_out * feather_radius, 0, 1)

    result = (foreground.astype(np.float32) / 255.0) * (1.0 - dist_out / (feather_radius + 1))

    result = np.clip(result, 0, 1)
    return result.astype(np.float32)
