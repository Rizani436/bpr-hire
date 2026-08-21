import express from "express";
import { refreshToken } from "../../controllers/login/RefreshToken.js";

const router = express.Router();

// Support both GET and POST to avoid 404 from clients using POST.
router.get("/token", refreshToken);
router.post("/token", refreshToken);
router.get("/auth/token", refreshToken);
router.post("/auth/token", refreshToken);

export default router;
