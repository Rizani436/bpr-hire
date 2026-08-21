import { DataTypes } from "sequelize";
import db from "../../config/Database.js";

const cleanText = (value) => String(value ?? "").trim();

const LamaranApplication = db.define(
  "lamaran_applications",
  {
    applicationUUID: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    lamaranUUID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userUUID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    verificationId: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    lamaranTitle: {
      type: DataTypes.STRING(190),
      allowNull: false,
      defaultValue: "",
    },
    tenagaAhli: {
      type: DataTypes.STRING(160),
      allowNull: false,
      defaultValue: "",
    },
    applicantName: {
      type: DataTypes.STRING(160),
      allowNull: false,
      defaultValue: "",
    },
    applicantUsername: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    applicantEmail: {
      type: DataTypes.STRING(160),
      allowNull: false,
      defaultValue: "",
    },
    status: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "Berhasil Mendaftar",
    },
    stage: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "Seleksi Administrasi",
    },
    appliedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    verificationEmailSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verificationEmailStatus: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "pending",
    },
    verificationEmailError: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["lamaranUUID", "userUUID"],
      },
      {
        unique: true,
        fields: ["verificationId"],
      },
    ],
    hooks: {
      beforeValidate: (application) => {
        application.verificationId = cleanText(
          application.verificationId
        ).toUpperCase();
        application.lamaranTitle = cleanText(application.lamaranTitle);
        application.tenagaAhli = cleanText(application.tenagaAhli);
        application.applicantName = cleanText(application.applicantName);
        application.applicantUsername = cleanText(
          application.applicantUsername
        ).toLowerCase();
        application.applicantEmail = cleanText(application.applicantEmail)
          .toLowerCase();
        application.status =
          cleanText(application.status) || "Berhasil Mendaftar";
        application.stage = cleanText(application.stage) || "Seleksi Administrasi";
        application.verificationEmailStatus =
          cleanText(application.verificationEmailStatus) || "pending";
        application.verificationEmailError =
          cleanText(application.verificationEmailError) || null;
      },
    },
  }
);

export default LamaranApplication;
