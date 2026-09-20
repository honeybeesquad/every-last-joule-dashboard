import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_SIG = 0x04034b50;

/**
 * First file in a ZIP as UTF-8 text. Store (0) and deflate (8) only.
 * Data-descriptor zips (general-purpose bit 3) are rejected.
 */
export function unzipFirstText(buf: Uint8Array): string {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 30 || b.readUInt32LE(0) !== LOCAL_FILE_SIG) {
    throw new Error("not a ZIP local-file record");
  }
  const flags = b.readUInt16LE(6);
  const method = b.readUInt16LE(8);
  const compSize = b.readUInt32LE(18);
  const nameLen = b.readUInt16LE(26);
  const extraLen = b.readUInt16LE(28);
  if (flags & 0x8) {
    throw new Error("ZIP data descriptor (bit 3) not supported");
  }
  const dataStart = 30 + nameLen + extraLen;
  if (dataStart + compSize > b.length) {
    throw new Error("ZIP local file truncated");
  }
  const compressed = b.subarray(dataStart, dataStart + compSize);
  if (method === 0) return compressed.toString("utf8");
  if (method === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`unsupported ZIP method ${method}`);
}
