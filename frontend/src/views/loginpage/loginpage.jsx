import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiClock,
  FiEye,
  FiEyeOff,
  FiLock,
  FiShield,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import Swal from "sweetalert2";
import ThemeToggle from "../../component/theme-toggle";
import { buildDashboardUser, saveDashboardUser } from "../../utils/authUser";
import { getAlertThemeConfig } from "../../utils/alertTheme";
import { loginApi } from "../../utils/authApi";
import RegistrasiPesertaModal from "./registrasi-peserta/registrasi-peserta";
import LupaPasswordModal from "./lupa-password/lupa-password";
import "./loginpage.css";

const LOGIN_ANNOUNCEMENT_HINT_KEY = "bpr-hire-show-announcement-login-hint";

const FEATURE_ITEMS = [
  {
    key: "secure",
    icon: FiShield,
    title: "Keamanan Terjaga",
    description: "Perlindungan data pelamar dijalankan dengan standar yang terukur.",
    toneClass: "bh-login-feature-icon--green",
  },
  {
    key: "transparent",
    icon: FiTrendingUp,
    title: "Proses Transparan",
    description: "Tahapan seleksi dilaksanakan secara terbuka, objektif, dan akuntabel.",
    toneClass: "bh-login-feature-icon--blue",
  },
  {
    key: "efficient",
    icon: FiClock,
    title: "Efisien & Terstruktur",
    description: "Sistem terintegrasi mendukung proses rekrutmen yang lebih tertib dan tepat waktu.",
    toneClass: "bh-login-feature-icon--green",
  },
];

function normalizeIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function LoginPage() {
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isLoggingIn) return;

    setLoginError("");

    const normalizedIdentity = normalizeIdentity(identity);
    try {
      setIsLoggingIn(true);
      const loginResult = await loginApi(normalizedIdentity, String(password || ""));
      const accessToken = String(loginResult?.accessToken || "").trim();
      if (!accessToken) {
        throw new Error("Login berhasil, tetapi token akses tidak diterima dari server.");
      }

      const loggedInUser = loginResult?.user || {};
      const identitySource =
        String(loggedInUser.username || loggedInUser.email || normalizedIdentity).trim() ||
        normalizedIdentity;
      const nameSource =
        String(loggedInUser.fullName || loggedInUser.username || identitySource).trim() ||
        identitySource;
      const profileComplete =
        typeof loggedInUser.profileComplete === "boolean"
          ? loggedInUser.profileComplete
          : false;

      const dashboardUserBase = buildDashboardUser(
        nameSource,
        String(loggedInUser.role || "peserta"),
        {
          userUUID: String(loggedInUser.userUUID || "").trim(),
          username: String(loggedInUser.username || "").trim(),
          email: String(loggedInUser.email || "").trim(),
          statusUser: "Aktif",
          loginIdentity: identitySource,
          profileComplete,
        }
      );
      const dashboardUser = {
        ...dashboardUserBase,
        userUUID: String(loggedInUser.userUUID || dashboardUserBase.userUUID || "").trim(),
        username: String(loggedInUser.username || dashboardUserBase.username || "").trim(),
        email: String(loggedInUser.email || dashboardUserBase.email || "").trim(),
        statusUser: String(loggedInUser.statusUser || "Aktif").trim() || "Aktif",
        userName: nameSource,
        loginIdentity: identitySource,
        profileComplete,
      };

      window.localStorage.setItem("accessToken", accessToken);

      saveDashboardUser(dashboardUser);
      if (String(dashboardUser.role || "").toLowerCase() === "peserta") {
        window.sessionStorage.setItem(LOGIN_ANNOUNCEMENT_HINT_KEY, "1");
      } else {
        window.sessionStorage.removeItem(LOGIN_ANNOUNCEMENT_HINT_KEY);
      }

      const loginSuccessTheme = getAlertThemeConfig("loginSuccess");

      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `Selamat datang, ${dashboardUser.userName}!`,
        text: "Login berhasil. Mengarahkan ke dashboard...",
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false,
        background: loginSuccessTheme.background,
        color: loginSuccessTheme.color,
        iconColor: loginSuccessTheme.iconColor,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: (toast) => {
          toast.style.boxShadow = loginSuccessTheme.boxShadow;
        },
      });

      navigate("/dashboard", { state: { user: dashboardUser } });
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Login gagal. Silakan coba lagi."
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegistered = ({ username, password: nextPassword }) => {
    setIdentity(username || "");
    setPassword(nextPassword || "");
    setLoginError("");
    setIsRegisterModalOpen(false);
  };

  const handleResetSuccess = ({ username, password: nextPassword }) => {
    setIdentity(username || "");
    setPassword(nextPassword || "");
    setLoginError("");
    setIsForgotModalOpen(false);
  };

  return (
    <div className="bh-login-page">
      <ThemeToggle className="bh-theme-toggle bh-theme-toggle--login" titlePrefix="Tema Login" />

      <div className="bh-login-deco bh-login-deco-top-dots" />
      <div className="bh-login-deco bh-login-deco-mid-dots" />
      <div className="bh-login-deco bh-login-deco-ring" />
      <div className="bh-login-deco bh-login-deco-wave-green" />
      <div className="bh-login-deco bh-login-deco-wave-blue" />

      <main className="bh-login-main">
        <section className="bh-login-left">
          <img src="/bpr.png" alt="BPR HIRE" className="bh-login-logo" />

          <h1 className="bh-login-title">
            Portal Rekrutmen BPR HIRE
            <br />
            <span className="bh-login-title-line-2">
              untuk Masa Depan <span className="bh-login-title-highlight">PT. BPR NTB (Perseroda)</span>
            </span>
          </h1>

          <p className="bh-login-description">
            BPR HIRE merupakan portal rekrutmen resmi PT. BPR NTB
            (Perseroda) untuk mendukung seleksi kandidat secara transparan,
            efisien, dan profesional.
          </p>

          <div className="bh-login-feature-list">
            {FEATURE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.key} className="bh-login-feature-item">
                  <span className={`bh-login-feature-icon ${item.toneClass}`}>
                    <Icon />
                  </span>
                  <div className="bh-login-feature-copy">
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bh-login-card-wrap">
          <article className="bh-login-card">
            <h2>Masuk ke Akun Anda</h2>
            <p className="bh-login-card-subtitle">
              Silakan masukkan email/username dan password Anda untuk
              melanjutkan.
            </p>
            <p className="bh-login-demo-note">
              Gunakan akun yang sudah terdaftar. Login diproses langsung ke server.
            </p>

            <form className="bh-login-form" onSubmit={handleSubmit}>
              <div className="bh-login-field">
                <label htmlFor="login-identity">Email atau Username</label>
                <div className="bh-login-input-shell">
                  <FiUser className="bh-login-input-icon" />
                  <input
                    id="login-identity"
                    type="text"
                    value={identity}
                    onChange={(event) => {
                      setIdentity(event.target.value);
                      setLoginError("");
                    }}
                    autoComplete="username"
                    placeholder="Masukkan email atau username"
                    required
                  />
                </div>
              </div>

              <div className="bh-login-field">
                <label htmlFor="login-password">Password</label>
                <div className="bh-login-input-shell">
                  <FiLock className="bh-login-input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="bh-login-eye-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label="Tampilkan atau sembunyikan password"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div className="bh-login-meta-row">
                <label className="bh-login-remember">
                  <input type="checkbox" />
                  <span>Ingat saya</span>
                </label>
                <button
                  type="button"
                  className="bh-login-forgot-link"
                  onClick={() => setIsForgotModalOpen(true)}
                >
                  Lupa password?
                </button>
              </div>

              {loginError && <p className="bh-login-error-text">{loginError}</p>}

              <button type="submit" className="bh-login-submit-btn" disabled={isLoggingIn}>
                {isLoggingIn ? "Memproses..." : "Masuk"}
              </button>

              <p className="bh-login-register-copy">
                Belum punya akun?{" "}
                <button
                  type="button"
                  className="bh-login-register-link"
                  onClick={() => setIsRegisterModalOpen(true)}
                >
                  Daftar
                </button>
              </p>
            </form>
          </article>
        </section>
      </main>

      <RegistrasiPesertaModal
        open={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegistered={handleRegistered}
      />

      <LupaPasswordModal
        open={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onResetSuccess={handleResetSuccess}
      />

      <footer className="bh-login-footer">
        <div className="bh-login-footer-inner">
          <p>(c) 2026 PT. BPR NTB (Perseroda). All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LoginPage;
