import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_UPLOADS_DIRECTORY = path.resolve(__dirname, "../uploads");
const PARKING_UPLOAD_PUBLIC_PREFIX = "/uploads/parking/";

export const resolveUploadsDirectory = (configuredDirectory = "") =>
  configuredDirectory?.trim()
    ? path.resolve(configuredDirectory.trim())
    : DEFAULT_UPLOADS_DIRECTORY;

export const resolveParkingUploadDirectory = (uploadsDirectory) =>
  path.join(resolveUploadsDirectory(uploadsDirectory), "parking");

export const getUploadsDirectory = () =>
  resolveUploadsDirectory(process.env.UPLOADS_DIRECTORY);

export const getParkingUploadDirectory = () =>
  resolveParkingUploadDirectory(process.env.UPLOADS_DIRECTORY);

export const getParkingUploadPublicPrefix = () =>
  PARKING_UPLOAD_PUBLIC_PREFIX;
