"""AE Compatibility Converter - core downgrade engine.

Best-effort compatibility optimizer for After Effects project files.
NOT an official Adobe tool. Operates on .aepx (XML) primarily, with
limited detection-only support for binary .aep files.
"""
import re
import xml.etree.ElementTree as ET

# Internal AE application version numbers per release year.
INTERNAL_VERSION = {
    2020: "17.0",
    2021: "18.0",
    2022: "22.0",
    2023: "23.0",
    2024: "24.0",
    2025: "25.0",
    2026: "26.0",
}

APP_VERSION_TO_YEAR = {
    "16": 2019, "17": 2020, "18": 2021, "22": 2022, "23": 2023,
    "24": 2024, "25": 2025, "26": 2026,
}

# Modern features keyed by the release year they were introduced.
# When a user targets an older year, anything introduced AFTER it is removed.
MODERN_FEATURES = [
    {"matchname": "ADBE OBJECT_SELECT", "name": "AI Object Selection", "since": 2024},
    {"matchname": "ADBE Advanced3D", "name": "Advanced 3D Renderer", "since": 2024},
    {"matchname": "ADBE TrueRotobezier", "name": "Roto Brush 3", "since": 2024},
    {"matchname": "NewExpressions2023", "name": "JS Expressions Engine 2023", "since": 2023},
    {"matchname": "ADBE OpenColorIO", "name": "OpenColorIO Color Management", "since": 2023},
    {"matchname": "ADBE SpeculativePreview", "name": "Multi-Frame Rendering Preview", "since": 2022},
    {"matchname": "ADBE 3DTransformGizmo", "name": "3D Transform Gizmo", "since": 2021},
]

# Modern effects replaced with an older equivalent when downgrading.
REPLACEMENTS = [
    {
        "matchname": "ADBE Lumetri",
        "name": "Lumetri Color",
        "replacement": "ADBE Pro Levels2",
        "replacement_name": "Levels (Individual Controls)",
        "until": 2022,  # applied when target year <= this
    },
    {
        "matchname": "ADBE AINR",
        "name": "AI Noise Reduction",
        "replacement": "ADBE Reduce Interlace Flicker",
        "replacement_name": "Remove Grain (Classic)",
        "until": 2024,
    },
]

TARGET_VERSIONS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]


def build_plan(target_year):
    remove = [f for f in MODERN_FEATURES if f["since"] > target_year]
    replace = [r for r in REPLACEMENTS if target_year <= r["until"]]
    return remove, replace


def detect_version(text):
    """Best-effort detection of the AE version that created the file."""
    m = re.search(r"After\s*Effects\s*(\d{4})", text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"ProjectVersion[\"'>\s:=]*?(\d{1,2})\.\d", text)
    if m and m.group(1) in APP_VERSION_TO_YEAR:
        return APP_VERSION_TO_YEAR[m.group(1)]
    m = re.search(r"\b(1[6-9]|2[0-5])\.\d{1,2}\b", text)
    if m and m.group(1) in APP_VERSION_TO_YEAR:
        return APP_VERSION_TO_YEAR[m.group(1)]
    return None


def update_version_metadata(text, target_year):
    internal = INTERNAL_VERSION.get(target_year, "17.0")
    text = re.sub(r"(After\s*Effects\s*)\d{4}", r"\g<1>%d" % target_year, text, flags=re.IGNORECASE)
    text = re.sub(r"(ProjectVersion[\"'>\s:=]*?)\d{1,2}\.\d+", r"\g<1>%s" % internal, text)
    return text


def _scan_counts(text, matchname):
    return len(re.findall(re.escape(matchname), text, re.IGNORECASE))


def convert_aepx(raw_bytes, target_year):
    """Convert XML-based .aepx content. Returns (output_bytes, report)."""
    text = raw_bytes.decode("utf-8", errors="replace")
    detected = detect_version(text)
    remove_features, replace_features = build_plan(target_year)

    removed_report = []
    replaced_report = []
    warnings = []

    parse_ok = True
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        parse_ok = False
        warnings.append(f"File is not strictly valid XML ({e}). Applied text-level changes only.")

    if parse_ok:
        parent_map = {child: parent for parent in root.iter() for child in parent}
        to_remove = []
        counts = {}
        for elem in root.iter():
            parts = list(elem.attrib.values())
            if elem.text:
                parts.append(elem.text)
            haystack = " ".join(parts).lower()
            for f in remove_features:
                if f["matchname"].lower() in haystack:
                    to_remove.append(elem)
                    counts[f["matchname"]] = counts.get(f["matchname"], 0) + 1
                    break
        for elem in to_remove:
            parent = parent_map.get(elem)
            if parent is not None:
                parent.remove(elem)
        for f in remove_features:
            c = counts.get(f["matchname"], 0)
            if c:
                removed_report.append({"matchname": f["matchname"], "name": f["name"], "count": c})
                warnings.append(f"Removed {c}x unsupported feature: {f['name']} ({f['matchname']})")
        out_text = ET.tostring(root, encoding="unicode")
    else:
        out_text = text
        for f in remove_features:
            c = _scan_counts(out_text, f["matchname"])
            if c:
                out_text = re.sub(r"<[^>]*%s[^>]*>.*?</[^>]+>" % re.escape(f["matchname"]),
                                  "", out_text, flags=re.IGNORECASE | re.DOTALL)
                removed_report.append({"matchname": f["matchname"], "name": f["name"], "count": c})
                warnings.append(f"Removed {c}x unsupported feature: {f['name']} ({f['matchname']})")

    # Replacements (rename matchnames -> valid older equivalent)
    for r in replace_features:
        c = _scan_counts(out_text, r["matchname"])
        if c:
            out_text = re.sub(re.escape(r["matchname"]), r["replacement"], out_text, flags=re.IGNORECASE)
            replaced_report.append({
                "from_matchname": r["matchname"], "from_name": r["name"],
                "to_matchname": r["replacement"], "to_name": r["replacement_name"],
                "count": c,
            })
            warnings.append(f"Replaced {c}x {r['name']} -> {r['replacement_name']} (older equivalent)")

    out_text = update_version_metadata(out_text, target_year)

    header = '<?xml version="1.0" encoding="UTF-8"?>\n'
    comment = f"<!-- Downgraded to After Effects {target_year} by AE Compatibility Converter (unofficial, best-effort). -->\n"
    if out_text.lstrip().startswith("<?xml"):
        out_text = re.sub(r"^\s*<\?xml[^>]*\?>\s*", "", out_text)
    out_text = header + comment + out_text

    if detected is not None and detected <= target_year:
        warnings.append(f"Source file appears to be from AE {detected}, which is already <= target {target_year}. Minimal changes needed.")

    total_changes = len(removed_report) + len(replaced_report)
    report = {
        "detected_version": detected,
        "target_version": target_year,
        "target_internal_version": INTERNAL_VERSION.get(target_year),
        "removed_effects": removed_report,
        "replaced_effects": replaced_report,
        "warnings": warnings,
        "total_changes": total_changes,
        "file_type": "aepx",
        "valid_xml": parse_ok,
    }
    return out_text.encode("utf-8"), report


