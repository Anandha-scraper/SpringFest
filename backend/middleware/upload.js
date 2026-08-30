/** Multipart parsers, one per kind of file the app accepts.
 *
 * Each is mounted on the single route that needs it rather than app-wide, so
 * express.json() keeps handling every other endpoint untouched. Everything is
 * buffered in memory — the files are small and go straight to Cloud Storage,
 * so there is no temp-file lifecycle to manage.
 *
 * A rejected upload throws before the handler runs; middleware/errorHandler.js
 * turns multer's own MulterError into the same `{ detail }` shape as everything
 * else, so an oversized screenshot reads as the user's problem, not a 500.
 */
import multer from "multer";

import { ApiError } from "../utils/ApiError.js";

/** Extension per accepted mime type — also the accept-list itself. */
export const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const SUBMISSION_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SUBMISSION_MAX_BYTES = 25 * 1024 * 1024;

function singleFile({ field, types, maxBytes, rejection }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!types[file.mimetype]) return cb(new ApiError(400, rejection));
      cb(null, true);
    },
  }).single(field);
}

/** Participant's payment screenshot — `screenshot` field. */
export const proofUpload = singleFile({
  field: "screenshot",
  types: IMAGE_TYPES,
  maxBytes: IMAGE_MAX_BYTES,
  rejection: "Screenshot must be a PNG, JPEG or WebP image",
});

/** Admin's payment QR image — `qr` field. */
export const paymentQrUpload = singleFile({
  field: "qr",
  types: IMAGE_TYPES,
  maxBytes: IMAGE_MAX_BYTES,
  rejection: "QR must be a PNG, JPEG or WebP image",
});

/** A participant's deliverable for an event that accepts one — `file` field. */
export const submissionUpload = singleFile({
  field: "file",
  types: SUBMISSION_TYPES,
  maxBytes: SUBMISSION_MAX_BYTES,
  rejection: "Submission must be a PDF, PPT/PPTX or DOC/DOCX file",
});
