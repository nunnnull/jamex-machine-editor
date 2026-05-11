import logging
from typing import Callable, Optional

import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)

_device: Optional[torch.device] = None


def get_device() -> torch.device:
    global _device
    if _device is None:
        if torch.cuda.is_available():
            _device = torch.device("cuda")
            logger.info("CUDA available — using GPU")
        else:
            _device = torch.device("cpu")
            logger.info("CUDA not available — using CPU")
    return _device


def _mock_predict(image: Image.Image) -> np.ndarray:
    img = image.convert("RGB")
    arr = np.array(img, dtype=np.uint8)
    h, w = arr.shape[:2]

    edge_border = max(5, min(h, w) // 20)
    edge_pixels = np.concatenate([
        arr[:edge_border, :].reshape(-1, 3),
        arr[-edge_border:, :].reshape(-1, 3),
        arr[:, :edge_border].reshape(-1, 3),
        arr[:, -edge_border:].reshape(-1, 3),
    ], axis=0)

    bg_median = np.median(edge_pixels, axis=0).astype(np.float32)

    import cv2
    lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB).astype(np.float32)
    bg_lab = cv2.cvtColor(np.uint8([[bg_median]]), cv2.COLOR_RGB2LAB)[0, 0].astype(np.float32)

    diff = np.sqrt(np.sum((lab - bg_lab) ** 2, axis=-1))

    sobel_x = cv2.Sobel(lab[..., 0], cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(lab[..., 0], cv2.CV_32F, 0, 1, ksize=3)
    edges = np.sqrt(sobel_x ** 2 + sobel_y ** 2)
    edge_mask = edges > (edges.mean() * 1.5)

    diff_blurred = cv2.GaussianBlur(diff, (15, 15), 5)
    adaptive_threshold = diff_blurred.mean() * 0.8
    raw_mask = (diff > adaptive_threshold).astype(np.uint8) * 255

    raw_mask[edge_mask] = 255

    kernel = np.ones((7, 7), np.uint8)
    raw_mask = cv2.morphologyEx(raw_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    raw_mask = cv2.morphologyEx(raw_mask, cv2.MORPH_OPEN, kernel, iterations=1)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(raw_mask, connectivity=8)
    if num_labels > 1:
        sizes = stats[1:, -1]
        largest_idx = int(np.argmax(sizes)) + 1
        mask = np.zeros_like(raw_mask)
        mask[labels == largest_idx] = 255
    else:
        mask = raw_mask

    mask = cv2.GaussianBlur(mask, (9, 9), 2)
    return mask.astype(np.float32) / 255.0


_model_registry: dict = {}


def load_model(model_name: str) -> Callable[[Image.Image], np.ndarray]:
    global _model_registry

    if model_name in _model_registry:
        logger.info(f"Reusing cached model: {model_name}")
        return _model_registry[model_name]

    device = get_device()

    if model_name == "mock":
        logger.info("Using mock background removal")
        _model_registry[model_name] = _mock_predict
        return _mock_predict

    loaded_fn: Optional[Callable] = None

    if model_name == "rmbg2":
        from inference.rmbg import load_rmbg2_model

        loaded_fn = load_rmbg2_model(device)
    elif model_name == "birefnet":
        from inference.rmbg import load_birefnet_model

        loaded_fn = load_birefnet_model(device)
    elif model_name == "u2net":
        from inference.rmbg import load_u2net_model

        loaded_fn = load_u2net_model(device)
    else:
        logger.warning(f"Unknown model '{model_name}', falling back to mock")
        _model_registry["mock"] = _mock_predict
        return _mock_predict

    if loaded_fn is None:
        logger.warning(
            f"Failed to load '{model_name}', falling back to mock"
        )
        _model_registry["mock"] = _mock_predict
        return _mock_predict

    _model_registry[model_name] = loaded_fn
    return loaded_fn
