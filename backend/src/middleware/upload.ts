import multer from "multer";
import path from "path";

// ─── Allowed & Blocked Extensions ────────────────────────────────────────────
const ALLOWED_EXTENSIONS = [".pdf", ".xlsx"];
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".js", ".msi", ".sh", ".cmd", ".vbs", ".ps1",
];

const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// 50 MB in bytes
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ─── File Filter ─────────────────────────────────────────────────────────────
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(
        `Tipo de archivo no permitido (${ext}). Solo se aceptan .pdf y .xlsx.`
      )
    );
  }

  if (
    !ALLOWED_EXTENSIONS.includes(ext) ||
    !ALLOWED_MIMETYPES.includes(file.mimetype)
  ) {
    return cb(new Error("Solo se aceptan archivos .pdf y .xlsx."));
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
