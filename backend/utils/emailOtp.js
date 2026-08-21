import nodemailer from "nodemailer";

const cleanText = (value) => String(value ?? "").trim();
const escapeHtml = (value) =>
  cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailConfig = () => ({
  user: cleanText(process.env.EMAIL_USER),
  pass: cleanText(process.env.EMAIL_PASS),
});

let transporterCache = null;

export const isValidEmailFormat = (value) => emailRegex.test(cleanText(value));

export const maskEmailAddress = (value) => {
  const email = cleanText(value).toLowerCase();
  const [local = "", domain = ""] = email.split("@");
  if (!local || !domain) return email;

  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "*".repeat(Math.max(1, local.length - visible.length));
  return `${visible}${hidden}@${domain}`;
};

export const isEmailOtpConfigured = () => {
  const { user, pass } = emailConfig();
  return Boolean(user && pass);
};

const getTransporter = () => {
  if (transporterCache) return transporterCache;
  const { user, pass } = emailConfig();
  transporterCache = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
  return transporterCache;
};

export const sendOtpToEmail = async ({
  toEmail,
  otpCode,
  purposeLabel = "Verifikasi Akun",
  ttlMinutes = 5,
}) => {
  const safeTo = cleanText(toEmail).toLowerCase();
  const safeOtp = cleanText(otpCode);
  const safePurpose = cleanText(purposeLabel) || "Verifikasi Akun";
  const { user } = emailConfig();

  if (!isEmailOtpConfigured()) {
    throw new Error("EMAIL_USER atau EMAIL_PASS belum dikonfigurasi.");
  }
  if (!isValidEmailFormat(safeTo)) {
    throw new Error("Email tujuan OTP tidak valid.");
  }
  if (!safeOtp) {
    throw new Error("Kode OTP tidak valid.");
  }

  const transport = getTransporter();
  const subject = `Kode OTP - ${safePurpose}`;
  const text = `Kode OTP Anda: ${safeOtp}. Berlaku ${ttlMinutes} menit. Jangan bagikan kode ini kepada siapa pun.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Kode OTP ${safePurpose}</h2>
      <p style="margin: 0 0 12px 0;">Gunakan kode berikut untuk melanjutkan proses:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 0 0 12px 0;">${safeOtp}</p>
      <p style="margin: 0 0 8px 0;">Kode berlaku selama <b>${ttlMinutes} menit</b>.</p>
      <p style="margin: 0;">Jangan bagikan kode ini kepada siapa pun.</p>
    </div>
  `;

  await transport.sendMail({
    from: user,
    to: safeTo,
    subject,
    text,
    html,
  });
};

const normalizeRoleLabel = (value) => {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "Peserta";
  const compact = raw.replace(/[\s_-]+/g, "");
  if (compact === "superadmin" || compact === "superadministrator") {
    return "Superadmin";
  }
  if (compact === "pengawas") return "Pengawas";
  if (compact === "peserta") return "Peserta";
  return raw;
};

const formatDateTimeId = (value) => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toLocaleString("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
    });
  }
  return parsed.toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });
};

const normalizeChangeList = (changes = []) => {
  if (!Array.isArray(changes)) return [];
  return changes
    .map((change) => {
      const label = cleanText(change?.label || change?.key || "Field");
      const before = cleanText(change?.before || "-");
      const after = cleanText(change?.after || "-");
      if (!label) return null;
      return { label, before, after };
    })
    .filter(Boolean);
};

