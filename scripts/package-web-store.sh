#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"

python3 - "$ROOT_DIR" "$DIST_DIR" <<'PY'
import json
import pathlib
import re
import sys
import zipfile

root = pathlib.Path(sys.argv[1]).resolve()
dist = pathlib.Path(sys.argv[2]).resolve()
manifest_path = root / "manifest.json"

if not manifest_path.is_file():
    raise SystemExit("manifest.json is missing")

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

if manifest.get("manifest_version") != 3:
    raise SystemExit("Chrome Web Store package must use Manifest V3")
if manifest.get("name") != "FrameChute":
    raise SystemExit(f"Manifest name must be 'FrameChute'; got {manifest.get('name')!r}")

version = str(manifest.get("version", "")).strip()
if not version:
    raise SystemExit("Manifest version is missing")

description = manifest.get("description", "")
if not isinstance(description, str) or not description.strip():
    raise SystemExit("Manifest description is missing")
if len(description) > 132:
    raise SystemExit(f"Manifest description is {len(description)} characters; Chrome allows at most 132")

allowed_permissions = set()
actual_permissions = set(manifest.get("permissions", []))
if actual_permissions != allowed_permissions:
    raise SystemExit(
        "Permission gate failed. Expected no extension API permissions; got "
        + repr(sorted(actual_permissions))
    )

allowed_hosts = set()
actual_hosts = set(manifest.get("host_permissions", []))
if actual_hosts != allowed_hosts:
    raise SystemExit(
        "Host-permission gate failed. Expected no host permissions; got "
        + repr(sorted(actual_hosts))
    )

if {"http://*/*", "https://*/*", "<all_urls>"} & actual_hosts:
    raise SystemExit("Broad host access is forbidden in the Chrome Web Store candidate")

action = manifest.get("action", {})
if action.get("default_popup") != "src/launcher.html":
    raise SystemExit("Manifest action must use src/launcher.html for reliable clean-install launch")
if "background" in manifest:
    raise SystemExit("Clean-install launcher must not depend on a background service worker")

required_icons = {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
}

for size, expected in required_icons.items():
    actual = manifest.get("icons", {}).get(size)
    if actual != expected:
        raise SystemExit(f"Manifest icon {size} should be {expected!r}, got {actual!r}")
    if not (root / expected).is_file():
        raise SystemExit(f"Missing required icon: {expected}")

include_roots = [
    pathlib.Path("manifest.json"),
    pathlib.Path("LICENSE"),
    pathlib.Path("src"),
    pathlib.Path("icons"),
    pathlib.Path("assets"),
]

files = []
for item in include_roots:
    path = root / item
    if path.is_file():
        files.append(path)
    elif path.is_dir():
        files.extend(candidate for candidate in path.rglob("*") if candidate.is_file())
    else:
        raise SystemExit(f"Required package path is missing: {item}")

forbidden_binary_suffixes = {".exe", ".dll", ".msi", ".bat", ".cmd", ".ps1", ".py", ".pyc"}
for path in files:
    if path.suffix.lower() in forbidden_binary_suffixes:
        raise SystemExit(f"Forbidden desktop/runtime file in Store package: {path.relative_to(root)}")

text_suffixes = {".js", ".mjs", ".html", ".css", ".json"}
forbidden_text = [
    ("localhost dependency", re.compile(r"localhost", re.I)),
    ("loopback dependency", re.compile(r"127\.0\.0\.1")),
    ("native messaging", re.compile(r"nativeMessaging|connectNative|sendNativeMessage", re.I)),
    ("desktop companion", re.compile(r"\bcompanion\b", re.I)),
    ("Windows executable dependency", re.compile(r"\.exe\b", re.I)),
    ("eval", re.compile(r"\beval\s*\(", re.I)),
    ("Function constructor", re.compile(r"new\s+Function\s*\(", re.I)),
    ("remote script tag", re.compile(r"<script[^>]+src\s*=\s*['\"]https?://", re.I)),
    ("remote JavaScript import", re.compile(r"(?:import\s*\(|from\s*)\s*['\"]https?://", re.I)),
    ("remote importScripts", re.compile(r"importScripts\s*\(\s*['\"]https?://", re.I)),
]

for path in files:
    if path.suffix.lower() not in text_suffixes:
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    for name, pattern in forbidden_text:
        if pattern.search(text):
            raise SystemExit(f"Release gate failed: {name} found in {path.relative_to(root)}")

# DOCX is part of the primary open-file path. Reject the exact escaped-template
# corruption that can leave the extension shell visible while preventing
# workspace.js and DOCX ingestion from loading at runtime.
docx_module = (root / "src/documents/docx-document.js").read_text(encoding="utf-8")
for malformed in (r"\`", r"\${"):
    if malformed in docx_module:
        raise SystemExit(
            "Release gate failed: malformed escaped JavaScript template syntax "
            f"{malformed!r} found in src/documents/docx-document.js"
        )

dist.mkdir(parents=True, exist_ok=True)
output = dist / f"flashframe-chrome-web-store-v{version}.zip"
if output.exists():
    output.unlink()

with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(files):
        relative = path.relative_to(root).as_posix()
        if "/__pycache__/" in f"/{relative}/" or relative.endswith(".pyc"):
            continue
        archive.write(path, relative)

required_package_files = {
    "manifest.json",
    "LICENSE",
    "src/launcher.html",
    "src/launcher.js",
    "src/workspace.html",
    "src/workspace-extras.js",
    "src/picker-guard.js",
    "src/media-dock-grab-pin.js",
    "src/grab-art-runtime.js",
    "assets/grab/default.png",
    "assets/grab/hover.png",
    "assets/grab/faded.png",
    "assets/grab/expanded.png",
    "assets/images/default.png",
    "assets/images/hover.png",
    *required_icons.values(),
}

with zipfile.ZipFile(output, "r") as archive:
    names = set(archive.namelist())
    missing = sorted(required_package_files - names)
    if missing:
        raise SystemExit(f"Packaging error: required files missing from ZIP: {missing}")
    packaged_manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
    if packaged_manifest != manifest:
        raise SystemExit("Packaging error: manifest inside ZIP differs from source manifest")

print("FRAMECHUTE CHROME WEB STORE RELEASE GATE: PASS")
print(f"Version: {version}")
print(f"Store ZIP: {output}")
print("Permissions: NONE")
print("Host access: NONE")
print("Remote executable code: NONE")
print("Companion: NONE")
print("Python/EXE: NOT REQUIRED")
PY
