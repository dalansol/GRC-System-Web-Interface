"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_FILE_SIZE = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
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
exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
// ─── File Filter ─────────────────────────────────────────────────────────────
const fileFilter = (_req, file, cb) => {
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Tipo de archivo no permitido (${ext}). Solo se aceptan .pdf y .xlsx.`));
    }
    if (!ALLOWED_EXTENSIONS.includes(ext) ||
        !ALLOWED_MIMETYPES.includes(file.mimetype)) {
        return cb(new Error("Solo se aceptan archivos .pdf y .xlsx."));
    }
    cb(null, true);
};
// ─── Multer Instance ─────────────────────────────────────────────────────────
// Using memoryStorage so we can hash the buffer before writing to disk.
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
});
exports.upload = upload;