export const sendAccountCreatedEmail = async ({
  toEmail,
  username,
  fullName,
  role = "peserta",
  statusUser = "Aktif",
  sourceLabel = "Sistem BPR HIRE - PT. BPR NTB (Perseroda)",
  plainPassword = "",
  loginUrl = "http://localhost:5173",
}) => {
  const safeTo = cleanText(toEmail).toLowerCase();
  const safeUsername = cleanText(username);
  const safeFullName = cleanText(fullName) || safeUsername || "-";
  const safeRole = normalizeRoleLabel(role);
  const safeStatus = cleanText(statusUser) || "Aktif";
  const safeSource =
    cleanText(sourceLabel) || "Sistem BPR HIRE - PT. BPR NTB (Perseroda)";
  const safePassword = cleanText(plainPassword) || "-";
  const safeLoginUrl = cleanText(loginUrl) || "http://localhost:5173";
  const htmlFullName = escapeHtml(safeFullName);
  const htmlUsername = escapeHtml(safeUsername || "-");
  const htmlEmail = escapeHtml(safeTo);
  const htmlRole = escapeHtml(safeRole);
  const htmlStatus = escapeHtml(safeStatus);
  const htmlSource = escapeHtml(safeSource);
  const htmlPassword = escapeHtml(safePassword);
  const htmlLoginUrl = escapeHtml(safeLoginUrl);
  const { user } = emailConfig();

  if (!isEmailOtpConfigured()) {
    throw new Error("EMAIL_USER atau EMAIL_PASS belum dikonfigurasi.");
  }
  if (!isValidEmailFormat(safeTo)) {
    throw new Error("Email tujuan tidak valid.");
  }

  const transport = getTransporter();
  const subject = "Akun BPR HIRE Berhasil Dibuat";
  const text = [
    `Halo ${safeFullName},`,
    "",
    "Akun BPR HIRE Anda telah berhasil dibuat.",
    "",
    "Detail akun:",
    `- Nama lengkap: ${safeFullName}`,
    `- Username: ${safeUsername || "-"}`,
    `- Email: ${safeTo}`,
    `- Password: ${safePassword}`,
    `- Role: ${safeRole}`,
    `- Status akun: ${safeStatus}`,
    `- Sumber pembuatan akun: ${safeSource}`,
    `- URL Login: ${safeLoginUrl}`,
    "",
    "Silakan login melalui URL di atas.",
    "Saran keamanan: segera ubah password setelah login pertama.",
  ].join("\n");
  const html = `
    <div style="margin:0;padding:24px;background:#f2f6ff;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7ff;border-radius:18px;overflow:hidden;box-shadow:0 14px 35px rgba(20,61,128,0.12);">
        <div style="padding:22px 24px;background:linear-gradient(135deg,#0f4aa3,#2e7de1);color:#ffffff;">
          <h2 style="margin:0;font-size:24px;line-height:1.25;">Akun BPR HIRE Berhasil Dibuat</h2>
          <p style="margin:10px 0 0 0;font-size:14px;opacity:0.95;">Halo <b>${htmlFullName}</b>, akun Anda sudah aktif dan siap digunakan.</p>
        </div>
        <div style="padding:22px 24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tbody>
              <tr><td style="padding:8px 0;width:170px;color:#4b5d79;"><b>Nama lengkap</b></td><td style="padding:8px 0;">${htmlFullName}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Username</b></td><td style="padding:8px 0;">${htmlUsername}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Email</b></td><td style="padding:8px 0;">${htmlEmail}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Password</b></td><td style="padding:8px 0;"><code style="background:#f3f7ff;padding:2px 6px;border-radius:6px;border:1px solid #dbe7ff;">${htmlPassword}</code></td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Role</b></td><td style="padding:8px 0;">${htmlRole}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Status akun</b></td><td style="padding:8px 0;">${htmlStatus}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Sumber</b></td><td style="padding:8px 0;">${htmlSource}</td></tr>
            </tbody>
          </table>
          <div style="margin-top:20px;">
            <a href="${htmlLoginUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#21a34a,#2bb45a);color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
              Masuk Ke Website
            </a>
          </div>
          <p style="margin:16px 0 0 0;font-size:13px;color:#5b6f8f;">URL Login: <a href="${htmlLoginUrl}" target="_blank" rel="noopener noreferrer">${htmlLoginUrl}</a></p>
          <p style="margin:10px 0 0 0;font-size:13px;color:#5b6f8f;">Saran keamanan: segera ubah password setelah login pertama.</p>
        </div>
      </div>
    </div>
  `;

  await transport.sendMail({
    from: user,
    to: safeTo,
    subject,
    text,
    html,
  });
};

