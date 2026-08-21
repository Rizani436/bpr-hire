import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";

import Index from "./views/loginpage/index";
import Login from "./views/loginpage/loginpage";
import DashboardPeserta from "./main/Dashboard";
import Pendaftaran from "./main/pendaftaran/pendaftaran";
import TahapanSeleksi from "./main/main-peserta/tahapan-seleksi";
import JadwalSaya from "./main/main-peserta/jadwal";
import HasilPengumuman from "./main/main-peserta/hasil-pengumuman";
import DokumenSaya from "./main/main-peserta/dokument-saya";
import DashboardPengawas from "./main/main-pengawas.jsx/Dashboard";
import AntrianVerifikasi from "./main/main-pengawas.jsx/antrian-verifikasi";
import TambahLamaran from "./main/main-pengawas.jsx/tambah-lamaran";
import Seleksi1Biodata from "./main/main-pengawas.jsx/seleksi1-biodata";
import TambahPengumuman from "./main/main-pengawas.jsx/tambah-pengumuman";
import CekData from "./main/main-pengawas.jsx/cek-data";
import TrackingProgress from "./main/main-pengawas.jsx/tracking-progress";
import CekTracking from "./main/main-pengawas.jsx/sub-main/cek-tracking";
import AktivitasRekrutmen from "./main/main-pengawas.jsx/aktivitas-rekrutmen";
import DashboardUserSuperadmin from "./main/main-superadmin/dashboard-user";
import LogsAktivitySuperadmin from "./main/main-superadmin/logs-aktivity";
import KelolaDataSuperadmin from "./main/main-superadmin/kelola-data";
import Profile from "./component/profile";
import Setting from "./component/setting";
import { getDashboardUser } from "./utils/authUser";
import ActivityTracker from "./component/activity-tracker";

function DashboardEntry() {
  const currentUser = getDashboardUser();
  const role = String(currentUser.role || "").toLowerCase();

  if (role === "pengawas") {
    return <DashboardPengawas />;
  }

  if (role === "superadmin") {
    return <DashboardUserSuperadmin />;
  }

  return <DashboardPeserta />;
}

function ProfileEntry() {
  const currentUser = getDashboardUser();
  const role = String(currentUser.role || "").toLowerCase();

  if (role === "pengawas" || role === "superadmin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Profile />;
}




function App() {
  return (
    <Router>
      <ActivityTracker />
      <Routes>
        {/* Login */}
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<DashboardEntry />} />
        <Route path="/dashboard-pengawas" element={<DashboardPengawas />} />
        <Route
          path="/pengawas/antrian-verifikasi"
          element={<AntrianVerifikasi />}
        />
        <Route
          path="/pengawas/master-data/tambah-lamaran"
          element={<TambahLamaran />}
        />
        <Route
          path="/pengawas/master-data/seleksi1-biodata"
          element={<Seleksi1Biodata />}
        />
        <Route
          path="/pengawas/master-data/tambah-pengumuman"
          element={<TambahPengumuman />}
        />
        <Route path="/pengawas/cek-data/:verificationId" element={<CekData />} />
        <Route path="/pengawas/tracking-progress" element={<TrackingProgress />} />
        <Route
          path="/pengawas/tracking-progress/cek/:participantId"
          element={<CekTracking />}
        />
        <Route
          path="/pengawas/aktivitas-rekrutmen"
          element={<AktivitasRekrutmen />}
        />
        <Route
          path="/superadmin/dashboard-user"
          element={<DashboardUserSuperadmin />}
        />
        <Route
          path="/superadmin/logs-activity"
          element={<LogsAktivitySuperadmin />}
        />
        <Route
          path="/superadmin/kelola-data"
          element={<KelolaDataSuperadmin />}
        />
        <Route path="/pendaftaran" element={<Pendaftaran />} />
        <Route path="/tahapan-seleksi" element={<TahapanSeleksi />} />
        <Route path="/jadwal-saya" element={<JadwalSaya />} />
        <Route path="/hasil-pengumuman" element={<HasilPengumuman />} />
        <Route path="/dokumen-saya" element={<DokumenSaya />} />
        <Route path="/profile" element={<ProfileEntry />} />
        <Route path="/setting" element={<Setting />} />
      </Routes>
    </Router>
  );
}

export default App;
