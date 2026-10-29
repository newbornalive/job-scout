"""Build a reproducible, allowlisted release ZIP; never package local user data."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ".env.example", ".gitignore", "README.md", "README.zh-CN.md", "CONTRIBUTING.md", "LICENSE",
    "manifest.json", "package.json", "popup.html", "style.css", "popup.js", "engine.js",
    "capture.js", "api-ui.js", "server.cjs", "api-contract.cjs", "test.cjs", "capture.test.cjs",
    "api.test.cjs", "docs/setup.md", "docs/architecture.md", "scripts/package_release.py",
]

def build():
    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError("Expected a three-part numeric version")
    if version != json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]:
        raise ValueError("manifest.json and package.json versions must match")
    files = sorted(FILES + [f"docs/releases/v{version}.md"])
    for name in files:
        if not (ROOT / name).is_file():
            raise ValueError(f"Missing release input: {name}")
    out = ROOT / "dist"
    out.mkdir(exist_ok=True)
    archive = out / f"job-scout-v{version}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as handle:
        for name in files:
            info = zipfile.ZipInfo("job-scout/" + name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            handle.writestr(info, (ROOT / name).read_bytes())
    with zipfile.ZipFile(archive) as handle:
        assert handle.testzip() is None
        assert set(handle.namelist()) == {"job-scout/" + name for name in files}
        assert json.loads(handle.read("job-scout/manifest.json"))["version"] == version
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum = out / f"job-scout-v{version}.sha256"
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    print(f"Packaged {len(files)} files: {archive.name}")
    print(f"SHA-256: {digest}")
    return archive

if __name__ == "__main__":
    build()