export const sendUserProfileUpdatedEmail = async ({
  toEmail,
  username,
  fullName,
  role = "peserta",
  statusUser = "Aktif",
  sourceLabel = "Perubahan Profil Akun",
  updatedBy = "Sistem BPR HIRE - PT. BPR NTB (Perseroda)",
  updatedByRole = "",
  updatedAt = "",
  changes = [],
  loginUrl = "http://localhost:5173",
}) => {
  const safeTo = cleanText(toEmail).toLowerCase();
  const safeUsername = cleanText(username) || "-";
  const safeFullName = cleanText(fullName) || safeUsername || "-";
  const safeRole = normalizeRoleLabel(role);
  const safeStatus = cleanText(statusUser) || "Aktif";
  const safeSource = cleanText(sourceLabel) || "Perubahan Profil Akun";
  const safeUpdatedBy =
    cleanText(updatedBy) || "Sistem BPR HIRE - PT. BPR NTB (Perseroda)";
  const safeUpdatedByRole = normalizeRoleLabel(updatedByRole || "");
  const safeLoginUrl = cleanText(loginUrl) || "http://localhost:5173";
  const safeUpdatedAt = formatDateTimeId(updatedAt);
  const safeChanges = normalizeChangeList(changes);
  const { user } = emailConfig();

  if (!isEmailOtpConfigured()) {
    throw new Error("EMAIL_USER atau EMAIL_PASS belum dikonfigurasi.");
  }
  if (!isValidEmailFormat(safeTo)) {
    throw new Error("Email tujuan tidak valid.");
  }

  const htmlFullName = escapeHtml(safeFullName);
  const htmlUsername = escapeHtml(safeUsername);
  const htmlRole = escapeHtml(safeRole);
  const htmlStatus = escapeHtml(safeStatus);
  const htmlSource = escapeHtml(safeSource);
  const htmlUpdatedBy = escapeHtml(safeUpdatedBy);
  const htmlUpdatedByRole = escapeHtml(safeUpdatedByRole || "-");
  const htmlUpdatedAt = escapeHtml(safeUpdatedAt);
  const htmlLoginUrl = escapeHtml(safeLoginUrl);

  const changeTextRows =
    safeChanges.length > 0
      ? safeChanges.map(
          (change) =>
            `- ${change.label}: "${change.before || "-"}" -> "${change.after || "-"}"`
        )
      : ["- Tidak ada perubahan nilai (hanya penyimpanan ulang data)."];

  const changeHtmlRows =
    safeChanges.length > 0
      ? safeChanges
          .map(
            (change) =>
              `<tr>
                <td style="padding:8px 10px;border:1px solid #e3ebf9;color:#1f3760;"><b>${escapeHtml(
                  change.label
                )}</b></td>
                <td style="padding:8px 10px;border:1px solid #e3ebf9;color:#5b6f8f;">${escapeHtml(
                  change.before || "-"
                )}</td>
                <td style="padding:8px 10px;border:1px solid #e3ebf9;color:#113f7b;">${escapeHtml(
                  change.after || "-"
                )}</td>
              </tr>`
          )
          .join("")
      : `<tr>
          <td colspan="3" style="padding:10px;border:1px solid #e3ebf9;color:#5b6f8f;">Tidak ada perubahan nilai (hanya penyimpanan ulang data).</td>
        </tr>`;

  const text = [
    `Halo ${safeFullName},`,
    "",
    "Profil akun BPR HIRE Anda telah diperbarui.",
    "",
    `Waktu perubahan: ${safeUpdatedAt}`,
    `Diubah oleh: ${safeUpdatedBy}${safeUpdatedByRole ? ` (${safeUpdatedByRole})` : ""}`,
    `Sumber: ${safeSource}`,
    "",
    "Detail akun saat ini:",
    `- Username: ${safeUsername}`,
    `- Role: ${safeRole}`,
    `- Status akun: ${safeStatus}`,
    "",
    "Rincian perubahan:",
    ...changeTextRows,
    "",
    `URL Login: ${safeLoginUrl}`,
    "Jika Anda tidak merasa melakukan perubahan ini, segera hubungi admin PT. BPR NTB (Perseroda).",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f2f6ff;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe7ff;border-radius:18px;overflow:hidden;box-shadow:0 14px 35px rgba(20,61,128,0.12);">
        <div style="padding:22px 24px;background:linear-gradient(135deg,#0f4aa3,#2e7de1);color:#ffffff;">
          <h2 style="margin:0;font-size:24px;line-height:1.25;">Profil Akun Diperbarui</h2>
          <p style="margin:10px 0 0 0;font-size:14px;opacity:0.95;">Halo <b>${htmlFullName}</b>, ada perubahan pada data profil akun Anda.</p>
        </div>
        <div style="padding:22px 24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
            <tbody>
              <tr><td style="padding:8px 0;width:180px;color:#4b5d79;"><b>Username</b></td><td style="padding:8px 0;">${htmlUsername}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Role</b></td><td style="padding:8px 0;">${htmlRole}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Status akun</b></td><td style="padding:8px 0;">${htmlStatus}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Waktu perubahan</b></td><td style="padding:8px 0;">${htmlUpdatedAt}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Diubah oleh</b></td><td style="padding:8px 0;">${htmlUpdatedBy} (${htmlUpdatedByRole})</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Sumber</b></td><td style="padding:8px 0;">${htmlSource}</td></tr>
            </tbody>
          </table>

          <h3 style="margin:0 0 10px 0;font-size:15px;color:#153b74;">Rincian Perubahan</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr>
                <th style="padding:8px 10px;border:1px solid #d6e2f5;background:#f4f8ff;text-align:left;">Field</th>
                <th style="padding:8px 10px;border:1px solid #d6e2f5;background:#f4f8ff;text-align:left;">Sebelum</th>
                <th style="padding:8px 10px;border:1px solid #d6e2f5;background:#f4f8ff;text-align:left;">Sesudah</th>
              </tr>
            </thead>
            <tbody>
              ${changeHtmlRows}
            </tbody>
          </table>

          <div style="margin-top:18px;">
            <a href="${htmlLoginUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#21a34a,#2bb45a);color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
              Masuk Ke Website
            </a>
          </div>
          <p style="margin:14px 0 0 0;font-size:13px;color:#5b6f8f;">URL Login: <a href="${htmlLoginUrl}" target="_blank" rel="noopener noreferrer">${htmlLoginUrl}</a></p>
          <p style="margin:10px 0 0 0;font-size:13px;color:#5b6f8f;">Jika Anda tidak merasa melakukan perubahan ini, segera hubungi admin PT. BPR NTB (Perseroda).</p>
        </div>
      </div>
    </div>
  `;

  const transport = getTransporter();
  await transport.sendMail({
    from: user,
    to: safeTo,
    subject: "Profil Akun BPR HIRE Diperbarui",
    text,
    html,
  });
};

export const sendUserPasswordUpdatedEmail = async ({
  toEmail,
  username,
  fullName,
  role = "peserta",
  statusUser = "Aktif",
  sourceLabel = "Perubahan Password Akun",
  updatedBy = "Sistem BPR HIRE - PT. BPR NTB (Perseroda)",
  updatedByRole = "",
  updatedAt = "",
  loginUrl = "http://localhost:5173",
}) => {
  const safeTo = cleanText(toEmail).toLowerCase();
  const safeUsername = cleanText(username) || "-";
  const safeFullName = cleanText(fullName) || safeUsername || "-";
  const safeRole = normalizeRoleLabel(role);
  const safeStatus = cleanText(statusUser) || "Aktif";
  const safeSource = cleanText(sourceLabel) || "Perubahan Password Akun";
  const safeUpdatedBy =
    cleanText(updatedBy) || "Sistem BPR HIRE - PT. BPR NTB (Perseroda)";
  const safeUpdatedByRole = normalizeRoleLabel(updatedByRole || "");
  const safeLoginUrl = cleanText(loginUrl) || "http://localhost:5173";
  const safeUpdatedAt = formatDateTimeId(updatedAt);
  const { user } = emailConfig();

  if (!isEmailOtpConfigured()) {
    throw new Error("EMAIL_USER atau EMAIL_PASS belum dikonfigurasi.");
  }
  if (!isValidEmailFormat(safeTo)) {
    throw new Error("Email tujuan tidak valid.");
  }

  const htmlFullName = escapeHtml(safeFullName);
  const htmlUsername = escapeHtml(safeUsername);
  const htmlRole = escapeHtml(safeRole);
  const htmlStatus = escapeHtml(safeStatus);
  const htmlSource = escapeHtml(safeSource);
  const htmlUpdatedBy = escapeHtml(safeUpdatedBy);
  const htmlUpdatedByRole = escapeHtml(safeUpdatedByRole || "-");
  const htmlUpdatedAt = escapeHtml(safeUpdatedAt);
  const htmlLoginUrl = escapeHtml(safeLoginUrl);

  const text = [
    `Halo ${safeFullName},`,
    "",
    "Password akun BPR HIRE Anda telah berhasil diperbarui.",
    "",
    `Waktu perubahan: ${safeUpdatedAt}`,
    `Diubah oleh: ${safeUpdatedBy}${safeUpdatedByRole ? ` (${safeUpdatedByRole})` : ""}`,
    `Sumber: ${safeSource}`,
    "",
    "Detail akun:",
    `- Username: ${safeUsername}`,
    `- Role: ${safeRole}`,
    `- Status akun: ${safeStatus}`,
    "",
    `URL Login: ${safeLoginUrl}`,
    "Jika Anda tidak merasa melakukan perubahan ini, segera lakukan reset password dan hubungi admin PT. BPR NTB (Perseroda).",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f2f6ff;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7ff;border-radius:18px;overflow:hidden;box-shadow:0 14px 35px rgba(20,61,128,0.12);">
        <div style="padding:22px 24px;background:linear-gradient(135deg,#0f4aa3,#2e7de1);color:#ffffff;">
          <h2 style="margin:0;font-size:24px;line-height:1.25;">Password Akun Diperbarui</h2>
          <p style="margin:10px 0 0 0;font-size:14px;opacity:0.95;">Halo <b>${htmlFullName}</b>, password akun Anda telah berubah.</p>
        </div>
        <div style="padding:22px 24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tbody>
              <tr><td style="padding:8px 0;width:180px;color:#4b5d79;"><b>Username</b></td><td style="padding:8px 0;">${htmlUsername}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Role</b></td><td style="padding:8px 0;">${htmlRole}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Status akun</b></td><td style="padding:8px 0;">${htmlStatus}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Waktu perubahan</b></td><td style="padding:8px 0;">${htmlUpdatedAt}</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Diubah oleh</b></td><td style="padding:8px 0;">${htmlUpdatedBy} (${htmlUpdatedByRole})</td></tr>
              <tr><td style="padding:8px 0;color:#4b5d79;"><b>Sumber</b></td><td style="padding:8px 0;">${htmlSource}</td></tr>
            </tbody>
          </table>

          <div style="margin-top:18px;">
            <a href="${htmlLoginUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#21a34a,#2bb45a);color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
              Masuk Ke Website
            </a>
          </div>
          <p style="margin:14px 0 0 0;font-size:13px;color:#5b6f8f;">URL Login: <a href="${htmlLoginUrl}" target="_blank" rel="noopener noreferrer">${htmlLoginUrl}</a></p>
          <p style="margin:10px 0 0 0;font-size:13px;color:#5b6f8f;">Jika Anda tidak merasa melakukan perubahan ini, segera lakukan reset password dan hubungi admin PT. BPR NTB (Perseroda).</p>
        </div>
      </div>
    </div>
  `;

  const transport = getTransporter();
  await transport.sendMail({
    from: user,
    to: safeTo,
    subject: "Password Akun BPR HIRE Diperbarui",
    text,
    html,
  });
};

export const sendLamaranVerificationEmail = async ({
  toEmail,
  fullName,
  username,
  verificationId,
  lamaranTitle,
  tenagaAhli = "",
  location = "",
  type = "",
  appliedAt = "",
  dashboardUrl = "http://localhost:5173/dashboard",
}) => {
  const safeTo = cleanText(toEmail).toLowerCase();
  const safeFullName = cleanText(fullName) || cleanText(username) || "Peserta";
  const safeUsername = cleanText(username) || "-";
  const safeVerificationId = cleanText(verificationId).toUpperCase();
  const safeLamaranTitle = cleanText(lamaranTitle) || "Lamaran BPR HIRE";
  const safeTenagaAhli = cleanText(tenagaAhli) || "-";
  const safeLocation = cleanText(location) || "-";
  const safeType = cleanText(type) || "-";
  const safeAppliedAt = formatDateTimeId(appliedAt || new Date());
  const safeDashboardUrl = cleanText(dashboardUrl) || "http://localhost:5173/dashboard";
  const { user } = emailConfig();

  if (!isEmailOtpConfigured()) {
    throw new Error("EMAIL_USER atau EMAIL_PASS belum dikonfigurasi.");
  }
  if (!isValidEmailFormat(safeTo)) {
    throw new Error("Email tujuan verifikasi lamaran tidak valid.");
  }
  if (!safeVerificationId) {
    throw new Error("ID verifikasi lamaran tidak valid.");
  }

  const htmlFullName = escapeHtml(safeFullName);
  const htmlUsername = escapeHtml(safeUsername);
  const htmlVerificationId = escapeHtml(safeVerificationId);
  const htmlLamaranTitle = escapeHtml(safeLamaranTitle);
  const htmlTenagaAhli = escapeHtml(safeTenagaAhli);
  const htmlLocation = escapeHtml(safeLocation);
  const htmlType = escapeHtml(safeType);
  const htmlAppliedAt = escapeHtml(safeAppliedAt);
  const htmlDashboardUrl = escapeHtml(safeDashboardUrl);

  const subject = `ID Verifikasi Lamaran - ${safeLamaranTitle}`;
  const text = [
    `Halo ${safeFullName},`,
    "",
    "Lamaran Anda di BPR HIRE berhasil dikirim.",
    "",
    `ID Verifikasi: ${safeVerificationId}`,
    `Posisi: ${safeLamaranTitle}`,
    `Tenaga Ahli: ${safeTenagaAhli}`,
    `Lokasi: ${safeLocation}`,
    `Tipe: ${safeType}`,
    `Waktu melamar: ${safeAppliedAt}`,
    "",
    `Dashboard: ${safeDashboardUrl}`,
    "Simpan ID verifikasi ini untuk pengecekan status lamaran.",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:28px;background:#edf5f1;font-family:Segoe UI,Arial,sans-serif;color:#15304c;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d7e8df;border-radius:18px;overflow:hidden;box-shadow:0 18px 42px rgba(10,61,42,0.14);">
        <div style="padding:26px 28px;background:linear-gradient(135deg,#0b6b43,#18a058);color:#ffffff;">
          <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;opacity:0.9;">BPR HIRE</p>
          <h2 style="margin:0;font-size:25px;line-height:1.25;">Lamaran Berhasil Dikirim</h2>
          <p style="margin:10px 0 0 0;font-size:14px;line-height:1.55;opacity:0.95;">Halo <b>${htmlFullName}</b>, simpan ID verifikasi berikut untuk memantau proses seleksi Anda.</p>
        </div>

        <div style="padding:26px 28px;">
          <div style="margin:0 0 22px 0;padding:18px 18px;border:1px solid #cfe6d8;border-radius:14px;background:#f4fbf7;text-align:center;">
            <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#39775a;text-transform:uppercase;letter-spacing:1px;">ID Verifikasi Lamaran</p>
            <p style="margin:0;font-size:30px;letter-spacing:2.8px;font-weight:800;color:#0b6b43;">${htmlVerificationId}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tbody>
              <tr>
                <td style="padding:9px 0;width:175px;color:#526b83;"><b>Nama peserta</b></td>
                <td style="padding:9px 0;color:#15304c;">${htmlFullName}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#526b83;"><b>Username</b></td>
                <td style="padding:9px 0;color:#15304c;">${htmlUsername}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#526b83;"><b>Posisi lamaran</b></td>
                <td style="padding:9px 0;color:#15304c;">${htmlLamaranTitle}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#526b83;"><b>Tenaga Ahli</b></td>
                <td style="padding:9px 0;color:#15304c;">${htmlTenagaAhli}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#526b83;"><b>Lokasi</b></td>
                <td style="padding:9px 0;color:#15304c;">${htmlLocation}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#526b83;"><b>Tipe</b></td>
                <td style="padding:9px 0;color:#15304c;">${htmlType}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#526b83;"><b>Waktu melamar</b></td>
                <td style="padding:9px 0;color:#15304c;">${htmlAppliedAt}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:22px;padding:14px 16px;border-left:4px solid #18a058;background:#f6fbf8;border-radius:10px;">
            <p style="margin:0;font-size:13px;line-height:1.55;color:#4f6780;">ID verifikasi ini bersifat pribadi. Gunakan ID tersebut saat mengecek status atau ketika diminta oleh pengawas.</p>
          </div>

          <div style="margin-top:22px;">
            <a href="${htmlDashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#0b6b43,#18a058);color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
              Buka Dashboard Lamaran
            </a>
          </div>
          <p style="margin:14px 0 0 0;font-size:13px;color:#5b7288;">Link dashboard: <a href="${htmlDashboardUrl}" target="_blank" rel="noopener noreferrer" style="color:#0b6b43;">${htmlDashboardUrl}</a></p>
        </div>
      </div>
    </div>
  `;

  const transport = getTransporter();
  await transport.sendMail({
    from: user,
    to: safeTo,
    subject,
    text,
    html,
  });
};

export const resolveEmailOtpErrorMessage = (
  error,
  fallback = "Gagal mengirim OTP email."
) => {
  const responseMessage = cleanText(error?.response);
  if (responseMessage) return `${fallback} (${responseMessage})`;
  const code = cleanText(error?.code);
  if (code) return `${fallback} [${code}]`;
  const message = cleanText(error?.message);
  if (message) return `${fallback} (${message})`;
  return fallback;
};
