import logging
from typing import Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import AutoModelForImageSegmentation

from preprocessing.image_utils import normalize_image, resize_for_inference

logger = logging.getLogger(__name__)


class RMBG2Processor:
    def __init__(self, target_size: int = 1024):
        self.target_size = target_size

    def preprocess(self, image: Image.Image) -> Tuple[torch.Tensor, Tuple[int, int], Tuple[int, int]]:
        padded, original_size, padding = resize_for_inference(image, self.target_size)
        img_array = np.array(padded).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img_array = (img_array - mean) / std
        tensor = torch.from_numpy(img_array).permute(2, 0, 1).unsqueeze(0).float()
        return tensor, original_size, padding

    def postprocess(
        self,
        output: torch.Tensor,
        original_size: Tuple[int, int],
        padding: Tuple[int, int, int, int],
    ) -> np.ndarray:
        mask = torch.sigmoid(output).squeeze().cpu().numpy()
        mask = (mask > 0.5).astype(np.float32)
        left, top, right, bottom = padding
        h = original_size[1]
        w = original_size[0]
        if mask.ndim == 3:
            mask = mask[0]
        mask = mask[top : self.target_size - bottom, left : self.target_size - right]
        mask = np.array(
            Image.fromarray((mask * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
        ).astype(np.float32) / 255.0
        return mask


def load_rmbg2_model(device: torch.device) -> Optional[callable]:
    try:
        logger.info("Loading RMBG-2.0 model from briaai/RMBG-2.0...")
        model = AutoModelForImageSegmentation.from_pretrained(
            "briaai/RMBG-2.0", trust_remote_code=True
        )
        model.to(device)
        model.eval()
        processor = RMBG2Processor()

        def predict(image: Image.Image) -> np.ndarray:
            tensor, original_size, padding = processor.preprocess(image)
            tensor = tensor.to(device)
            with torch.no_grad():
                output = model(tensor)
            if isinstance(output, dict):
                output = output.get("out", list(output.values())[0])
            elif isinstance(output, (list, tuple)):
                output = output[-1]
            mask = processor.postprocess(output, original_size, padding)
            return mask

        logger.info("RMBG-2.0 model loaded successfully")
        return predict
    except Exception as e:
        logger.warning(f"Failed to load RMBG-2.0 model: {e}")
        return None


def load_birefnet_model(device: torch.device) -> Optional[callable]:
    try:
        logger.info("Loading BiRefNet model...")
        model = AutoModelForImageSegmentation.from_pretrained(
            "ZhengPeng7/BiRefNet", trust_remote_code=True
        )
        model.to(device)
        model.eval()
        processor = RMBG2Processor()

        def predict(image: Image.Image) -> np.ndarray:
            tensor, original_size, padding = processor.preprocess(image)
            tensor = tensor.to(device)
            with torch.no_grad():
                output = model(tensor)
            if isinstance(output, dict):
                output = output.get("out", list(output.values())[0])
            elif isinstance(output, (list, tuple)):
                output = output[-1]
            mask = processor.postprocess(output, original_size, padding)
            return mask

        logger.info("BiRefNet model loaded successfully")
        return predict
    except Exception as e:
        logger.warning(f"Failed to load BiRefNet model: {e}")
        return None


def load_u2net_model(device: torch.device) -> Optional[callable]:
    try:
        logger.info("Loading U-2-Net model...")
        model = AutoModelForImageSegmentation.from_pretrained(
            "xuduo/U-2-Net", trust_remote_code=True
        )
        model.to(device)
        model.eval()
        processor = RMBG2Processor(target_size=320)

        def predict(image: Image.Image) -> np.ndarray:
            tensor, original_size, padding = processor.preprocess(image)
            tensor = tensor.to(device)
            with torch.no_grad():
                output = model(tensor)
            if isinstance(output, dict):
                output = output.get("out", list(output.values())[0])
            mask = processor.postprocess(output, original_size, padding)
            return mask

        logger.info("U-2-Net model loaded successfully")
        return predict
    except Exception as e:
        logger.warning(f"Failed to load U-2-Net model: {e}")
        return None
