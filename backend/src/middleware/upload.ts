import multer from "multer";
import path from "path";

// ─── Allowed & Blocked Extensions ────────────────────────────────────────────
// Browsers report .msg, .7z and sometimes .zip/.eml inconsistently (or as
// application/octet-stream), so each extension lists the MIME types it accepts.
const GENERIC_MIMETYPES = ["application/octet-stream", ""];
const ALLOWED_MIMETYPES_BY_EXTENSION: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".eml": ["message/rfc822", ...GENERIC_MIMETYPES],
  ".msg": ["application/vnd.ms-outlook", "application/x-msg", ...GENERIC_MIMETYPES],
  ".zip": ["application/zip", "application/x-zip-compressed", "multipart/x-zip", ...GENERIC_MIMETYPES],
  ".7z": ["application/x-7z-compressed", ...GENERIC_MIMETYPES],
};
const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_MIMETYPES_BY_EXTENSION);
const ALLOWED_FORMATS_LABEL = ".pdf, .xlsx, .eml, .msg, .zip y .7z";
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".js", ".msi", ".sh", ".cmd", ".vbs", ".ps1",
];

// 100 MB in bytes
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// ─── File Filter ─────────────────────────────────────────────────────────────
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(
        `Tipo de archivo no permitido (${ext}). Solo se aceptan ${ALLOWED_FORMATS_LABEL}.`
      )
    );
  }

  const allowedMimetypes = ALLOWED_MIMETYPES_BY_EXTENSION[ext];
  if (!allowedMimetypes || !allowedMimetypes.includes(file.mimetype)) {
    return cb(new Error(`Solo se aceptan archivos ${ALLOWED_FORMATS_LABEL}.`));
  }

  cb(null, true);
};

// ─── Multer Instance ─────────────────────────────────────────────────────────
// Using memoryStorage so we can hash the buffer before writing to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export { upload, MAX_FILE_SIZE };
