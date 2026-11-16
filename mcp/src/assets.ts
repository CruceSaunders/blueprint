// Asset intake for add_asset: strict source checks, content sniffing and SVG screening.
import fs from "node:fs";
import path from "node:path";
import { StoreError } from "./store.js";

export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const ASSET_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"] as const;

type Kind = "png" | "jpeg" | "gif" | "webp" | "svg";
const EXT_KIND: Record<string, Kind> = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".gif": "gif", ".webp": "webp", ".svg": "svg" };

/** What the bytes actually are, by signature (raster) or by content (svg). */
export function sniff(data: Buffer): Kind | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  if (data.length >= 6 && /^GIF8[79]a$/.test(data.subarray(0, 6).toString("latin1"))) return "gif";
  if (data.length >= 12 && data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  const head = data.subarray(0, 4096).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  return null;
}

/**
 * Screen an SVG asset. Assets render through <img>, where scripts never run, but the file may later be opened elsewhere,
 * so anything active or external is refused outright rather than silently rewritten.
 */
export function screenSvg(text: string): void {
  const bad: string[] = [];
  if (/<script[\s>]/i.test(text)) bad.push("<script>");
  if (/<foreignObject[\s>]/i.test(text)) bad.push("<foreignObject>");
  if (/<style[\s>]/i.test(text)) bad.push("<style>");
  if (/\son[a-z]+\s*=/i.test(text)) bad.push("event-handler attributes (on*=)");
  if (/(?:xlink:)?href\s*=\s*["']\s*(?!#)[^"']*/i.test(text)) bad.push("href to anything but a local #fragment");
  if (/url\(\s*["']?\s*(?!#)[a-z]+:/i.test(text)) bad.push("url() pointing outside the file");
  if (/<!ENTITY/i.test(text)) bad.push("XML entities");
  if (bad.length) throw new StoreError(`SVG refused: it contains ${bad.join(", ")}. Remove them (use plain shapes, presentation attributes and #fragment references only) and retry.`);
}

/** Read a caller-supplied source file with the checks the audit requires. Error messages never echo absolute paths. */
export function readSource(fromPath: string): Buffer {
  if (typeof fromPath !== "string" || !path.isAbsolute(fromPath)) throw new StoreError("`fromPath` must be an absolute path to an image file.");
  const norm = path.normalize(fromPath);
  if (norm.split(path.sep).some((seg) => seg.startsWith(".") && seg.length > 1))
    throw new StoreError("Refusing to read from a hidden (dot) directory or dot file. Copy the image somewhere ordinary first.");
  let st: fs.Stats;
  try { st = fs.lstatSync(norm); } catch { throw new StoreError("Cannot read `fromPath`: no such file."); }
  if (st.isSymbolicLink()) throw new StoreError("Refusing to read `fromPath`: it is a symbolic link. Pass the real file.");
  if (!st.isFile()) throw new StoreError("Refusing to read `fromPath`: it is not a regular file.");
  if (st.size > MAX_ASSET_BYTES) throw new StoreError(`Refusing to read \`fromPath\`: larger than ${MAX_ASSET_BYTES / 1048576} MB.`);
  // Open without following a link swapped in after the lstat, then confirm it is the same file.
  let fd: number;
  try { fd = fs.openSync(norm, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch { throw new StoreError("Cannot read `fromPath`."); }
  try {
    const fst = fs.fstatSync(fd);
    if (!fst.isFile() || fst.ino !== st.ino || fst.dev !== st.dev) throw new StoreError("Refusing to read `fromPath`: the file changed while reading.");
    const buf = Buffer.alloc(Math.min(fst.size, MAX_ASSET_BYTES));
    let off = 0;
    while (off < buf.length) { const n = fs.readSync(fd, buf, off, buf.length - off, off); if (n <= 0) break; off += n; }
    return buf.subarray(0, off);
  } finally { fs.closeSync(fd); }
}

/** Check bytes against the destination extension; returns the bytes to store. */
export function checkContent(data: Buffer, ext: string): Buffer {
  if (data.length === 0) throw new StoreError("Asset is empty.");
  if (data.length > MAX_ASSET_BYTES) throw new StoreError(`Asset is larger than ${MAX_ASSET_BYTES / 1048576} MB.`);
  const want = EXT_KIND[ext];
  const got = sniff(data);
  if (!got) throw new StoreError(`Asset content is not a PNG, JPEG, GIF, WEBP or SVG image.`);
  if (got !== want) throw new StoreError(`Asset content is ${got.toUpperCase()} but the file name ends in ${ext}. Use a matching extension.`);
  if (got === "svg") screenSvg(data.toString("utf8"));
  return data;
}
