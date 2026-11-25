"""Acquire the seeded participant sample and build its content manifest."""

import json
import re
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import TypedDict

from .archive import RangeZip
from .config import MAX_BYTES, PARTICIPANTS, SEED, SOURCE, digest, write_json


class Member(TypedDict):
    """Name in the archive, expanded byte count, SHA256 and CRC32."""

    name: str
    sha256: str
    bytes: int
    crc32: int


class Manifest(TypedDict):
    """Source identity and ordered metadata and participant members."""

    sourceUrl: str
    etag: str | None
    archiveBytes: int
    seed: int
    requestedParticipants: int
    members: list[Member]


def acquire(
    data_dir: Path,
    *,
    participants: int = PARTICIPANTS,
    seed: int = SEED,
    max_bytes: int = MAX_BYTES,
    source: str = SOURCE,
) -> None:
    """Select by seeded SHA256 rank and reuse cached members matching size and CRC32."""
    data_dir.mkdir(parents=True, exist_ok=True)
    if participants <= 0:
        raise ValueError("Participant count must be positive")
    if seed < 0 or max_bytes <= 0:
        raise ValueError("Seed must be nonnegative and transfer cap positive")
    if participants != PARTICIPANTS:
        print(
            "EXPLORATORY acquisition: cannot satisfy the 2000-participant release gate", flush=True
        )
    archive = RangeZip(source, max_bytes)
    names = sorted(
        name
        for name in archive.entries
        if re.fullmatch(r"Keystrokes/files/\d+_keystrokes.txt", name)
    )
    selected = sorted(names, key=lambda name: digest(f"{seed}:{name}".encode()))[:participants]
    if len(selected) != participants:
        raise ValueError("Insufficient archive participants")
    names = ["Keystrokes/files/metadata_participants.txt", "Keystrokes/files/readme.txt", *selected]
    if sum(archive.entries[name].expanded for name in names) > 1024**3:
        raise ValueError("Total member expansion exceeds 1 GiB cap")
    cache = data_dir / "raw"
    cache.mkdir(exist_ok=True)

    def cached_member(name: str) -> Member:
        path = cache / Path(name).name
        entry = archive.entries[name]
        data = path.read_bytes() if path.exists() else None
        if data is None or len(data) != entry.expanded or zlib.crc32(data) != entry.crc32:
            data = archive.member(name)
            path.write_bytes(data)
        return {"name": name, "sha256": digest(data), "bytes": len(data), "crc32": entry.crc32}

    members = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for index, member in enumerate(pool.map(cached_member, names)):
            members.append(member)
            if index % 100 == 0:
                print(f"acquired {index}/{participants}", flush=True)
    manifest: Manifest = {
        "sourceUrl": source,
        "etag": archive.etag,
        "archiveBytes": archive.size,
        "seed": seed,
        "requestedParticipants": participants,
        "members": members,
    }
    write_json(data_dir / "manifest.json", manifest)
    print(
        json.dumps(
            {
                "manifestSha256": digest(manifest),
                "participants": participants,
                "transferredBytes": archive.used,
            }
        )
    )
