import express from "express";
import multer from "multer";
import upload from "../middleware/multerConfig.js";
import {
  createUser,
  deleteUser,
  getOwnProfile,
  getUserByUUID,
  getUsers,
  updateUserPassword,
  updateUserProfile,
} from "../controllers/login/Users.js";
import {
  createUserActivityLog,
  getUserActivityLogs,
} from "../controllers/login/UserActivityLogs.js";
import {
  getPegawaiLookup,
  getPegawaiRows,
  getUnitKerjaRows,
  importPegawaiExcel,
  importUnitKerjaExcel,
} from "../controllers/login/KelolaData.js";
import { superadminOnly } from "../middleware/userOnly.js";

const router = express.Router();
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
const profileDocumentUpload = upload.fields([
  { name: "cvFileName", maxCount: 1 },
  { name: "certificateFileName", maxCount: 1 },
  { name: "experienceLetterFileName", maxCount: 1 },
  { name: "ktpFileName", maxCount: 1 },
  { name: "ijazahFileName", maxCount: 1 },
]);
const handleProfileDocumentUpload = (req, res, next) => {
  profileDocumentUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        msg: error.message || "Upload berkas profil gagal.",
      });
    }
    return next();
  });
};

router.get("/users/me", getOwnProfile);
router.get("/users", superadminOnly, getUsers);
router.get("/users/activity-logs", superadminOnly, getUserActivityLogs);
router.post("/users/activity-logs", createUserActivityLog);
router.get("/users/:userUUID", getUserByUUID);
router.post("/users", superadminOnly, createUser);
router.put("/users/:userUUID", handleProfileDocumentUpload, updateUserProfile);
router.put("/users/:userUUID/password", updateUserPassword);
router.delete("/users/:userUUID", superadminOnly, deleteUser);
router.get("/master-data/unit-kerja", superadminOnly, getUnitKerjaRows);
router.post(
  "/master-data/unit-kerja/import",
  superadminOnly,
  excelUpload.single("file"),
  importUnitKerjaExcel
);
router.get("/master-data/pegawai", superadminOnly, getPegawaiRows);
router.get("/master-data/pegawai/lookup", superadminOnly, getPegawaiLookup);
router.post(
  "/master-data/pegawai/import",
  superadminOnly,
  excelUpload.single("file"),
  importPegawaiExcel
);

export default router;
