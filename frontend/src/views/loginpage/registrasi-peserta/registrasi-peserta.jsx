import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiLock,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSend,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { getAlertThemeConfig } from "../../../utils/alertTheme";
import {
  registerPesertaApi,
  sendRegisterOtpApi,
} from "../../../utils/authApi";
import "./registrasi-peserta.css";

const OTP_EXPIRE_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const BPR_HIRE_PROFILE_STORAGE_KEY = "bpr-hire-profile-data";

function cleanText(value) {
  return String(value || "").trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value));
}

function normalizePhone(value) {
  const raw = cleanText(value).replace(/[^\d+]/g, "");

  if (raw.startsWith("+")) {
    return `+${raw.slice(1).replace(/\D/g, "")}`;
  }

  const onlyDigits = raw.replace(/\D/g, "");
  if (onlyDigits.startsWith("0")) {
    return `+62${onlyDigits.slice(1)}`;
  }
  if (onlyDigits.startsWith("62")) {
    return `+${onlyDigits}`;
  }
  return `+62${onlyDigits}`;
}

function maskEmail(value) {
  const email = cleanText(value);
  const [local = "", domain = ""] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "*".repeat(Math.max(1, local.length - visible.length));
  return `${visible}${hidden}@${domain}`;
}

function formatMsAsMinuteSecond(value) {
  const seconds = Math.max(0, Math.floor(value / 1000));
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsPart = String(seconds % 60).padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

function getInitialFormState() {
  return {
    fullName: "",
    email: "",
    phone: "",
    username: "",
    address: "",
    password: "",
    confirmPassword: "",
  };
}

function buildValidationError(formValues) {
  const fullName = cleanText(formValues.fullName);
  const email = cleanText(formValues.email);
  const phone = cleanText(formValues.phone);
  const username = cleanText(formValues.username);
  const address = cleanText(formValues.address);
  const password = String(formValues.password || "");
  const confirmPassword = String(formValues.confirmPassword || "");
  const normalizedPhone = normalizePhone(phone);
  const phoneDigitsLength = normalizedPhone.replace(/[^\d]/g, "").length;

  if (fullName.length < 3) {
    return "Nama lengkap minimal 3 karakter.";
  }
  if (!isValidEmail(email)) {
    return "Format email belum valid.";
  }
  if (phoneDigitsLength < 10 || phoneDigitsLength > 16) {
    return "Nomor HP tidak valid. Gunakan 10-16 digit.";
  }
  if (username.length < 4) {
    return "Username peserta minimal 4 karakter.";
  }
  if (address.length < 8) {
    return "Alamat domisili minimal 8 karakter.";
  }
  if (password.length < 8) {
    return "Password minimal 8 karakter.";
  }
  if (password !== confirmPassword) {
    return "Konfirmasi password tidak sama.";
  }

  return "";
}

function RegistrasiPesertaModal({ open, onClose, onRegistered }) {
  const [formValues, setFormValues] = useState(() => getInitialFormState());
  const [otpInput, setOtpInput] = useState("");
  const [otpSession, setOtpSession] = useState(null);
  const [inlineError, setInlineError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    setFormValues(getInitialFormState());
    setOtpInput("");
    setOtpSession(null);
    setInlineError("");
    setIsSendingOtp(false);
    setIsSubmitting(false);
    setTimerNow(Date.now());
  }, [open]);

  useEffect(() => {
    if (!open || !otpSession) return undefined;

    const timerId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [open, otpSession]);

  const otpExpiresInMs = useMemo(() => {
    if (!otpSession) return 0;
    return Math.max(0, otpSession.expiresAt - timerNow);
  }, [otpSession, timerNow]);

  const resendAvailableInMs = useMemo(() => {
    if (!otpSession) return 0;
    return Math.max(0, otpSession.sentAt + OTP_RESEND_COOLDOWN_MS - timerNow);
  }, [otpSession, timerNow]);

  const handleChange = (field, value) => {
    setInlineError("");
    setFormValues((previousValues) => ({
      ...previousValues,
      [field]: value,
    }));
  };

  const handleSendOtp = async () => {
    if (isSendingOtp) return;

    const validationError = buildValidationError(formValues);
    if (validationError) {
      setInlineError(validationError);
      return;
    }

    setInlineError("");
    setIsSendingOtp(true);

    try {
      const response = await sendRegisterOtpApi(cleanText(formValues.email).toLowerCase());
      const expiresInMs = Number(response?.expiresInMs || OTP_EXPIRE_MS);
      setOtpSession({
        maskedEmail: String(
          response?.maskedEmail || maskEmail(cleanText(formValues.email).toLowerCase())
        ),
        sentAt: Date.now(),
        expiresAt: Date.now() + Math.max(30 * 1000, expiresInMs),
        debugCode: String(response?.debugCode || "").trim(),
      });
      setOtpInput("");
      setTimerNow(Date.now());
    } catch (error) {
      setInlineError(
        error instanceof Error ? error.message : "Gagal mengirim OTP email."
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    const validationError = buildValidationError(formValues);
    if (validationError) {
      setInlineError(validationError);
      return;
    }

    if (!otpSession) {
      setInlineError("Silakan kirim OTP ke email terlebih dahulu.");
      return;
    }

    if (otpExpiresInMs <= 0) {
      setInlineError("OTP sudah kedaluwarsa. Silakan kirim ulang OTP.");
      return;
    }

    if (!cleanText(otpInput)) {
      setInlineError("Kode OTP wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setInlineError("");

    try {
      const registeredResult = await registerPesertaApi({
        fullName: formValues.fullName,
        email: formValues.email,
        phone: normalizePhone(formValues.phone),
        address: formValues.address,
        username: formValues.username,
        password: formValues.password,
        otpCode: cleanText(otpInput),
      });
      const registeredUser = registeredResult?.user || {};

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          BPR_HIRE_PROFILE_STORAGE_KEY,
          JSON.stringify({
            fullName: formValues.fullName,
            email: formValues.email,
            phone: normalizePhone(formValues.phone),
            username: formValues.username,
            address: formValues.address,
          })
        );
      }

      if (typeof onRegistered === "function") {
        onRegistered({
          username:
            String(registeredUser.username || formValues.username).trim(),
          password: formValues.password,
          displayName:
            String(registeredUser.fullName || formValues.fullName).trim(),
        });
      }

      onClose?.();

      const successTheme = getAlertThemeConfig("loginSuccess");
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Registrasi peserta berhasil",
        text: "Akun baru siap digunakan untuk login.",
        timer: 2200,
        timerProgressBar: true,
        showConfirmButton: false,
        background: successTheme.background,
        color: successTheme.color,
        iconColor: successTheme.iconColor,
        didOpen: (toast) => {
          toast.style.boxShadow = successTheme.boxShadow;
        },
      });
    } catch (error) {
      setInlineError(
        error instanceof Error
          ? error.message
          : "Terjadi kendala saat registrasi peserta."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="bh-register-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (isSubmitting || isSendingOtp) return;
        onClose?.();
      }}
    >
      <section
        className="bh-register-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bh-register-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bh-register-modal-head">
          <div>
            <p>Role Peserta</p>
            <h2 id="bh-register-modal-title">Daftar Akun Peserta</h2>
          </div>
          <button
            type="button"
            className="bh-register-modal-close"
            onClick={() => onClose?.()}
            disabled={isSubmitting || isSendingOtp}
            aria-label="Tutup registrasi peserta"
          >
            <FiX />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="bh-register-modal-form">
          <div className="bh-register-grid">
            <label className="bh-register-field">
              <span>Nama Lengkap</span>
              <div className="bh-register-input-shell">
                <FiUser />
                <input
                  type="text"
                  value={formValues.fullName}
                  onChange={(event) => handleChange("fullName", event.target.value)}
                  placeholder="Masukkan nama lengkap"
                  autoComplete="name"
                  required
                />
              </div>
            </label>

            <label className="bh-register-field">
              <span>Email</span>
              <div className="bh-register-input-shell">
                <FiMail />
                <input
                  type="email"
                  value={formValues.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="contoh@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="bh-register-field">
              <span>Nomor HP</span>
              <div className="bh-register-input-shell">
                <FiPhone />
                <input
                  type="text"
                  value={formValues.phone}
                  onChange={(event) => handleChange("phone", event.target.value)}
                  placeholder="08xxxxxxxxxx"
                  autoComplete="tel"
                  required
                />
              </div>
            </label>

            <label className="bh-register-field">
              <span>Username Peserta</span>
              <div className="bh-register-input-shell">
                <FiUser />
                <input
                  type="text"
                  value={formValues.username}
                  onChange={(event) =>
                    handleChange("username", event.target.value)
                  }
                  placeholder="Masukkan username"
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="bh-register-field bh-register-field-full">
              <span>Alamat Domisili</span>
              <div className="bh-register-input-shell bh-register-textarea-shell">
                <FiMapPin />
                <textarea
                  value={formValues.address}
                  onChange={(event) => handleChange("address", event.target.value)}
                  placeholder="Masukkan alamat domisili"
                  required
                />
              </div>
            </label>

            <label className="bh-register-field">
              <span>Password</span>
              <div className="bh-register-input-shell">
                <FiLock />
                <input
                  type="password"
                  value={formValues.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            <label className="bh-register-field">
              <span>Konfirmasi Password</span>
              <div className="bh-register-input-shell">
                <FiShield />
                <input
                  type="password"
                  value={formValues.confirmPassword}
                  onChange={(event) =>
                    handleChange("confirmPassword", event.target.value)
                  }
                  placeholder="Ulangi password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>
          </div>

          <section className="bh-register-otp-box">
            <div>
              <h3>Verifikasi OTP Email</h3>
              <p>
                Klik `Kirim OTP` untuk menerima kode verifikasi ke email yang
                didaftarkan.
              </p>
            </div>
            <button
              type="button"
              className="bh-register-otp-send-btn"
              onClick={handleSendOtp}
              disabled={
                isSendingOtp ||
                (otpSession && resendAvailableInMs > 0) ||
                isSubmitting
              }
            >
              <FiSend />
              {isSendingOtp
                ? "Mengirim OTP..."
                : otpSession
                ? resendAvailableInMs > 0
                  ? `Kirim Ulang (${formatMsAsMinuteSecond(resendAvailableInMs)})`
                  : "Kirim Ulang OTP"
                : "Kirim OTP"}
            </button>
          </section>

          {otpSession && (
            <div className="bh-register-otp-input-wrap">
              <p className="bh-register-otp-meta">
                OTP dikirim ke <b>{otpSession.maskedEmail}</b>. Berlaku{" "}
                <b>{formatMsAsMinuteSecond(otpExpiresInMs)}</b>.
              </p>
              <p className="bh-register-otp-debug">
                {cleanText(otpSession?.debugCode)
                  ? `Kode OTP dev: ${otpSession.debugCode}`
                  : "OTP berlaku selama beberapa menit. Pastikan kode dimasukkan sebelum kedaluwarsa."}
              </p>
              <label className="bh-register-field">
                <span>Masukkan Kode OTP</span>
                <div className="bh-register-input-shell">
                  <FiCheckCircle />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otpInput}
                    onChange={(event) =>
                      setOtpInput(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6 digit OTP"
                    required
                  />
                </div>
              </label>
            </div>
          )}

          {inlineError && <p className="bh-register-error">{inlineError}</p>}

          <footer className="bh-register-actions">
            <button
              type="button"
              className="bh-register-cancel-btn"
              onClick={() => onClose?.()}
              disabled={isSubmitting || isSendingOtp}
            >
              Batal
            </button>
            <button
              type="submit"
              className="bh-register-submit-btn"
              disabled={isSubmitting || isSendingOtp || !otpSession}
            >
              {isSubmitting ? "Memverifikasi..." : "Verifikasi & Daftar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default RegistrasiPesertaModal;
