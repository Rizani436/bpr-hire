import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import db from "./config/Database.js";

import AuthRoute from "./routes/login/AuthRoute.js";
import TokenRoute from "./routes/login/TokenRoute.js";
import UserRoute from "./routes/UserRoute.js";
import ReportRoute from "./routes/ReportRoute.js";
import LamaranRoute from "./routes/main/lamaranRoute.js";
import { verifyToken, verifyUser } from "./middleware/verify.js";
import { startUserActivityLogCleanupJob } from "./utils/userActivityLog.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 8080);

app.use(
  cors({
    credentials: true,
    origin: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
  if (req.path.startsWith("/uploads")) return next();
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(AuthRoute);
app.use(TokenRoute);

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

app.use(verifyToken, verifyUser, UserRoute);
app.use(verifyToken, verifyUser, ReportRoute);
app.use(verifyToken, verifyUser, LamaranRoute);

db.sync({ alter: { drop: false } })
  .then(() => {
    startUserActivityLogCleanupJob();
    app.listen(PORT, () => {
      console.log(`Server up and running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to sync database:", error);
    process.exit(1);
  });
