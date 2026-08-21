import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads";
const uploadFolderByField = {
  cvfilename: "cv",
  certificatefilename: "sertifikat",
  experienceletterfilename: "surat-pengalaman-kerja",
  ktpfilename: "ktp",
  ijazahfilename: "ijazah",
  buktierror: "reports/error",
  uploadnpwp: "npwp",
  uploadskterakhir: "sk-terakhir",
  fotonib: "nib",
  fotosku: "sku",
  fotonpwp: "npwp",
  fotosiup: "siup",
  fotodepan: "foto-depan",
  slik: "slik",
  slikpenanggungjawab: "slik",
  slik_penanggung_jawab: "slik",
  slikpasangan: "slik",
  slik_pasangan: "slik",
  dokumentasiagunan: "agunan",
  dokumentasiagunansertifikat: "agunan/sertifikat",
  dokumentasiagunanfoto: "agunan/foto",
  dokumentasiagunanstnk: "agunan/stnk",
  dokumentasiagunankendaraan: "agunan/kendaraan",
  dokumentasiagunanbpkb: "agunan/bpkb",
};

const ensureUploadDir = (targetDir) => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
};

const normalizeFieldName = (value) =>
  String(value || "").trim().toLowerCase();

const resolveUploadFolder = (fieldName) => {
  const normalizedField = normalizeFieldName(fieldName);
  const subFolder = uploadFolderByField[normalizedField] || normalizedField || "lainnya";
  return path.join(uploadDir, subFolder);
};

ensureUploadDir(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetDir = resolveUploadFolder(file.fieldname);
    ensureUploadDir(targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Filter hanya gambar atau TXT untuk SLIK (tambahan PDF untuk dokumen instansi/agunan)
const fileFilter = (req, file, cb) => {
  const imageTypes = [".jpg", ".jpeg", ".png"];
  const textTypes = [".txt"];
  const documentTypes = [".pdf"];
  const officeDocumentTypes = [".pdf", ".doc", ".docx"];
  const profileDocumentTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
  const ext = path.extname(file.originalname).toLowerCase();
  const normalizedField = normalizeFieldName(file.fieldname);
  const profileDocumentFields = [
    "cvfilename",
    "certificatefilename",
    "experienceletterfilename",
    "ktpfilename",
    "ijazahfilename",
  ];

  if (profileDocumentFields.includes(normalizedField)) {
    const allowedTypes =
      normalizedField === "ktpfilename"
        ? [...imageTypes, ...documentTypes]
        : profileDocumentTypes;
    if (allowedTypes.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        "Berkas profil hanya boleh berupa PDF, DOC, DOCX, JPG, JPEG, atau PNG"
      ),
      false
    );
    return;
  }

  const isSlikField = [
    "slik",
    "slikpenanggungjawab",
    "slik_penanggung_jawab",
    "slikpasangan",
    "slik_pasangan",
  ].includes(normalizedField);
  if (isSlikField) {
    if (textTypes.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("Hanya file TXT (.txt) yang diperbolehkan untuk SLIK"), false);
    return;
  }

  const mixedAgunanFields = ["dokumentasiAgunan"];
  if (mixedAgunanFields.includes(file.fieldname)) {
    if (imageTypes.includes(ext) || documentTypes.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        "Hanya file gambar (.jpg, .jpeg, .png) atau PDF (.pdf) yang diperbolehkan untuk dokumen agunan"
      ),
      false
    );
    return;
  }

  const pdfAgunanFields = ["dokumentasiAgunanSertifikat"];
  if (pdfAgunanFields.includes(file.fieldname)) {
    if (documentTypes.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(
      new Error("Hanya file PDF (.pdf) yang diperbolehkan untuk dokumen agunan"),
      false
    );
    return;
  }

  const imageAgunanFields = [
    "dokumentasiAgunanFoto",
    "dokumentasiAgunanStnk",
    "dokumentasiAgunanKendaraan",
    "dokumentasiAgunanBpkb",
  ];
  if (imageAgunanFields.includes(file.fieldname)) {
    if (imageTypes.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        "Hanya file gambar (.jpg, .jpeg, .png) yang diperbolehkan untuk dokumentasi agunan"
      ),
      false
    );
    return;
  }

  const mixedDocumentFields = [
    "uploadnpwp",
    "uploadskterakhir",
    "fotonib",
    "fotosku",
    "fotonpwp",
    "fotosiup",
    "fotodepan",
  ];
  if (mixedDocumentFields.includes(normalizedField)) {
    if (imageTypes.includes(ext) || officeDocumentTypes.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        "Hanya file gambar (.jpg, .jpeg, .png) atau PDF (.pdf) yang diperbolehkan"
      ),
      false
    );
    return;
  }

  if (imageTypes.includes(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error("Hanya file gambar (.jpg, .jpeg, .png) yang diperbolehkan"), false);
};

const createUpload = (fileSizeLimit) =>
  multer({
    storage,
    fileFilter,
    limits: { fileSize: fileSizeLimit },
  });

const upload = createUpload(5 * 1024 * 1024);
export const uploadDataUsaha = createUpload(10 * 1024 * 1024);
export const uploadJaminan = createUpload(30 * 1024 * 1024);
export const uploadOCRKTP = createUpload(10 * 1024 * 1024);
export const uploadCamera = createUpload(10 * 1024 * 1024);

export default upload;
