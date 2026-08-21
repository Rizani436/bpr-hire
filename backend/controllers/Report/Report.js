import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const buildCaption = ({ note, reporter }) => {
  const lines = [
    "Laporan Error",
    `Pelapor: ${reporter.username || "-"}`,
    `Kode Pegawai: ${reporter.kdpegawai || "-"}`,
    `Role: ${reporter.role || "-"}`,
    `Kantor: ${reporter.kdkantor || "-"}`,
    `Waktu: ${new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
    })}`,
    "",
    "Catatan:",
    note || "-",
  ];

  const caption = lines.join("\n");
  if (caption.length <= 1000) return caption;
  return `${caption.slice(0, 990)}...`;
};

export const createErrorReport = async (req, res) => {
  const note = String(req.body?.catatan ?? "").trim();
  const file = req.file;

  if (!note) {
    return res.status(400).json({ msg: "Catatan laporan wajib diisi." });
  }
  if (!file) {
    return res.status(400).json({ msg: "Foto bukti error wajib diupload." });
  }

  const botToken =
    process.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOTREPORT_TOKEN;
  const chatId =
    process.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_CHATREPORT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({
      msg: "Konfigurasi Telegram belum lengkap.",
    });
  }

  const reporter = {
    username: req.username,
    kdpegawai: req.userKdpegawai,
    role: req.role,
    kdkantor: req.kdkantor,
  };

  const caption = buildCaption({ note, reporter });
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("photo", fs.createReadStream(file.path));

    await axios.post(telegramUrl, form, {
      headers: form.getHeaders(),
      timeout: 15000,
    });

    res.status(200).json({ msg: "Laporan berhasil dikirim." });
  } catch (error) {
    console.error("TELEGRAM REPORT ERROR:", error?.response?.data || error);
    res.status(500).json({ msg: "Gagal mengirim laporan ke Telegram." });
  } finally {
    fs.unlink(file.path, () => {});
  }
};
