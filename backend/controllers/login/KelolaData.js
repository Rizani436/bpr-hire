import { Op } from "sequelize";
import XLSX from "xlsx";
import Cabangkantor from "../../models/UserModel/CabangkantorModel.js";
import Pegawai from "../../models/UserModel/PegawaiModel.js";

const cleanText = (value) => String(value ?? "").trim();
const normalizeKey = (value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const mapRowByNormalizedKey = (row) => {
  const map = new Map();
  Object.entries(row || {}).forEach(([key, value]) => {
    map.set(normalizeKey(key), value);
  });
  return map;
};

const pickRowValue = (rowMap, aliases = []) => {
  for (const alias of aliases) {
    const value = cleanText(rowMap.get(normalizeKey(alias)));
    if (value) return value;
  }
  return "";
};

const readExcelRowsFromUpload = (file) => {
  const fileBuffer = file?.buffer;
  if (!fileBuffer) return [];

  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) return [];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) return [];

  return XLSX.utils.sheet_to_json(firstSheet, {
    defval: "",
    raw: false,
  });
};

const formatCabangKantorRow = (row) => ({
  kodeKantor: cleanText(row?.kode_kantor),
  namaKantor: cleanText(row?.nama_kantor),
  longitude: cleanText(row?.longitude),
  latitude: cleanText(row?.latitude),
  alamatLengkap: cleanText(row?.alamatLengkap),
  createdAt: row?.createdAt,
  updatedAt: row?.updatedAt,
});

const formatPegawaiRow = (row) => {
  const cabang =
    row?.Cabangkantor ||
    row?.cabangkantor ||
    row?.dataValues?.Cabangkantor ||
    row?.dataValues?.cabangkantor ||
    null;

  return {
    kodePegawai: cleanText(row?.No),
    namaPegawai: cleanText(row?.Nama_Pegawai),
    jabatan: cleanText(row?.Nama_Jabatan) || "Pegawai",
    kodeKantor: cleanText(row?.kode_kantor),
    namaUnitKerja: cleanText(cabang?.nama_kantor),
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt,
  };
};

export const getUnitKerjaRows = async (_req, res) => {
  try {
    const rows = await Cabangkantor.findAll({
      order: [
        ["nama_kantor", "ASC"],
        ["kode_kantor", "ASC"],
      ],
    });

    return res.json({
      total: rows.length,
      rows: rows.map((row) => formatCabangKantorRow(row)),
    });
  } catch (error) {
    console.error("getUnitKerjaRows error:", error);
    return res.status(500).json({ msg: "Gagal mengambil data unit kerja." });
  }
};

export const importUnitKerjaExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "File Excel wajib diunggah." });
    }
    const fileName = cleanText(req.file?.originalname).toLowerCase();
    if (!(fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))) {
      return res.status(400).json({
        msg: "Format file tidak valid. Gunakan Excel (.xlsx/.xls).",
      });
    }

    const rows = readExcelRowsFromUpload(req.file);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        msg: "Data Excel unit kerja kosong atau format tidak terbaca.",
      });
    }

    let imported = 0;
    let skipped = 0;
    const skippedRows = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rowMap = mapRowByNormalizedKey(rows[index]);
      const kodeKantor = pickRowValue(rowMap, [
        "kode_kantor",
        "kodekantor",
        "kode kantor",
        "kode unit kerja",
        "kode",
      ]);
      const namaKantor = pickRowValue(rowMap, [
        "nama_kantor",
        "namakantor",
        "nama kantor",
        "unit kerja",
        "nama unit kerja",
      ]);
      const longitude =
        pickRowValue(rowMap, ["longitude", "long", "lng"]) || "0.0";
      const latitude =
        pickRowValue(rowMap, ["latitude", "lat"]) || "0.0";
      const alamatLengkap =
        pickRowValue(rowMap, [
          "alamatLengkap",
          "alamat lengkap",
          "alamat kantor",
          "alamatkantor",
          "alamat",
        ]) ||
        "-";

      if (!kodeKantor || !namaKantor) {
        skipped += 1;
        skippedRows.push({
          rowNumber: index + 2,
          reason: "Kode kantor / nama kantor tidak lengkap.",
        });
        continue;
      }

      await Cabangkantor.upsert({
        kode_kantor: kodeKantor,
        nama_kantor: namaKantor,
        longitude,
        latitude,
        alamatLengkap,
      });
      imported += 1;
    }

    return res.json({
      msg: `Import unit kerja selesai. Berhasil: ${imported}, dilewati: ${skipped}.`,
      imported,
      skipped,
      skippedRows,
    });
  } catch (error) {
    console.error("importUnitKerjaExcel error:", error);
    return res.status(500).json({ msg: "Gagal import Excel unit kerja." });
  }
};