def convert_binary(raw_bytes, target_year, ext="aep"):
    """Offset-safe best-effort downgrade for binary AE files (.aep / .ffx).

    Binary AE files (RIFX) embed keyframes, effects and a version stamp. We
    NEVER change the byte length of the file, so all keyframe/effect data stays
    byte-aligned and intact. We only:
      - rewrite the ASCII version stamp (e.g. "After Effects 2026" -> 2020),
      - swap modern effect match-names for an OLDER equivalent of the SAME byte
        length (safe in-place), and
      - detect (report-only) any unsupported effects that cannot be safely
        removed from a binary file.
    """
    data = bytearray(raw_bytes)
    ascii_text = raw_bytes.decode("latin-1", errors="ignore")
    detected = detect_version(ascii_text)
    remove_features, replace_features = build_plan(target_year)

    replaced_report = []
    detected_effects = []
    warnings = []

    # 1) Offset-safe version stamp rewrite (same digit count -> no shift).
    target_bytes = str(target_year).encode("latin-1")
    version_rewrites = 0
    for m in re.finditer(rb"After\s*Effects\s*(\d{4})", data):
        start, end = m.span(1)
        if data[start:end] != target_bytes:
            data[start:end] = target_bytes
            version_rewrites += 1

    # 2) Equal-length match-name swaps (safe in-place replacement).
    for r in replace_features:
        src = r["matchname"].encode("latin-1")
        dst = r["replacement"].encode("latin-1")
        if len(src) != len(dst):
            continue  # length change would corrupt RIFX offsets — skip
        cnt = data.count(src)
        if cnt:
            data = bytearray(data.replace(src, dst))
            replaced_report.append({
                "from_matchname": r["matchname"], "from_name": r["name"],
                "to_matchname": r["replacement"], "to_name": r["replacement_name"],
                "count": cnt,
            })

    # 3) Detect-only: unsupported effects that cannot be safely stripped.
    for f in remove_features:
        c = _scan_counts(ascii_text, f["matchname"])
        if c:
            detected_effects.append({"matchname": f["matchname"], "name": f["name"], "count": c})
            warnings.append(f"Detected {c}x effect newer than AE {target_year}: {f['name']} (kept — binary presets can't be safely stripped)")

    if version_rewrites:
        warnings.insert(0, f"Version stamp rewritten to After Effects {target_year} ({version_rewrites}x). All keyframes preserved.")

    total_changes = len(replaced_report) + version_rewrites
    report = {
        "detected_version": detected,
        "target_version": target_year,
        "target_internal_version": INTERNAL_VERSION.get(target_year),
        "removed_effects": [],
        "replaced_effects": replaced_report,
        "detected_unsupported": detected_effects,
        "warnings": warnings,
        "total_changes": total_changes,
        "file_type": ext,
        "valid_xml": False,
    }
    return bytes(data), report



SAMPLE_AEPX = """<?xml version="1.0" encoding="UTF-8"?>
<AfterEffectsProject>
  <string>Adobe After Effects 2024</string>
  <ProjectVersion>24.0</ProjectVersion>
  <Composition name="Main Comp" width="1920" height="1080" fps="30">
    <Layer name="Subject" index="1">
      <Effect matchname="ADBE OBJECT_SELECT">AI Object Selection</Effect>
      <Effect matchname="ADBE Lumetri">Lumetri Color</Effect>
      <Effect matchname="ADBE Advanced3D">Advanced 3D Renderer</Effect>
      <Effect matchname="ADBE Gaussian Blur 2">Gaussian Blur</Effect>
    </Layer>
    <Layer name="Background" index="2">
      <Effect matchname="NewExpressions2023">JS Expressions 2023</Effect>
      <Effect matchname="ADBE SpeculativePreview">MFR Preview</Effect>
      <Effect matchname="ADBE Pro Levels2">Levels</Effect>
    </Layer>
  </Composition>
</AfterEffectsProject>
"""
