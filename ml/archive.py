"""Bounded range reads of named members in the local or HTTPS Aalto ZIP64 archive."""

import struct
import threading
import time
import urllib.error
import urllib.request
import zlib
from http.client import HTTPResponse
from pathlib import Path
from typing import NamedTuple

MAX_ENTRY_BYTES = 32 * 1024**2
ZIP32_MAX = 0xFFFFFFFF


def urlopen_retry(request: urllib.request.Request) -> HTTPResponse:
    """Open an HTTP request with a 60 s timeout and at most five attempts."""
    for delay in (1, 2, 4, 8):
        try:
            return urllib.request.urlopen(request, timeout=60)
        except (urllib.error.URLError, TimeoutError):
            time.sleep(delay)
    return urllib.request.urlopen(request, timeout=60)


class ZipEntry(NamedTuple):
    """Central-directory sizes and local header offset, all measured in bytes."""

    method: int
    crc32: int
    compressed: int
    expanded: int
    offset: int


def _zip64_entry(entry: ZipEntry, extra: bytes) -> ZipEntry:
    cursor = 0
    while cursor + 4 <= len(extra):
        tag, length = struct.unpack_from("<HH", extra, cursor)
        value = extra[cursor + 4 : cursor + 4 + length]
        cursor += 4 + length
        if tag == 1:
            # ZIP64 stores only the 32-bit fields that overflowed, in this order.
            offset = 0
            sizes = [entry.expanded, entry.compressed, entry.offset]
            for index, size in enumerate(sizes):
                if size == ZIP32_MAX:
                    sizes[index] = struct.unpack_from("<Q", value, offset)[0]
                    offset += 8
            entry = ZipEntry(entry.method, entry.crc32, sizes[1], sizes[0], sizes[2])
    return entry


def _entries(directory: bytes) -> dict[str, ZipEntry]:
    entries = {}
    cursor = 0
    while cursor < len(directory):
        if directory[cursor : cursor + 4] != b"PK\x01\x02":
            raise ValueError("Truncated central directory")
        fields = struct.unpack_from("<4s6H3L5H2L", directory, cursor)
        name_length, extra_length, comment_length = fields[10:13]
        name_start = cursor + 46
        extra_start = name_start + name_length
        extra_end = extra_start + extra_length
        cursor = extra_end + comment_length
        if cursor > len(directory):
            raise ValueError("Truncated central directory entry")
        name = directory[name_start:extra_start].decode("utf-8")
        entry = ZipEntry(fields[4], fields[7], fields[8], fields[9], fields[16])
        entries[name] = _zip64_entry(entry, directory[extra_start:extra_end])
    return entries


class RangeZip:
    """Read named ZIP/ZIP64 members under a shared byte budget across worker threads."""

    def __init__(self, source: str, cap: int) -> None:
        self.source = source
        self.cap = cap
        self.used = 0
        self.lock = threading.Lock()
        self.etag: str | None = None
        self.local = None if source.startswith("https://") else Path(source)
        if self.local:
            self.size = self.local.stat().st_size
        else:
            with urlopen_retry(urllib.request.Request(source, method="HEAD")) as response:
                self.size = int(response.headers["Content-Length"])
                self.etag = response.headers.get("ETag")
        self.entries = _entries(self._central_directory())

    def _central_directory(self) -> bytes:
        tail = self.fetch(max(0, self.size - 65557), self.size)
        end = tail.rfind(b"PK\x05\x06")
        if end < 0:
            raise ValueError("Missing ZIP end directory")
        _, _, _, _, _, size, offset, _ = struct.unpack_from("<4s4H2LH", tail, end)
        if size == ZIP32_MAX or offset == ZIP32_MAX:
            locator = end - 20
            if tail[locator : locator + 4] != b"PK\x06\x07":
                raise ValueError("Missing ZIP64 locator")
            position = struct.unpack_from("<Q", tail, locator + 8)[0]
            record = self.fetch(position, position + 56)
            if record[:4] != b"PK\x06\x06":
                raise ValueError("Missing ZIP64 end record")
            size, offset = struct.unpack_from("<QQ", record, 40)
        if size > MAX_ENTRY_BYTES:
            raise ValueError("Central directory exceeds expansion cap")
        return self.fetch(offset, offset + size)

    def fetch(self, start: int, end: int) -> bytes:
        """Read exactly [start, end) bytes. Reject changed sources and inexact responses."""
        if start < 0 or end > self.size or end < start:
            raise ValueError("Invalid archive range")
        length = end - start
        with self.lock:
            self.used += length
            if self.used > self.cap:
                raise ValueError(
                    "Transfer cap exceeded; cache retained; increase explicit --max-bytes"
                )
        if self.local:
            with self.local.open("rb") as source:
                source.seek(start)
                data = source.read(length)
        else:
            headers = {"Range": f"bytes={start}-{end - 1}", "Accept-Encoding": "identity"}
            if self.etag:
                headers["If-Match"] = self.etag
            with urlopen_retry(urllib.request.Request(self.source, headers=headers)) as response:
                expected_range = f"bytes {start}-{end - 1}/{self.size}"
                if (
                    response.status != 206
                    or response.headers.get("Content-Range") != expected_range
                ):
                    raise ValueError("Server ignored requested range")
                if self.etag and response.headers.get("ETag") != self.etag:
                    raise ValueError("Source ETag changed")
                data = response.read(length + 1)
        if len(data) != length:
            raise ValueError("Truncated/oversized range response")
        return data

    def member(self, name: str) -> bytes:
        """Expand a stored or deflated member of at most 32 MiB and verify its CRC32."""
        entry = self.entries[name]
        if max(entry.expanded, entry.compressed) > MAX_ENTRY_BYTES:
            raise ValueError("Member expansion cap exceeded")
        header = self.fetch(entry.offset, entry.offset + 30)
        if header[:4] != b"PK\x03\x04":
            raise ValueError("Bad local ZIP header")
        name_length, extra_length = struct.unpack_from("<HH", header, 26)
        start = entry.offset + 30 + name_length + extra_length
        raw = self.fetch(start, start + entry.compressed)
        if entry.method == 8:
            decoder = zlib.decompressobj(-15)
            result = decoder.decompress(raw, entry.expanded + 1)
            if not decoder.eof or decoder.unconsumed_tail:
                raise ValueError("Truncated/oversized deflate stream")
        elif entry.method == 0:
            result = raw
        else:
            raise ValueError("Unsupported ZIP compression")
        if len(result) != entry.expanded or zlib.crc32(result) != entry.crc32:
            raise ValueError("Member checksum mismatch")
        return result