export const getPegawaiRows = async (req, res) => {
  try {
    const search = cleanText(req.query?.search);
    const where = {};
    if (search) {
      where[Op.or] = [
        { No: { [Op.like]: `%${search}%` } },
        { Nama_Pegawai: { [Op.like]: `%${search}%` } },
        { Nama_Jabatan: { [Op.like]: `%${search}%` } },
        { kode_kantor: { [Op.like]: `%${search}%` } },
      ];
    }

    const rows = await Pegawai.findAll({
      where,
      include: [
        {
          model: Cabangkantor,
          attributes: ["kode_kantor", "nama_kantor"],
        },
      ],
      order: [
        ["Nama_Pegawai", "ASC"],
        ["No", "ASC"],
      ],
    });

    return res.json({
      total: rows.length,
      rows: rows.map((row) => formatPegawaiRow(row)),
    });
  } catch (error) {
    console.error("getPegawaiRows error:", error);
    return res.status(500).json({ msg: "Gagal mengambil data pegawai." });
  }
};

export const getPegawaiLookup = async (req, res) => {
  try {
    const search = cleanText(req.query?.search);
    const limitRaw = Number(req.query?.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, Math.trunc(limitRaw))) : 500;

    const where = {};
    if (search) {
      where[Op.or] = [
        { No: { [Op.like]: `%${search}%` } },
        { Nama_Pegawai: { [Op.like]: `%${search}%` } },
        { Nama_Jabatan: { [Op.like]: `%${search}%` } },
        { kode_kantor: { [Op.like]: `%${search}%` } },
      ];
    }

    const rows = await Pegawai.findAll({
      where,
      include: [
        {
          model: Cabangkantor,
          attributes: ["kode_kantor", "nama_kantor"],
        },
      ],
      order: [
        ["Nama_Pegawai", "ASC"],
        ["No", "ASC"],
      ],
      limit,
    });

    return res.json({
      total: rows.length,
      rows: rows.map((row) => formatPegawaiRow(row)),
    });
  } catch (error) {
    console.error("getPegawaiLookup error:", error);
    return res.status(500).json({ msg: "Gagal mengambil lookup data pegawai." });
  }
};

export const importPegawaiExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "File Excel wajib diunggah." });
    }
    const fileName = cleanText(req.file?.originalname).toLowerCase();
    if (!(fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))) {
      return res.status(400).json({
        msg: "Format file tidak valid. Gunakan Excel (.xlsx/.xls).",
      });
    }

    const rows = readExcelRowsFromUpload(req.file);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        msg: "Data Excel pegawai kosong atau format tidak terbaca.",
      });
    }

    const unitKerjaRows = await Cabangkantor.findAll({
      attributes: ["kode_kantor"],
    });
    const knownUnitKerja = new Set(
      unitKerjaRows.map((item) => cleanText(item.kode_kantor)).filter(Boolean)
    );

    let imported = 0;
    let skipped = 0;
    const skippedRows = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rowMap = mapRowByNormalizedKey(rows[index]);
      const kodePegawai = pickRowValue(rowMap, [
        "kodepegawai",
        "kode_pegawai",
        "kode pegawai",
        "no",
        "nrp",
      ]);
      const namaPegawai = pickRowValue(rowMap, [
        "namapegawai",
        "nama_pegawai",
        "nama pegawai",
        "nama",
        "pegawai",
      ]);
      const kodeKantor = pickRowValue(rowMap, [
        "kodekantor",
        "kode_kantor",
        "kode kantor",
        "kodeunitkerja",
      ]);
      const jabatan =
        pickRowValue(rowMap, [
          "jabatan",
          "nama_jabatan",
          "namajabatan",
          "nama jabatan",
        ]) || "Pegawai";

      if (!kodePegawai || !namaPegawai || !kodeKantor) {
        skipped += 1;
        skippedRows.push({
          rowNumber: index + 2,
          reason: "Kode pegawai / nama pegawai / kode kantor tidak lengkap.",
        });
        continue;
      }

      if (!knownUnitKerja.has(kodeKantor)) {
        skipped += 1;
        skippedRows.push({
          rowNumber: index + 2,
          reason: `Kode kantor ${kodeKantor} tidak ditemukan di data unit kerja.`,
        });
        continue;
      }

      await Pegawai.upsert({
        No: kodePegawai,
        Nama_Pegawai: namaPegawai,
        NRP: kodePegawai,
        Nama_Jabatan: jabatan,
        kode_kantor: kodeKantor,
      });
      imported += 1;
    }

    return res.json({
      msg: `Import pegawai selesai. Berhasil: ${imported}, dilewati: ${skipped}.`,
      imported,
      skipped,
      skippedRows,
    });
  } catch (error) {
    console.error("importPegawaiExcel error:", error);
    return res.status(500).json({ msg: "Gagal import Excel pegawai." });
  }
};
