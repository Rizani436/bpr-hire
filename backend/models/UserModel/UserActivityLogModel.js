import { DataTypes } from "sequelize";
import db from "../../config/Database.js";

const cleanText = (value) => String(value ?? "").trim();

const ACTIVITY_TYPES = ["access", "delete_user"];

const UserActivityLog = db.define(
  "user_activity_logs",
  {
    logUUID: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    eventType: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "access",
    },
    eventLabel: {
      type: DataTypes.STRING(180),
      allowNull: false,
      defaultValue: "",
    },
    routePath: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "",
    },
    username: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: "",
    },
    userRole: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: "",
    },
    targetUserUUID: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    targetUsername: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: "",
    },
    targetFullName: {
      type: DataTypes.STRING(180),
      allowNull: true,
      defaultValue: "",
    },
    targetUserRole: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: "",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    hooks: {
      beforeValidate: (log) => {
        const normalizedType = cleanText(log.eventType).toLowerCase();
        log.eventType = ACTIVITY_TYPES.includes(normalizedType)
          ? normalizedType
          : "access";
        log.eventLabel = cleanText(log.eventLabel);
        log.routePath = cleanText(log.routePath);
        log.username = cleanText(log.username).toLowerCase();
        log.userRole = cleanText(log.userRole).toLowerCase();
        log.targetUsername = cleanText(log.targetUsername).toLowerCase();
        log.targetFullName = cleanText(log.targetFullName);
        log.targetUserRole = cleanText(log.targetUserRole).toLowerCase();
      },
    },
  }
);

export const USER_ACTIVITY_EVENT_TYPES = ACTIVITY_TYPES;
export default UserActivityLog;
