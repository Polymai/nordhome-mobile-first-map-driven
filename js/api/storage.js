import { APP_CONFIG } from "../config.js";
import { storageBucket } from "../supabaseClient.js";
import { createListingImages } from "./listings.js";

const MAX_IMAGE_SIZE = 1800;
const IMAGE_QUALITY = 0.82;

function extensionFor(file, mediaType) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  return mediaType === "floor_plan" && file.type !== "image/jpeg" ? "bin" : "jpg";
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not read ${file.name}`));
    image.src = URL.createObjectURL(file);
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) {
    return { blob: file, width: null, height: null, type: file.type || "application/octet-stream" };
  }

  const image = await readImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY);
  });

  URL.revokeObjectURL(image.src);
  return { blob: blob || file, width, height, type: "image/jpeg" };
}

export async function uploadListingMedia({ listingId, userId, files, mediaType = "image" }) {
  if (!listingId || !userId) throw new Error("A saved listing and signed-in seller are required for uploads.");
  const selected = Array.from(files || []);
  if (!selected.length) return [];

  const uploaded = [];
  for (let index = 0; index < selected.length; index += 1) {
    const file = selected[index];
    const compressed = await compressImage(file);
    const ext = compressed.type === "image/jpeg" ? "jpg" : extensionFor(file, mediaType);
    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
    const storagePath = `listings/${userId}/${listingId}/${Date.now()}-${index}-${safeName}.${ext}`;

    const { error } = await storageBucket().upload(storagePath, compressed.blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: compressed.type,
    });
    if (error) throw error;

    const { data } = storageBucket().getPublicUrl(storagePath);
    uploaded.push({
      storage_path: storagePath,
      public_url: data.publicUrl,
      media_type: mediaType,
      alt_text: file.name,
      sort_order: index,
      width: compressed.width,
      height: compressed.height,
    });
  }

  return createListingImages(listingId, userId, uploaded);
}

export function mediaBucketName() {
  return APP_CONFIG.storageBucket;
}
