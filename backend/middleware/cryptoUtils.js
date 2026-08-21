import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

export function encrypt(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(key, "hex"),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // iv:encrypted
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedData, key) {
  const [ivHex, encryptedText] = encryptedData.split(":");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(key, "hex"),
    Buffer.from(ivHex, "hex")
  );

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
