import { DataTypes } from "sequelize";
import db from "../../config/Database.js";

const cleanText = (value) => String(value ?? "").trim();

const normalizeSelectionFlow = (value) => {
  const raw = cleanText(value).toLowerCase();
  return raw === "langsung" ? "langsung" : "berurutan";
};

const normalizeRole = (value) => {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "");
  if (compact === "superadmin" || compact === "superadministrator") {
    return "superadmin";
  }
  if (compact === "pengawas") return "pengawas";
  if (compact === "peserta") return "peserta";
  return raw;
};

const Lamaran = db.define(
  "lamaran",
  {
    lamaranUUID: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(190),
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "Full Time",
    },
    description: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    requirementsJson: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    qualificationsJson: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    pendidikanJson: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    pengalamanJson: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    karakterDibutuhkanJson: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    requiredDocumentsJson: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    selectionFlow: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "berurutan",
    },
    selectionStagesJson: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    biodataCriteriaJson: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    openDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    closeDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: "",
    },
    createdByRole: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "",
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    hooks: {
      beforeValidate: (lamaran) => {
        lamaran.title = cleanText(lamaran.title);
        lamaran.department = cleanText(lamaran.department);
        lamaran.location = cleanText(lamaran.location);
        lamaran.type = cleanText(lamaran.type) || "Full Time";
        lamaran.description = cleanText(lamaran.description);
        lamaran.summary = cleanText(lamaran.summary);
        lamaran.qualificationsJson = cleanText(lamaran.qualificationsJson) || "[]";
        lamaran.pendidikanJson = cleanText(lamaran.pendidikanJson) || "[]";
        lamaran.pengalamanJson = cleanText(lamaran.pengalamanJson) || "[]";
        lamaran.karakterDibutuhkanJson = cleanText(lamaran.karakterDibutuhkanJson) || "[]";
        lamaran.selectionFlow = normalizeSelectionFlow(lamaran.selectionFlow);
        lamaran.createdBy = cleanText(lamaran.createdBy);
        lamaran.createdByRole = normalizeRole(lamaran.createdByRole);
      },
    },
  }
);

export default Lamaran;
