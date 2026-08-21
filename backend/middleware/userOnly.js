import Users from "../models/UserModel/UserModel.js";

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "");
  const aliasMap = {
    superadmin: "superadmin",
    superadministrator: "superadmin",
    pengawas: "pengawas",
    peserta: "peserta",
  };
  return aliasMap[compact] || raw;
};

const normalizeUnitKerja = (value) => String(value || "").trim();

const checkRole = (roles) => async (req, res, next) => {
  try {
    const user = await Users.findOne({
      where: {
        userUUID: req.userUUID || req.userKdpegawai,
      },
    });

    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan." });
    }

    const normalizedRole = normalizeRole(user.role);
    const allowedRoles = roles.map((role) => normalizeRole(role));
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(403).json({ msg: "Access denied" });
    }
    req.role = normalizedRole;
    req.userUUID = user.userUUID;
    req.userKdpegawai = user.userUUID;
    req.kdkantor = normalizeUnitKerja(user.unitKerja);
    next();
  } catch (error) {
    console.error("Error finding user:", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
};

export const superadminOnly = checkRole(["superadmin"]);
export const superadminOrHeadOfficer = checkRole(["superadmin"]);
export const officerOnly = checkRole(["superadmin"]);
export const ketuacabangOnly = checkRole(["superadmin"]);
export const dirutOnly = checkRole(["superadmin"]);
export const getAllOnly = checkRole(["superadmin", "pengawas", "peserta"]);
export const updateOnly = checkRole(["superadmin", "pengawas", "peserta"]);
export const updatePermohonanOnly = checkRole(["superadmin", "pengawas", "peserta"]);
export const updateOnlyWithAdmin = checkRole(["superadmin", "pengawas", "peserta"]);
export const getPrivateOnly = checkRole(["superadmin"]);

