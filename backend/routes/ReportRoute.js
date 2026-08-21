import express from "express";
import upload from "../middleware/multerConfig.js";
import { createErrorReport } from "../controllers/Report/Report.js";

const router = express.Router();

router.post("/reports/error", upload.single("buktiError"), createErrorReport);

export default router;
