import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  getParkingUploadDirectory,
  getParkingUploadPublicPrefix,
} from "../config/storage.js";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_TYPE_TO_EXTENSION = Object.freeze({
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

const PARKING_IMAGE_DATA_URI_PATTERN =
  /^data:(image\/(?:gif|jpeg|jpg|png|webp));base64,([a-z0-9+/=\s]+)$/i;

const normalizeBase64Payload = (payload) => payload.replace(/\s+/g, "");

const ensureParkingUploadDirectory = async () => {
  await fs.mkdir(getParkingUploadDirectory(), { recursive: true });
};

export const isManagedParkingImageUrl = (imageUrl = "") =>
  typeof imageUrl === "string" &&
  imageUrl.startsWith(getParkingUploadPublicPrefix());

export const saveParkingImageFromDataUri = async (imageData) => {
  if (!imageData) {
    return "";
  }

  const normalizedImageData =
    typeof imageData === "string" ? imageData.trim() : "";
  const dataUriMatch = normalizedImageData.match(PARKING_IMAGE_DATA_URI_PATTERN);

  if (!dataUriMatch) {
    throw new Error(
      "Parking image must be a PNG, JPG, WEBP, or GIF file."
    );
  }

  const mimeType = dataUriMatch[1].toLowerCase();
  const extension = MIME_TYPE_TO_EXTENSION[mimeType];
  const base64Payload = normalizeBase64Payload(dataUriMatch[2]);
  const imageBuffer = Buffer.from(base64Payload, "base64");

  if (!extension || !imageBuffer.length) {
    throw new Error("Parking image could not be processed.");
  }

  if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Parking image must be 5 MB or smaller.");
  }

  await ensureParkingUploadDirectory();

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(getParkingUploadDirectory(), fileName);

  await fs.writeFile(filePath, imageBuffer);

  return `${getParkingUploadPublicPrefix()}${fileName}`;
};

export const deleteManagedParkingImage = async (imageUrl) => {
  if (!isManagedParkingImageUrl(imageUrl)) {
    return;
  }

  await ensureParkingUploadDirectory();

  const fileName = path.basename(imageUrl);
  const parkingUploadDirectory = getParkingUploadDirectory();
  const filePath = path.join(parkingUploadDirectory, fileName);
  const normalizedTargetPath = path.normalize(filePath);
  const normalizedUploadDirectory = path.normalize(parkingUploadDirectory);

  if (!normalizedTargetPath.startsWith(normalizedUploadDirectory)) {
    return;
  }

  try {
    await fs.unlink(normalizedTargetPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};
