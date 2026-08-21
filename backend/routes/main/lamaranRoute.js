import express from "express";
import {
  applyLamaran,
  createLamaran,
  deleteLamaranApplication,
  deleteLamaran,
  getLamaranApplications,
  getLamaranByUUID,
  getLamaranList,
  getMyLamaranApplications,
  updateLamaran,
  updateLamaranStatus,
} from "../../controllers/main/lamaran.js";

const router = express.Router();

router.get("/lamaran/applications/me", getMyLamaranApplications);
router.get("/lamaran/applications", getLamaranApplications);
router.delete("/lamaran/applications/:applicationUUID", deleteLamaranApplication);
router.get("/lamaran", getLamaranList);
router.get("/lamaran/:lamaranUUID", getLamaranByUUID);
router.post("/lamaran", createLamaran);
router.post("/lamaran/:lamaranUUID/apply", applyLamaran);
router.put("/lamaran/:lamaranUUID", updateLamaran);
router.patch("/lamaran/:lamaranUUID/status", updateLamaranStatus);
router.delete("/lamaran/:lamaranUUID", deleteLamaran);

export default router;
