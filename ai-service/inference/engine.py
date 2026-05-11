import logging
import time
from typing import Callable

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def run_inference(image: Image.Image, model_fn: Callable[[Image.Image], np.ndarray]) -> np.ndarray:
    start = time.perf_counter()
    try:
        input_mode = image.mode
        if input_mode == "RGBA":
            rgb = image.convert("RGB")
        else:
            rgb = image

        mask = model_fn(rgb)

        if mask.dtype != np.float32:
            mask = mask.astype(np.float32)
        if mask.max() > 1.0:
            mask = mask / 255.0
        mask = np.clip(mask, 0.0, 1.0)

        elapsed = time.perf_counter() - start
        logger.info(
            f"Inference completed in {elapsed:.3f}s | "
            f"mask shape={mask.shape} range=[{mask.min():.3f}, {mask.max():.3f}]"
        )
        return mask
    except Exception as e:
        elapsed = time.perf_counter() - start
        logger.error(f"Inference failed after {elapsed:.3f}s: {e}")
        raise
