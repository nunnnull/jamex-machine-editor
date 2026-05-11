import io
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from models.loader import _mock_predict, get_device, load_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_model_fn = _mock_predict
_model_loaded = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model_fn, _model_loaded
    logger.info("AI Service starting up")
    try:
        logger.info("Pre-loading RMBG-2.0 model on startup...")
        _model_fn = load_model("rmbg2")
        _model_loaded = True
        logger.info("Model pre-loaded successfully")
    except Exception as e:
        logger.error(f"Startup model loading failed, will use mock: {e}")
    yield
    logger.info("AI Service shutting down")


app = FastAPI(
    title="Jamex AI Service",
    description="Heavy machinery background removal service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    global _model_fn, _model_loaded
    device = get_device()
    return {
        "status": "ok",
        "model_loaded": _model_loaded,
        "device": "cuda" if device.type == "cuda" else "cpu",
    }


@app.post("/remove-bg")
async def remove_bg(
    file: UploadFile = File(...),
    model: str = Query("mock", regex="^(rmbg2|birefnet|u2net|mock)$"),
    mode: str = Query("blur", regex="^(transparent|blur|pixelate)$"),
    blur_strength: str = Query("medium", regex="^(light|medium|strong)$"),
    blur_type: str = Query("gaussian", regex="^(gaussian|lens|depth)$"),
):
    global _model_fn, _model_loaded

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        from preprocessing.image_utils import load_image

        try:
            image = load_image(contents)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid image file: {e}"
            )

        if not _model_loaded:
            try:
                _model_fn = load_model(model)
                _model_loaded = True
            except Exception as e:
                logger.error(f"Model loading failed: {e}")
                _model_fn = _mock_predict
                _model_loaded = False

        if model != "mock" and not _model_loaded:
            logger.warning(
                f"Requested model '{model}' not loaded, using mock"
            )

        from inference.engine import run_inference

        mask = run_inference(image, _model_fn)

        from postprocessing.mask_refinement import refine_mask

        refined_mask = refine_mask(mask, image, safety_margin=3)

        from postprocessing.png_generator import apply_mask

        result = apply_mask(
            image,
            refined_mask,
            mode=mode,
            blur_strength=blur_strength,
            blur_type=blur_type,
            auto_crop=True,
            padding=10,
            compress_level=6,
        )

        buf = io.BytesIO()
        result.save(buf, format="PNG", compress_level=3, optimize=True)
        buf.seek(0)

        logger.info(
            f"Processed image: mode={mode} {image.size} -> {result.size} "
            f"({len(buf.getvalue())} bytes)"
        )

        return Response(
            content=buf.getvalue(),
            media_type="image/png",
            headers={
                "X-Original-Size": f"{image.size[0]}x{image.size[1]}",
                "X-Result-Size": f"{result.size[0]}x{result.size[1]}",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error during bg removal")
        raise HTTPException(status_code=500, detail=str(e))
