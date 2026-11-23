import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "fs";
import path from "path";
import { GraphError } from "@/lib/graph";

const INVALID = "Đường dẫn tệp không hợp lệ.";
const MARKER = "data/uploads/";

let hostCache: string | null = null;

export function thisFileHost() {
  if (hostCache) return hostCache;
  const dir = path.resolve(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "instance-id");
  try {
    const existing = readFileSync(file, "utf8").trim();
    if (/^[a-z0-9]{16,64}$/.test(existing)) {
      hostCache = existing;
      return existing;
    }
  } catch {
    // Tạo mã mới bên dưới.
  }
  const created = randomBytes(12).toString("hex");
  try {
    writeFileSync(file, created, { encoding: "utf8", flag: "wx" });
    hostCache = created;
  } catch {
    hostCache = readFileSync(file, "utf8").trim();
  }
  return hostCache;
}

export function uploadLeaf(filePath: string) {
  let raw = filePath.trim();
  if (!raw) throw new GraphError(INVALID);
  if (/^file:\/\//i.test(raw)) {
    raw = raw.replace(/^file:\/\//i, "");
    try {
      raw = decodeURIComponent(raw);
    } catch {
      // Giữ nguyên nếu chuỗi không phải URL.
    }
  }
  raw = raw.replace(/\\/g, "/");
  if (/^\/[A-Za-z]:\//.test(raw)) raw = raw.slice(1);
  const at = raw.toLowerCase().lastIndexOf(MARKER);
  const tail = at >= 0 ? raw.slice(at + MARKER.length) : raw;
  if (at < 0 && tail.includes("/")) throw new GraphError(INVALID);
  const parts = tail.split("/").filter((part) => part && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) throw new GraphError(INVALID);
  const name = parts[parts.length - 1];
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(name)) throw new GraphError(INVALID);
  return name;
}

export function portableUploadPath(filePath: string) {
  return `${MARKER}${uploadLeaf(filePath)}`;
}

function uploadsDir() {
  const dir = path.resolve(process.cwd(), "data", "uploads");
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}

export function uploadAbsolute(filePath: string) {
  const name = uploadLeaf(filePath);
  const root = uploadsDir();
  const absolute = path.join(root, name);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new GraphError(INVALID);
  }
  return absolute;
}

export function uploadExists(filePath: string | null | undefined) {
  if (!filePath) return false;
  try {
    return existsSync(uploadAbsolute(filePath));
  } catch {
    return false;
  }
}
