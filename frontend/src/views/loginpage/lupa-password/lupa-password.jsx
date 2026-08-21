import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  FiCheckCircle,
  FiKey,
  FiLock,
  FiMail,
  FiSend,
  FiShield,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { getAlertThemeConfig } from "../../../utils/alertTheme";
import {
  resetForgotPasswordApi,
  sendForgotPasswordOtpApi,
  verifyForgotPasswordOtpApi,
} from "../../../utils/authApi";
import "./lupa-password.css";

const OTP_EXPIRE_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const STEP_TOTAL = 4;

function cleanText(value) {
  return String(value || "").trim();
}

function isValidEmailFormat(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function formatMsAsMinuteSecond(value) {
  const safeSeconds = Math.max(0, Math.floor(value / 1000));
  const minutePart = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const secondPart = String(safeSeconds % 60).padStart(2, "0");
  return `${minutePart}:${secondPart}`;
}

function getStepMeta(step) {
  switch (step) {
    case "method":
      return { number: 2, label: "Pilih Metode OTP" };
    case "otp":
      return { number: 3, label: "Verifikasi OTP" };
    case "reset":
      return { number: 4, label: "Buat Password Baru" };
    case "identity":
    default:
      return { number: 1, label: "Validasi Email" };
  }
}

function LupaPasswordModal({ open, onClose, onResetSuccess }) {
  const [step, setStep] = useState("identity");
  const [emailInput, setEmailInput] = useState("");
  const [matchedUser, setMatchedUser] = useState(null);
  const [otpSession, setOtpSession] = useState(null);
  const [otpInput, setOtpInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetProofToken, setResetProofToken] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const [timerNow, setTimerNow] = useState(Date.now());

  const isBusy = Boolean(activeAction);
  const isValidatingEmail = activeAction === "validateEmail";
  const isSendingOtp = activeAction === "sendOtp";
  const isVerifyingOtp = activeAction === "verifyOtp";
  const isSavingPassword = activeAction === "resetPassword";

  const stepMeta = useMemo(() => getStepMeta(step), [step]);

  useEffect(() => {
    if (!open) return;
    setStep("identity");
    setEmailInput("");
    setMatchedUser(null);
    setOtpSession(null);
    setOtpInput("");
    setNewPassword("");
    setConfirmPassword("");
    setResetProofToken("");
    setInlineError("");
    setActiveAction("");
    setTimerNow(Date.now());
  }, [open]);

  useEffect(() => {
    if (!open || !otpSession) return undefined;

    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
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

  const sendOtpToRegisteredEmail = async (identity) => {
    const safeIdentity = cleanText(identity).toLowerCase();
    if (!safeIdentity || isBusy) return;

    setActiveAction("sendOtp");
    setInlineError("");

    try {
      const response = await sendForgotPasswordOtpApi(safeIdentity);
      const expiresInMs = Number(response?.expiresInMs || OTP_EXPIRE_MS);

      setMatchedUser((prevUser) => ({
        email: safeIdentity,
        username: String(response?.username || prevUser?.username || "").trim(),
      }));
      setOtpSession({
        method: "email",
        targetLabel: "Email",
        targetMasked: String(response?.maskedEmail || safeIdentity),
        sentAt: Date.now(),
        expiresAt: Date.now() + Math.max(30 * 1000, expiresInMs),
        debugCode: String(response?.debugCode || "").trim(),
      });
      setOtpInput("");
      setResetProofToken("");
      setStep("otp");
      setTimerNow(Date.now());
    } finally {
      setActiveAction("");
    }
  };

  const handleValidateEmail = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    const email = cleanText(emailInput);
    if (!email) {
      setInlineError("Email wajib diisi.");
      return;
    }

    if (!isValidEmailFormat(email)) {
      setInlineError("Format email tidak valid.");
      return;
    }

    setInlineError("");
    setActiveAction("validateEmail");
    try {
      setMatchedUser({
        email,
        username: "",
      });
      setStep("method");
    } finally {
      setActiveAction("");
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    if (!otpSession) {
      setInlineError("OTP belum tersedia. Silakan kirim OTP terlebih dahulu.");
      return;
    }

    if (otpExpiresInMs <= 0) {
      setInlineError("OTP sudah kedaluwarsa. Silakan kirim ulang OTP.");
      return;
    }

    const code = cleanText(otpInput);
    if (!code) {
      setInlineError("Kode OTP wajib diisi.");
      return;
    }

    setInlineError("");
    setActiveAction("verifyOtp");

    try {
      const verifyResult = await verifyForgotPasswordOtpApi(
        matchedUser?.email || emailInput,
        code
      );

      const nextUsername = cleanText(
        verifyResult?.username || matchedUser?.username
      );
      setMatchedUser((prevUser) => ({
        ...(prevUser || {}),
        username: nextUsername,
      }));
      setResetProofToken(cleanText(verifyResult?.resetProofToken));
      setStep("reset");
    } catch (error) {
      setInlineError(
        error instanceof Error
          ? error.message
          : "Kode OTP tidak valid atau sudah kedaluwarsa."
      );
    } finally {
      setActiveAction("");
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    const safeNewPassword = String(newPassword || "");
    const safeConfirmPassword = String(confirmPassword || "");

    if (safeNewPassword.length < 8) {
      setInlineError("Password baru minimal 8 karakter.");
      return;
    }

    if (safeNewPassword !== safeConfirmPassword) {
      setInlineError("Konfirmasi password tidak sama.");
      return;
    }

    if (!resetProofToken) {
      setInlineError("Sesi verifikasi OTP tidak ditemukan. Ulangi proses OTP.");
      return;
    }

    setActiveAction("resetPassword");
    setInlineError("");

    try {
      const resetResult = await resetForgotPasswordApi(
        resetProofToken,
        safeNewPassword
      );

      if (typeof onResetSuccess === "function") {
        onResetSuccess({
          username:
            cleanText(resetResult?.username || matchedUser?.username) ||
            cleanText(emailInput),
          password: safeNewPassword,
        });
      }

      onClose?.();

      const successTheme = getAlertThemeConfig("loginSuccess");
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Password berhasil diperbarui",
        text: "Silakan login dengan password baru Anda.",
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
          : "Gagal memperbarui password."
      );
    } finally {
      setActiveAction("");
    }
  };

  if (!open) return null;

  return (
    <div
      className="bh-forgot-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (isBusy) return;
        onClose?.();
      }}
    >
      <section
        className="bh-forgot-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bh-forgot-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bh-forgot-modal-head">
          <div>
            <p>Pemulihan Akun</p>
            <h2 id="bh-forgot-modal-title">Lupa Password</h2>
            <span className="bh-forgot-step-pill">
              Langkah {stepMeta.number}/{STEP_TOTAL} - {stepMeta.label}
            </span>
          </div>
          <button
            type="button"
            className="bh-forgot-modal-close"
            onClick={() => onClose?.()}
            disabled={isBusy}
            aria-label="Tutup lupa password"
          >
            <FiX />
          </button>
        </header>

        {step === "identity" && (
          <form className="bh-forgot-modal-form" onSubmit={handleValidateEmail}>
            <p className="bh-forgot-modal-caption">
              Masukkan email akun Anda, lalu kirim OTP ke email tersebut.
            </p>
            <label className="bh-forgot-field">
              <span>Email Terdaftar</span>
              <div className="bh-forgot-input-shell">
                <FiMail />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(event) => {
                    setEmailInput(event.target.value);
                    setInlineError("");
                  }}
                  placeholder="Contoh: nama@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            {inlineError && <p className="bh-forgot-error">{inlineError}</p>}

            <div className="bh-forgot-actions">
              <button
                type="button"
                className="bh-forgot-cancel-btn"
                onClick={() => onClose?.()}
                disabled={isBusy}
              >
                Batal
              </button>
              <button
                type="submit"
                className="bh-forgot-submit-btn"
                disabled={isBusy}
              >
                {isValidatingEmail ? "Memvalidasi..." : "Validasi Email"}
              </button>
            </div>
          </form>
        )}

        {step === "method" && (
          <div className="bh-forgot-modal-form">
            <div className="bh-forgot-verified-banner">
              <FiCheckCircle />
              <span>
                Email tervalidasi. Lanjut kirim OTP ke email akun ini.
              </span>
            </div>

            <p className="bh-forgot-modal-caption">
              Metode OTP aktif: <b>Email</b>.
            </p>

            <div className="bh-forgot-method-grid">
              <button
                type="button"
                className="bh-forgot-method-btn"
                onClick={async () => {
                  try {
                    await sendOtpToRegisteredEmail(matchedUser?.email || emailInput);
                  } catch (error) {
                    setInlineError(
                      error instanceof Error
                        ? error.message
                        : "Gagal mengirim OTP email."
                    );
                  }
                }}
                disabled={isBusy}
              >
                <span className="bh-forgot-method-icon">
                  <FiMail />
                </span>
                <span className="bh-forgot-method-copy">
                  <b>{isSendingOtp ? "Mengirim OTP via Email..." : "OTP via Email"}</b>
                  <small>Kode OTP akan dikirim ke email Anda</small>
                </span>
              </button>
            </div>

            {inlineError && <p className="bh-forgot-error">{inlineError}</p>}

            <div className="bh-forgot-actions">
              <button
                type="button"
                className="bh-forgot-cancel-btn"
                onClick={() => {
                  if (isBusy) return;
                  setStep("identity");
                  setInlineError("");
                }}
                disabled={isBusy}
              >
                Ganti Email
              </button>
              <button
                type="button"
                className="bh-forgot-submit-btn"
                onClick={() => onClose?.()}
                disabled={isBusy}
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {step === "otp" && (
          <form className="bh-forgot-modal-form" onSubmit={handleVerifyOtp}>
            <p className="bh-forgot-modal-caption">
              Kode OTP telah dikirim ke {otpSession?.targetLabel?.toLowerCase()}{" "}
              <b>{otpSession?.targetMasked}</b>.
            </p>
            <p className="bh-forgot-otp-meta">
              Berlaku <b>{formatMsAsMinuteSecond(otpExpiresInMs)}</b> | Metode: OTP Email
            </p>
            <p className="bh-forgot-otp-debug">
              {cleanText(otpSession?.debugCode)
                ? `Kode OTP dev: ${otpSession.debugCode}`
                  : "Masukkan kode OTP email yang Anda terima."}
            </p>

            <label className="bh-forgot-field">
              <span>Kode OTP</span>
              <div className="bh-forgot-input-shell">
                <FiMail />
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpInput}
                  onChange={(event) => {
                    setOtpInput(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setInlineError("");
                  }}
                  placeholder="Masukkan 6 digit OTP"
                  required
                />
              </div>
            </label>

            {inlineError && <p className="bh-forgot-error">{inlineError}</p>}

            <div className="bh-forgot-inline-actions">
              <button
                type="button"
                className="bh-forgot-resend-btn"
                onClick={async () => {
                  if (isBusy || resendAvailableInMs > 0) return;
                  try {
                    setInlineError("");
                    await sendOtpToRegisteredEmail(matchedUser?.email || emailInput);
                  } catch (error) {
                    setInlineError(
                      error instanceof Error
                        ? error.message
                        : "Gagal mengirim ulang OTP."
                    );
                  }
                }}
                disabled={isBusy || resendAvailableInMs > 0}
              >
                <FiSend />
                {isSendingOtp
                  ? "Mengirim Ulang..."
                  : resendAvailableInMs > 0
                  ? `Kirim Ulang (${formatMsAsMinuteSecond(resendAvailableInMs)})`
                  : "Kirim Ulang OTP"}
              </button>
            </div>

            <div className="bh-forgot-actions">
              <button
                type="button"
                className="bh-forgot-cancel-btn"
                onClick={() => {
                  if (isBusy) return;
                  setStep("method");
                  setOtpSession(null);
                  setOtpInput("");
                  setInlineError("");
                }}
                disabled={isBusy}
              >
                Kembali
              </button>
              <button
                type="submit"
                className="bh-forgot-submit-btn"
                disabled={isBusy}
              >
                {isVerifyingOtp ? "Memverifikasi..." : "Verifikasi OTP"}
              </button>
            </div>
          </form>
        )}

        {step === "reset" && (
          <form className="bh-forgot-modal-form" onSubmit={handleResetPassword}>
            <p className="bh-forgot-modal-caption">
              OTP berhasil diverifikasi. Buat password baru untuk akun{" "}
              <b>{matchedUser?.username || matchedUser?.email || "-"}</b>.
            </p>

            <label className="bh-forgot-field">
              <span>Password Baru</span>
              <div className="bh-forgot-input-shell">
                <FiLock />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setInlineError("");
                  }}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            <label className="bh-forgot-field">
              <span>Konfirmasi Password Baru</span>
              <div className="bh-forgot-input-shell">
                <FiShield />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setInlineError("");
                  }}
                  placeholder="Ulangi password baru"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            {inlineError && <p className="bh-forgot-error">{inlineError}</p>}

            <div className="bh-forgot-actions">
              <button
                type="button"
                className="bh-forgot-cancel-btn"
                onClick={() => {
                  if (isBusy) return;
                  setStep("identity");
                  setInlineError("");
                }}
                disabled={isBusy}
              >
                Ulangi dari Awal
              </button>
              <button
                type="submit"
                className="bh-forgot-submit-btn"
                disabled={isBusy}
              >
                <FiKey />
                {isSavingPassword ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

LupaPasswordModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onResetSuccess: PropTypes.func,
};

export default LupaPasswordModal;
