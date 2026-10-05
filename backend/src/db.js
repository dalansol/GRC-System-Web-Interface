"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = exports.poolPromise = void 0;
const mssql_1 = __importDefault(require("mssql"));
exports.sql = mssql_1.default;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const configuredServer = process.env.DB_SERVER || "127.0.0.1";
const [server, instanceName] = configuredServer.split("\\", 2);
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server,
    database: process.env.DB_NAME || "ExpediteGRC",
    ...(instanceName
        ? {}
        : { port: parseInt(process.env.DB_PORT || "1433", 10) }),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        ...(instanceName ? { instanceName } : {}),
    },
};
exports.poolPromise = new mssql_1.default.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
    console.log("Connected to SQL Server successfully.");
    return pool;
})
    .catch((err) => {
    console.error("Database Connection Failed: ", err);
    process.exit(1);
});
