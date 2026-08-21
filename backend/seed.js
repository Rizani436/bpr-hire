import db from "./config/Database.js";
import argon2 from "argon2";
import Users from "./models/UserModel/UserModel.js";
import Cabangkantor from "./models/UserModel/CabangkantorModel.js";
import Pegawai from "./models/UserModel/PegawaiModel.js";
import Lamaran from "./models/main/lamaranModel.js";
import LamaranApplication from "./models/main/lamaranApplicationModel.js";
import UserActivityLog from "./models/UserModel/UserActivityLogModel.js";

async function seed() {
  try {
    console.log("Menghubungkan ke database & menyinkronkan tabel...");
    await db.sync({ alter: { drop: false } });
    console.log("Tabel berhasil disinkronkan.");

    // 1. Seed Cabangkantor
    console.log("Seeding Cabang Kantor...");
    const kantorList = [
      {
        kode_kantor: "KTR-001",
        nama_kantor: "Kantor Pusat BPR",
        longitude: "106.827153",
        latitude: "-6.175392",
        alamatLengkap: "Jl. Jenderal Sudirman No. 1, Jakarta Pusat",
      },
      {
        kode_kantor: "KTR-002",
        nama_kantor: "Kantor Cabang Bandung",
        longitude: "107.609810",
        latitude: "-6.917464",
        alamatLengkap: "Jl. Asia Afrika No. 45, Bandung",
      },
      {
        kode_kantor: "KTR-003",
        nama_kantor: "Kantor Cabang Surabaya",
        longitude: "112.752088",
        latitude: "-7.257472",
        alamatLengkap: "Jl. Pemuda No. 88, Surabaya",
      },
    ];

    for (const item of kantorList) {
      await Cabangkantor.upsert(item);
    }

    // 2. Seed Pegawai
    console.log("Seeding Pegawai...");
    const pegawaiList = [
      {
        No: "PEG-001",
        Nama_Pegawai: "Hendra Wijaya",
        NRP: "19850101001",
        Nama_Jabatan: "Kepala Cabang",
        kode_kantor: "KTR-001",
      },
      {
        No: "PEG-002",
        Nama_Pegawai: "Siti Rahmawati",
        NRP: "19900202002",
        Nama_Jabatan: "HRD & Rekrutmen",
        kode_kantor: "KTR-001",
      },
      {
        No: "PEG-003",
        Nama_Pegawai: "Rian Saputra",
        NRP: "19920303003",
        Nama_Jabatan: "Marketing Manager",
        kode_kantor: "KTR-002",
      },
    ];

    for (const item of pegawaiList) {
      await Pegawai.upsert(item);
    }

    // 3. Seed Users
    console.log("Seeding Users...");
    const hashedPassword = await argon2.hash("Password123!");

    const userAdmin = {
      username: "admin",
      password: hashedPassword,
      role: "superadmin",
      statusUser: "Aktif",
      fullName: "Super Administrator",
      email: "admin@bpr.co.id",
      phone: "081299990001",
      jabatan: "Super Administrator",
      unitKerja: "Kantor Pusat",
      documentReady: true,
    };

    const userPengawas = {
      username: "pengawas",
      password: hashedPassword,
      role: "pengawas",
      statusUser: "Aktif",
      fullName: "Drs. Bambang Pengawas",
      email: "pengawas@bpr.co.id",
      phone: "081299990002",
      jabatan: "Tim Seleksi / Pengawas",
      unitKerja: "Divisi Kepatuhan",
      documentReady: true,
    };

    const userPeserta = {
      username: "peserta",
      password: hashedPassword,
      role: "peserta",
      statusUser: "Aktif",
      fullName: "Ahmad Rizky Pratama",
      email: "ahmad.pratama@gmail.com",
      phone: "081388887777",
      address: "Jl. Melati No. 12, Kebayoran Baru, Jakarta Selatan",
      nik: "3171012304950001",
      birthPlace: "Jakarta",
      birthDate: "1997-05-15",
      gender: "Laki-laki",
      lastEducation: "S1",
      major: "Sistem Informasi",
      institution: "Universitas Indonesia",
      graduationYear: "2020",
      gpa: "3.75",
      mainSkill: "JavaScript, Node.js, React, SQL, Analisis Data",
      computerSkill: "Web Development, Database Management, Excel Expert",
      computerSkillLevel: "Mahir",
      languageSkill: "Indonesia (Aktif), Inggris (Menengah)",
      workExperience: "2 Tahun sebagai Web Developer di PT Tech Solusindo",
      documentReady: true,
    };

    const createdAdmin = (await Users.findOrCreate({ where: { username: userAdmin.username }, defaults: userAdmin }))[0];
    const createdPengawas = (await Users.findOrCreate({ where: { username: userPengawas.username }, defaults: userPengawas }))[0];
    const createdPeserta = (await Users.findOrCreate({ where: { username: userPeserta.username }, defaults: userPeserta }))[0];

    // 4. Seed Lowongan Lamaran
    console.log("Seeding Lowongan Lamaran...");
    const lamaranList = [
      {
        title: "Account Officer (AO) Lending",
        department: "Pemasaran & Kredit",
        location: "Jakarta Pusat",
        type: "Full Time",
        description: "Bertanggung jawab dalam mencari nasabah kredit, melakukan analisis kelayakan usaha, serta menjaga portofolio kredit tetap sehat.",
        summary: "Dibutuhkan profesional muda yang ulet dan komunikatif untuk posisi Account Officer Lending.",
        requirementsJson: JSON.stringify([
          "Pendidikan minimal D3/S1 semua jurusan",
          "Usia maksimal 28 tahun",
          "Memiliki kendaraan pribadi dan SIM C/A",
          "Berorientasi pada target dan mampu bekerja dalam tim",
        ]),
        qualificationsJson: JSON.stringify([
          "Pengalaman di bidang perbankan/BPR lebih diutamakan",
          "Kemampuan negosiasi dan komunikasi yang baik",
        ]),
        pendidikanJson: JSON.stringify(["D3", "S1"]),
        pengalamanJson: JSON.stringify(["Fresh Graduate", "1-2 Tahun"]),
        karakterDibutuhkanJson: JSON.stringify(["Jujur", "Disiplin", "Komunikatif", "Berintegritas"]),
        requiredDocumentsJson: JSON.stringify(["CV", "KTP", "Ijazah", "Transkrip Nilai", "SKCK"]),
        selectionFlow: "berurutan",
        selectionStagesJson: JSON.stringify([
          "Seleksi Administrasi",
          "Tes Tertulis & Psikotes",
          "Wawancara HRD",
          "Wawancara User",
          "Medical Check Up (MCU)",
        ]),
        isActive: true,
        openDate: "2026-08-01",
        closeDate: "2026-09-30",
        createdBy: "admin",
        createdByRole: "superadmin",
      },
      {
        title: "Customer Service & Teller",
        department: "Operasional Pelayanan",
        location: "Bandung",
        type: "Full Time",
        description: "Memberikan pelayanan transaksi tunai dan non-tunai kepada nasabah dengan ramah, akurat, dan profesional.",
        summary: "Posisi frontliner untuk melayani nasabah BPR dengan standar layanan prima.",
        requirementsJson: JSON.stringify([
          "Pendidikan minimal D3/S1 semua jurusan",
          "Tinggi badan minimal: Pria 165 cm, Wanita 158 cm",
          "Berpenampilan menarik dan komunikatif",
        ]),
        qualificationsJson: JSON.stringify([
          "Mampu mengoperasikan komputer (MS Office)",
          "Teliti dan berintegritas tinggi",
        ]),
        pendidikanJson: JSON.stringify(["D3", "S1"]),
        pengalamanJson: JSON.stringify(["Fresh Graduate"]),
        karakterDibutuhkanJson: JSON.stringify(["Ramah", "Teliti", "Rapih", "Sopan"]),
        requiredDocumentsJson: JSON.stringify(["CV", "KTP", "Ijazah", "Foto Full Body"]),
        selectionFlow: "berurutan",
        selectionStagesJson: JSON.stringify([
          "Seleksi Administrasi",
          "Interview Awal",
          "Tes Kemampuan Bidang",
          "Wawancara Final",
        ]),
        isActive: true,
        openDate: "2026-08-10",
        closeDate: "2026-09-15",
        createdBy: "admin",
        createdByRole: "superadmin",
      },
      {
        title: "IT Programmer & Support",
        department: "Teknologi Informasi (IT)",
        location: "Jakarta Pusat",
        type: "Full Time",
        description: "Mengembangkan sistem aplikasi internal BPR, memelihara database, dan melakukan troubleshooting infrastruktur jaringan & sistem.",
        summary: "Bergabung bersama tim IT BPR untuk digitalisasi layanan perbankan.",
        requirementsJson: JSON.stringify([
          "Pendidikan minimal S1 Teknik Informatika / Sistem Informasi",
          "Menguasai JavaScript / Node.js / React / MySQL",
          "Memahami konsep RESTful API dan arsitektur database",
        ]),
        qualificationsJson: JSON.stringify([
          "Pengalaman membuat aplikasi web atau mobile",
          "Familiar dengan Docker dan Git",
        ]),
        pendidikanJson: JSON.stringify(["S1"]),
        pengalamanJson: JSON.stringify(["1-3 Tahun", "Fresh Graduate welcome"]),
        karakterDibutuhkanJson: JSON.stringify(["Problem Solver", "Analytical Thinking", "Cepat Belajar"]),
        requiredDocumentsJson: JSON.stringify(["CV", "Portofolio", "KTP", "Ijazah"]),
        selectionFlow: "berurutan",
        selectionStagesJson: JSON.stringify([
          "Seleksi Administrasi & Portofolio",
          "Live Coding / Technical Test",
          "Wawancara Tim IT",
          "Wawancara Direksi",
        ]),
        isActive: true,
        openDate: "2026-08-01",
        closeDate: "2026-10-31",
        createdBy: "admin",
        createdByRole: "superadmin",
      },
    ];

    const createdLamaranList = [];
    for (const item of lamaranList) {
      let l = await Lamaran.findOne({ where: { title: item.title } });
      if (!l) {
        l = await Lamaran.create(item);
      }
      createdLamaranList.push(l);
    }

    // 5. Seed Lamaran Application (Peserta melamar lowongan)
    if (createdPeserta && createdLamaranList.length > 0) {
      console.log("Seeding Lamaran Application...");
      const targetLamaran = createdLamaranList[2]; // IT Programmer
      const appData = {
        lamaranUUID: targetLamaran.lamaranUUID,
        userUUID: createdPeserta.userUUID,
        verificationId: "VERIF-BPR-202608-001",
        lamaranTitle: targetLamaran.title,
        tenagaAhli: targetLamaran.department,
        applicantName: createdPeserta.fullName,
        applicantUsername: createdPeserta.username,
        applicantEmail: createdPeserta.email,
        status: "Diproses",
        stage: "Seleksi Administrasi & Portofolio",
        appliedAt: new Date(),
        verificationEmailStatus: "sent",
      };

      await LamaranApplication.findOrCreate({
        where: {
          lamaranUUID: targetLamaran.lamaranUUID,
          userUUID: createdPeserta.userUUID,
        },
        defaults: appData,
      });
    }

    // 6. Seed User Activity Log
    console.log("Seeding User Activity Logs...");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await UserActivityLog.create({
      eventType: "access",
      eventLabel: "Login Berhasil ke Sistem",
      routePath: "/login",
      username: "admin",
      userRole: "superadmin",
      targetUsername: "admin",
      targetFullName: "Super Administrator",
      targetUserRole: "superadmin",
      expiresAt: expiresAt,
    });

    console.log("\n==========================================");
    console.log(" SEEDING BERHASIL!");
    console.log("==========================================");
    console.log("Akun yang tersedia (Semua password: Password123!):");
    console.log("1. Superadmin : username = admin");
    console.log("2. Pengawas   : username = pengawas");
    console.log("3. Peserta    : username = peserta");
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("Gagal melakukan seeding data:", error);
    process.exit(1);
  }
}

seed();
