import { env } from "./env";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface StoredFile {
  fileUrl: string;
  storage: "cloudinary" | "local";
}

/**
 * Prescription scans are patient health records. They are NOT served from
 * /public — anything in /public is static and public, and the middleware
 * matcher skips paths containing a dot, so a .pdf there is world-readable.
 * They live here instead, outside the web root, and are streamed only by
 * /api/v1/files/prescriptions/[key] after an auth + ownership check.
 */
const PRIVATE_DIR = path.join(process.cwd(), "storage", "prescriptions");
const URL_PREFIX = "/api/v1/files/prescriptions";

/** Values people leave in .env that are present but meaningless. */
const PLACEHOLDER = /^(jeeva|your[-_ ]?cloud([-_ ]?name)?|cloud[-_ ]?name|changeme|placeholder|example|test|todo|xxx+|<.*>)$/i;

/**
 * True only when Cloudinary is *actually* usable. The old check tested that the
 * vars existed, not that they meant anything — so CLOUDINARY_CLOUD_NAME=jeeva
 * passed, took the Cloudinary branch, and 401'd on every upload.
 */
function cloudinaryConfigured(): boolean {
  const e = env();
  const cloud = e.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = e.CLOUDINARY_API_KEY?.trim();
  const apiSecret = e.CLOUDINARY_API_SECRET?.trim();
  if (!cloud || !apiKey || !apiSecret) return false;
  if (PLACEHOLDER.test(cloud) || PLACEHOLDER.test(apiKey) || PLACEHOLDER.test(apiSecret)) return false;
  return true;
}

/**
 * Store a file and return the URL to reach it.
 *
 * Local (default) is the right choice for patient records: the file stays on the
 * hospital's own server and is only readable through an authenticated route.
 * Cloudinary is kept as an option, but see the warning in storeFile below.
 */
export async function storeFile(
  buffer: Buffer,
  opts: { fileName: string; mimeType: string; folder?: string }
): Promise<StoredFile> {
  if (cloudinaryConfigured()) {
    try {
      return await uploadToCloudinary(buffer, opts);
    } catch (err) {
      // A CDN being down must not lose a prescription. Degrade to local disk
      // and keep going — the upload is the thing that matters.
      console.error("[storage] Cloudinary upload failed, falling back to local disk:", err);
      return saveLocally(buffer, opts);
    }
  }
  return saveLocally(buffer, opts);
}

/** Reads a stored file back. Used only by the authenticated file route. */
export async function readStoredFile(key: string): Promise<Buffer> {
  // Path traversal guard: the key is a generated filename, nothing else.
  if (!/^[A-Za-z0-9._-]+$/.test(key) || key.includes("..")) {
    throw new Error("Invalid file key");
  }
  return readFile(path.join(PRIVATE_DIR, key));
}

/** Rebuilds the public-facing URL for a stored key. */
export function fileUrlForKey(key: string): string {
  return `${URL_PREFIX}/${key}`;
}

// ---- Cloudinary (signed upload via REST, no SDK dependency) ----
async function uploadToCloudinary(
  buffer: Buffer,
  opts: { fileName: string; mimeType: string; folder?: string }
): Promise<StoredFile> {
  const e = env();
  const cloud = e.CLOUDINARY_CLOUD_NAME!;
  const apiKey = e.CLOUDINARY_API_KEY!;
  const apiSecret = e.CLOUDINARY_API_SECRET!;
  const folder = opts.folder ?? "jeeva/prescriptions";
  const timestamp = Math.floor(Date.now() / 1000);

  // NOTE: this produces a *public* secure_url. For patient records you must
  // switch to type=authenticated + signed delivery URLs, or don't use
  // Cloudinary at all. See MIGRATE-FIRST.md.
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const dataUri = `data:${opts.mimeType};base64,${buffer.toString("base64")}`;
  const form = new FormData();
  form.append("file", dataUri);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { secure_url: string };
  return { fileUrl: json.secure_url, storage: "cloudinary" };
}

// ---- Local disk, OUTSIDE the web root ----
async function saveLocally(
  buffer: Buffer,
  opts: { fileName: string; mimeType: string }
): Promise<StoredFile> {
  await mkdir(PRIVATE_DIR, { recursive: true });
  const ext = path.extname(opts.fileName) || mimeExt(opts.mimeType);
  const key = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`;
  await writeFile(path.join(PRIVATE_DIR, key), buffer);
  return { fileUrl: fileUrlForKey(key), storage: "local" };
}

function mimeExt(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return "";
}
