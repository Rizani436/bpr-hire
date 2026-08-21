import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const cleanText = (value) => String(value ?? "").trim();

const dbName = cleanText(process.env.DB_NAME || process.env.DB_DBDATABASE);
const dbUser = cleanText(process.env.DB_USER || process.env.DB_USERNAME);
const dbPassword = String(process.env.DB_PASSWORD ?? "");
const dbHost = cleanText(process.env.DB_HOST);
const dbPort = Number.parseInt(String(process.env.DB_PORT), 10);
const dbDialect = cleanText(process.env.DB_DIALECT).toLowerCase();

if (!dbName || !dbUser || !dbHost) {
  throw new Error("DB_NAME, DB_USER, dan DB_HOST wajib diisi di file .env.");
}

const db = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: Number.isFinite(dbPort) ? dbPort : 3306,
  dialect: dbDialect,
  logging: (msg) => console.log(msg.split(":")[1]),
});

export { db };
export default db;
