"""Backend API tests for AE Compatibility Converter."""
import os
import io
import zipfile
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ae-version-fixer.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def sample_aepx_bytes():
    r = requests.get(f"{API}/sample", timeout=30)
    assert r.status_code == 200
    assert "xml" in r.headers.get("content-type", "").lower()
    assert "attachment" in r.headers.get("content-disposition", "").lower()
    body = r.content
    assert b"ADBE OBJECT_SELECT" in body
    assert b"ADBE Lumetri" in body
    assert b"NewExpressions2023" in body
    assert b"ADBE SpeculativePreview" in body
    return body


# ---- /api/sample
def test_sample_endpoint(sample_aepx_bytes):
    assert sample_aepx_bytes.startswith(b"<?xml")


# ---- /api/convert happy path target=2020
def test_convert_sample_2020(sample_aepx_bytes):
    files = {"file": ("sample.aepx", sample_aepx_bytes, "application/xml")}
    data = {"target_version": "2020"}
    r = requests.post(f"{API}/convert", files=files, data=data, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["detected_version"] == 2024
    assert j["target_version"] == 2020
    assert j["target_internal_version"] == "17.0"
    assert j["file_type"] == "aepx"
    assert j["total_changes"] > 0
    assert j["job_id"]
    assert j["output_filename"].endswith("_AE2020.aepx")
    removed_names = {r["name"] for r in j["removed_effects"]}
    assert "AI Object Selection" in removed_names
    assert "Advanced 3D Renderer" in removed_names
    assert "JS Expressions Engine 2023" in removed_names
    assert "Multi-Frame Rendering Preview" in removed_names
    replaced_names = {(r["from_name"], r["to_name"]) for r in j["replaced_effects"]}
    assert any(fn == "Lumetri Color" and tn == "Levels (Individual Controls)" for fn, tn in replaced_names)


# ---- /api/convert target=2023 (fewer removals than 2020)
def test_convert_sample_2023_fewer(sample_aepx_bytes):
    r2020 = requests.post(f"{API}/convert", files={"file": ("s.aepx", sample_aepx_bytes)}, data={"target_version": "2020"}, timeout=30)
    r2023 = requests.post(f"{API}/convert", files={"file": ("s.aepx", sample_aepx_bytes)}, data={"target_version": "2023"}, timeout=30)
    assert r2020.status_code == 200
    assert r2023.status_code == 200
    j20, j23 = r2020.json(), r2023.json()
    assert len(j23["removed_effects"]) < len(j20["removed_effects"])
    # 2023 should remove only since>2023 features (AI Object Selection, Advanced 3D)
    removed23 = {r["name"] for r in j23["removed_effects"]}
    assert "AI Object Selection" in removed23
    assert "JS Expressions Engine 2023" not in removed23
    assert "Multi-Frame Rendering Preview" not in removed23


# ---- /api/convert rejects unsupported extensions
def test_convert_rejects_txt():
    files = {"file": ("bad.txt", b"hello", "text/plain")}
    r = requests.post(f"{API}/convert", files=files, data={"target_version": "2020"}, timeout=30)
    assert r.status_code == 400
    assert "aepx" in r.json()["detail"].lower()


def test_convert_rejects_empty():
    files = {"file": ("empty.aepx", b"", "application/xml")}
    r = requests.post(f"{API}/convert", files=files, data={"target_version": "2020"}, timeout=30)
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_convert_rejects_invalid_target(sample_aepx_bytes):
    r = requests.post(f"{API}/convert", files={"file": ("s.aepx", sample_aepx_bytes)}, data={"target_version": "2019"}, timeout=30)
    assert r.status_code == 400
    assert "version" in r.json()["detail"].lower()


# ---- /api/download/{job_id}
def test_download_aepx_content(sample_aepx_bytes):
    r = requests.post(f"{API}/convert", files={"file": ("s.aepx", sample_aepx_bytes)}, data={"target_version": "2020"}, timeout=30)
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    out_name = r.json()["output_filename"]

    dl = requests.get(f"{API}/download/{job_id}", timeout=30)
    assert dl.status_code == 200
    assert "xml" in dl.headers.get("content-type", "").lower()
    assert out_name in dl.headers.get("content-disposition", "")
    body = dl.content.decode("utf-8", errors="replace")
    assert "Downgraded to After Effects 2020" in body
    assert "After Effects 2020" in body
    assert "17.0" in body
    # removed effects matchnames should NOT be present
    assert "ADBE OBJECT_SELECT" not in body
    assert "ADBE SpeculativePreview" not in body
    assert "NewExpressions2023" not in body
    # valid XML
    import xml.etree.ElementTree as ET
    # strip comment/header, parse from <AfterEffectsProject>
    ET.fromstring(body[body.find("<AfterEffectsProject"):])


# ---- /api/download/{job_id}/zip
def test_download_zip(sample_aepx_bytes):
    r = requests.post(f"{API}/convert", files={"file": ("s.aepx", sample_aepx_bytes)}, data={"target_version": "2020"}, timeout=30)
    job_id = r.json()["job_id"]
    out_name = r.json()["output_filename"]

    dz = requests.get(f"{API}/download/{job_id}/zip", timeout=30)
    assert dz.status_code == 200
    assert "zip" in dz.headers.get("content-type", "").lower()
    zf = zipfile.ZipFile(io.BytesIO(dz.content))
    names = zf.namelist()
    assert out_name in names
    assert "CONVERSION_REPORT.txt" in names
    report = zf.read("CONVERSION_REPORT.txt").decode("utf-8")
    assert "REMOVED EFFECTS" in report
    assert "REPLACED EFFECTS" in report


# ---- non-existent job_id
def test_download_404():
    r = requests.get(f"{API}/download/does-not-exist-job-id", timeout=30)
    assert r.status_code == 404
    r2 = requests.get(f"{API}/download/does-not-exist-job-id/zip", timeout=30)
    assert r2.status_code == 404


# ---- binary .aep detection-only
def test_convert_aep_binary():
    fake_aep = b"RIFX\x00\x00\x00\x10FAR ADBE OBJECT_SELECT some binary junk \x00\x01\x02ADBE Lumetri trailing"
    r = requests.post(f"{API}/convert", files={"file": ("p.aep", fake_aep, "application/octet-stream")}, data={"target_version": "2020"}, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["file_type"] == "aep"
    assert j["removed_effects"] == []
    assert j["replaced_effects"] == []
    assert any("detection-only" in w.lower() or "detection only" in w.lower() for w in j["warnings"])
    job_id = j["job_id"]

    dl = requests.get(f"{API}/download/{job_id}", timeout=30)
    assert dl.status_code == 200
    assert dl.content == fake_aep  # unchanged
