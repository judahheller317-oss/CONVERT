from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import io
import time
import json
import zipfile
import logging
import uuid
from pathlib import Path

import converter as ae

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JOBS_DIR = Path("/tmp/ae_converter")
JOBS_DIR.mkdir(parents=True, exist_ok=True)
JOB_TTL_SECONDS = 3600  # auto-delete temp files after 1 hour

app = FastAPI(title="AE Compatibility Converter")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ALLOWED_EXT = {".aepx", ".aep"}


def _prune_old_jobs():
    now = time.time()
    if not JOBS_DIR.exists():
        return
    for job in JOBS_DIR.iterdir():
        try:
            if job.is_dir() and (now - job.stat().st_mtime) > JOB_TTL_SECONDS:
                for f in job.iterdir():
                    f.unlink(missing_ok=True)
                job.rmdir()
        except Exception as e:
            logger.warning(f"prune failed for {job}: {e}")


@api_router.get("/")
async def root():
    return {"message": "AE Compatibility Converter API", "status": "ok"}


@api_router.get("/versions")
async def versions():
    return {
        "target_versions": ae.TARGET_VERSIONS,
        "internal_versions": ae.INTERNAL_VERSION,
    }


@api_router.get("/sample")
async def sample_file():
    return Response(
        content=ae.SAMPLE_AEPX.encode("utf-8"),
        media_type="application/xml",
        headers={"Content-Disposition": 'attachment; filename="sample_project.aepx"'},
    )


@api_router.post("/convert")
async def convert(file: UploadFile = File(...), target_version: int = Form(...)):
    _prune_old_jobs()

    if target_version not in ae.TARGET_VERSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported target version. Choose one of {ae.TARGET_VERSIONS}.")

    original_name = file.filename or "project.aepx"
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Only .aepx and .aep files are accepted.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(raw) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 100MB).")

    stem = Path(original_name).stem

    if ext == ".aepx":
        out_bytes, report = ae.convert_aepx(raw, target_version)
        out_name = f"{stem}_AE{target_version}.aepx"
    else:
        out_bytes, report = ae.convert_aep_binary(raw, target_version)
        out_name = f"{stem}_AE{target_version}.aep"

    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / out_name).write_bytes(out_bytes)

    report.update({
        "job_id": job_id,
        "original_filename": original_name,
        "output_filename": out_name,
        "size_bytes": len(out_bytes),
    })
    (job_dir / "report.json").write_text(json.dumps(report, indent=2))
    logger.info(f"Converted {original_name} -> AE{target_version} (job {job_id}, {report['total_changes']} changes)")
    return report


def _load_job(job_id):
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Conversion expired or not found. Please convert again.")
    report = json.loads((job_dir / "report.json").read_text())
    out_name = report["output_filename"]
    return job_dir, report, out_name


@api_router.get("/download/{job_id}")
async def download(job_id: str):
    job_dir, report, out_name = _load_job(job_id)
    data = (job_dir / out_name).read_bytes()
    return Response(
        content=data,
        media_type="application/xml" if report["file_type"] == "aepx" else "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )


@api_router.get("/download/{job_id}/zip")
async def download_zip(job_id: str):
    job_dir, report, out_name = _load_job(job_id)
    data = (job_dir / out_name).read_bytes()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(out_name, data)
        readme = _build_readme(report)
        zf.writestr("CONVERSION_REPORT.txt", readme)
    buf.seek(0)
    zip_name = f"{Path(out_name).stem}_bundle.zip"
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )


def _build_readme(report):
    lines = [
        "AE COMPATIBILITY CONVERTER - CONVERSION REPORT",
        "==============================================",
        "UNOFFICIAL, BEST-EFFORT TOOL. NOT AFFILIATED WITH ADOBE INC.",
        "",
        f"Original file : {report.get('original_filename')}",
        f"Output file   : {report.get('output_filename')}",
        f"Detected ver. : {report.get('detected_version') or 'Unknown'}",
        f"Target version: After Effects {report.get('target_version')} (internal {report.get('target_internal_version')})",
        f"Total changes : {report.get('total_changes')}",
        "",
        "REMOVED EFFECTS:",
    ]
    for r in report.get("removed_effects", []) or ["  (none)"]:
        lines.append(f"  - {r['name']} ({r['matchname']}) x{r['count']}" if isinstance(r, dict) else r)
    lines.append("")
    lines.append("REPLACED EFFECTS:")
    rep = report.get("replaced_effects", [])
    if rep:
        for r in rep:
            lines.append(f"  - {r['from_name']} -> {r['to_name']} x{r['count']}")
    else:
        lines.append("  (none)")
    lines.append("")
    lines.append("WARNINGS:")
    for w in report.get("warnings", []) or ["  (none)"]:
        lines.append(f"  ! {w}")
    return "\n".join(lines)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
