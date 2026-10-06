import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const configuredServer = process.env.DB_SERVER || "127.0.0.1";
const [server, instanceName] = configuredServer.split("\\", 2);

const dbConfig: sql.config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server,
  database: process.env.DB_NAME || "ExpediteGRC",
  ...(instanceName
    ? {}
    : { port: parseInt(process.env.DB_PORT || "1433", 10) }),
  options: {
    encrypt: true,
    trustServerCertificate: true,
    ...(instanceName ? { instanceName } : {}),
  },
};

export const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("Connected to SQL Server successfully.");
    return pool;
  })
  .catch((err) => {
    console.error("Database Connection Failed: ", err);
    process.exit(1);
  });

export { sql };