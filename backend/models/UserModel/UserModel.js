import { DataTypes } from "sequelize";
import db from "../../config/Database.js";

const cleanText = (value) => String(value ?? "").trim();

const normalizeRole = (value) => {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "peserta";
  const compact = raw.replace(/[\s_-]+/g, "");
  if (compact === "superadmin" || compact === "superadministrator") {
    return "superadmin";
  }
  if (compact === "pengawas") return "pengawas";
  if (compact === "peserta") return "peserta";
  return raw;
};

const Users = db.define(
  "users",
  {
    userUUID: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 100],
      },
    },
    password: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    role: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "peserta",
    },
    statusUser: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "Aktif",
    },
    fullName: {
      type: DataTypes.STRING(160),
      allowNull: false,
      defaultValue: "",
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
      defaultValue: "",
    },
    address: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    jabatan: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: "",
    },
    unitKerja: {
      type: DataTypes.STRING(160),
      allowNull: true,
      defaultValue: "",
    },
    nik: {
      type: DataTypes.STRING(32),
      allowNull: true,
      defaultValue: "",
    },
    birthPlace: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: "",
    },
    birthDate: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "",
    },
    gender: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: "",
    },
    lastEducation: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "",
    },
    major: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: "",
    },
    institution: {
      type: DataTypes.STRING(180),
      allowNull: true,
      defaultValue: "",
    },
    graduationYear: {
      type: DataTypes.STRING(8),
      allowNull: true,
      defaultValue: "",
    },
    gpa: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "",
    },
    mainSkill: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    computerSkill: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    computerSkillLevel: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: "",
    },
    languageSkill: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    workExperience: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    cvFileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "",
    },
    certificateFileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "",
    },
    experienceLetterFileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "",
    },
    ktpFileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "",
    },
    ijazahFileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "",
    },
    documentReady: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    jwt_token: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    sessionId: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    lastLoginAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLoginAttemptIp: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    lastLoginAttemptUserAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    lastLoginAttemptId: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    hooks: {
      beforeValidate: (user) => {
        user.username = cleanText(user.username).toLowerCase();
        user.email = cleanText(user.email).toLowerCase() || null;
        user.fullName = cleanText(user.fullName) || user.username;
        user.role = normalizeRole(user.role);
        user.statusUser = cleanText(user.statusUser) || "Aktif";
        user.phone = cleanText(user.phone);
        user.address = cleanText(user.address);
        user.jabatan = cleanText(user.jabatan);
        user.unitKerja = cleanText(user.unitKerja);
        user.nik = cleanText(user.nik);
        user.birthPlace = cleanText(user.birthPlace);
        user.birthDate = cleanText(user.birthDate);
        user.gender = cleanText(user.gender);
        user.lastEducation = cleanText(user.lastEducation);
        user.major = cleanText(user.major);
        user.institution = cleanText(user.institution);
        user.graduationYear = cleanText(user.graduationYear);
        user.gpa = cleanText(user.gpa);
        user.mainSkill = cleanText(user.mainSkill);
        user.computerSkill = cleanText(user.computerSkill);
        user.computerSkillLevel = cleanText(user.computerSkillLevel);
        user.languageSkill = cleanText(user.languageSkill);
        user.workExperience = cleanText(user.workExperience);
        user.cvFileName = cleanText(user.cvFileName);
        user.certificateFileName = cleanText(user.certificateFileName);
        user.experienceLetterFileName = cleanText(user.experienceLetterFileName);
        user.ktpFileName = cleanText(user.ktpFileName);
        user.ijazahFileName = cleanText(user.ijazahFileName);
      },
    },
  }
);

export default Users;
