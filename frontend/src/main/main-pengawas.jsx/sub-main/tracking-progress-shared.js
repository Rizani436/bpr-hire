import {
  BPR_HIRE_APPLICATIONS_STORAGE_KEY,
  getDashboardApplications,
} from "../../../utils/applications";
import { getMasterVacancies } from "../../../utils/masterVacancies";

export const TRACKING_PROGRESS_STORAGE_KEY = "bpr-hire-tracking-progress";

const ADMINISTRATION_STAGE = {
  id: "administrasi",
  title: "Seleksi Administrasi",
  description: "Cek kelengkapan biodata dan berkas utama peserta.",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
};

export const SELECTION_STAGES = [
  ADMINISTRATION_STAGE,
];

export function cleanText(value) {
  return String(value || "").trim();
}

export function formatSubmittedAt(value) {
  const text = cleanText(value);
  if (!text) return "-";

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return text;

  return parsedDate.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatUpdatedAt(value) {
  const text = cleanText(value);
  if (!text) return "Belum diperbarui";

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return text;

  return parsedDate.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatStageSchedule(stage = {}) {
  const startDate = cleanText(stage.startDate);
  const endDate = cleanText(stage.endDate);
  const startTime = cleanText(stage.startTime);
  const endTime = cleanText(stage.endTime);

  if (!startDate && !endDate && !startTime && !endTime) {
    return "";
  }

  const dateLabel =
    startDate && endDate
      ? `${startDate} s/d ${endDate}`
      : startDate || endDate || "-";
  const timeLabel =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime || endTime || "-";

  return `Batas waktu: ${dateLabel}, pukul ${timeLabel}`;
}

function extractYear(value) {
  const text = cleanText(value);
  if (!text) return "Tanpa Tahun";

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return String(parsedDate.getFullYear());
  }

  const yearMatch = text.match(/(19|20)\d{2}/);
  return yearMatch ? yearMatch[0] : "Tanpa Tahun";
}

function slugifyStageTitle(value, index) {
  const slug = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `tahap-${index + 1}`;
}

function isAdministrationStage(stage = {}) {
  const normalizedTitle = cleanText(stage?.title || stage)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    normalizedTitle === "administrasi" ||
    normalizedTitle === "seleksiadministrasi" ||
    normalizedTitle === "tahapadministrasi"
  );
}

function normalizeSelectionStages(stages = []) {
  const safeStages = Array.isArray(stages) ? stages : [];
  return safeStages
    .map((stage, index) => {
      const title = cleanText(stage?.title);
      if (!title || isAdministrationStage(stage)) return null;

      return {
        id: slugifyStageTitle(title, index),
        title,
        description:
          cleanText(stage?.description) || "Tahap lanjutan proses seleksi.",
        startDate: cleanText(stage?.startDate),
        endDate: cleanText(stage?.endDate),
        startTime: cleanText(stage?.startTime),
        endTime: cleanText(stage?.endTime),
      };
    })
    .filter(Boolean);
}

function createStageDefinitions(participant = {}) {
  const extraStages = normalizeSelectionStages(participant.selectionStages);
  const flow = cleanText(participant.selectionFlow).toLowerCase();
  const orderedStages = flow === "langsung" ? extraStages.slice(0, 1) : extraStages;
  return [ADMINISTRATION_STAGE, ...orderedStages];
}

function createDefaultStages(stageDefinitions = SELECTION_STAGES) {
  return stageDefinitions.map((stage) => ({
    ...stage,
    status: "pending",
    updatedAt: "",
    autoLocked: false,
    autoReason: "",
  }));
}

function normalizeStageStatus(status) {
  const text = cleanText(status).toLowerCase();
  if (text === "passed") return "passed";
  if (text === "failed") return "failed";
  return "pending";
}

function mergeSavedStages(savedStages, stageDefinitions = SELECTION_STAGES) {
  const savedMap = new Map(
    (Array.isArray(savedStages) ? savedStages : [])
      .filter((stage) => stage && stage.id)
      .map((stage) => [stage.id, stage])
  );

  return stageDefinitions.map((stage) => {
    const savedStage = savedMap.get(stage.id);
    if (!savedStage) {
      return {
        ...stage,
        status: "pending",
        updatedAt: "",
        autoLocked: false,
        autoReason: "",
      };
    }

    return {
      ...stage,
      status: normalizeStageStatus(savedStage.status),
      updatedAt: cleanText(savedStage.updatedAt),
      autoLocked: Boolean(savedStage.autoLocked),
      autoReason: cleanText(savedStage.autoReason),
    };
  });
}

export function loadSavedTrackingRows() {
  if (typeof window === "undefined") return [];

  try {
    const savedRows = JSON.parse(
      window.localStorage.getItem(TRACKING_PROGRESS_STORAGE_KEY)
    );
    return Array.isArray(savedRows) ? savedRows : [];
  } catch {
    return [];
  }
}

export function saveTrackingRows(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRACKING_PROGRESS_STORAGE_KEY, JSON.stringify(rows));
}

export function getTrackingParticipants(applications = []) {
  const masterVacancies = getMasterVacancies();
  const safeApplications = Array.isArray(applications) ? applications : [];
  const applicationsParticipants = safeApplications.map(
    (application, index) => {
      const defaultVerificationId = `VRF-APP-${String(index + 1).padStart(3, "0")}`;
      const participantId = cleanText(application.verificationId || defaultVerificationId);
      const vacancyId = cleanText(application.vacancyId);
      const role = cleanText(application.role) || "Posisi belum ditentukan";
      const matchedVacancy =
        masterVacancies.find((vacancy) => cleanText(vacancy.id) === vacancyId) ||
        masterVacancies.find(
          (vacancy) => cleanText(vacancy.title).toLowerCase() === role.toLowerCase()
        );
      const selectionStages = Array.isArray(application.selectionStages)
        ? application.selectionStages
        : Array.isArray(matchedVacancy?.selectionStages)
          ? matchedVacancy.selectionStages
          : [];

      return {
        id: participantId,
        applicationUUID: cleanText(application.applicationUUID || application.id),
        candidate:
          cleanText(application.candidate) ||
          cleanText(application.applicant?.fullName) ||
          "Peserta",
        role,
        submittedAt: formatSubmittedAt(application.appliedAt),
        year: extractYear(application.appliedAt),
        applicationStatus: cleanText(application.status),
        administrationCheck: application?.administrationCheck || null,
        selectionFlow:
          cleanText(application.selectionFlow || matchedVacancy?.selectionFlow) ||
          "berurutan",
        selectionStages,
      };
    }
  );

  const mergedMap = new Map();
  applicationsParticipants.forEach((participant) => {
    if (!participant.id || mergedMap.has(participant.id)) return;
    mergedMap.set(participant.id, participant);
  });

  return Array.from(mergedMap.values());
}

function applyAutomaticAdministrationResult(stages, participant) {
  const safeStages = Array.isArray(stages) ? [...stages] : [];
  if (safeStages.length === 0) return safeStages;

  const safeStatus = cleanText(participant?.applicationStatus).toLowerCase();
  const administrationCheck = participant?.administrationCheck;
  const failedByStatus = safeStatus.includes("tidak lolos administrasi");
  const failedByCheck = cleanText(administrationCheck?.result).toLowerCase() === "failed";

  if (!failedByStatus && !failedByCheck) {
    return safeStages.map((stage, index) =>
      index === 0
        ? {
            ...stage,
            autoLocked: false,
            autoReason: "",
          }
        : stage
    );
  }

  const failedReasons = Array.isArray(administrationCheck?.failedReasons)
    ? administrationCheck.failedReasons.filter(Boolean)
    : [];
  const autoReason =
    failedReasons.length > 0
      ? failedReasons.join("; ")
      : "Tidak memenuhi kualifikasi biodata otomatis.";
  const checkedAt = cleanText(administrationCheck?.checkedAt);

  return safeStages.map((stage, index) => {
    if (index === 0) {
      return {
        ...stage,
        status: "failed",
        updatedAt: checkedAt || stage.updatedAt || new Date().toISOString(),
        autoLocked: true,
        autoReason,
      };
    }

    return {
      ...stage,
      status: "pending",
      updatedAt: "",
      autoLocked: false,
      autoReason: "",
    };
  });
}

export function buildTrackingRows(participants) {
  const savedRows = loadSavedTrackingRows();
  const savedMap = new Map(
    savedRows
      .filter((row) => row && row.participantId)
      .map((row) => [row.participantId, row])
  );

  return participants.map((participant) => {
    const stageDefinitions = createStageDefinitions(participant);
    const savedRow = savedMap.get(participant.id);
    const baseStages = savedRow
      ? mergeSavedStages(savedRow.stages, stageDefinitions)
      : createDefaultStages(stageDefinitions);
    const stages = applyAutomaticAdministrationResult(baseStages, participant);

    return {
      participantId: participant.id,
      applicationUUID: cleanText(participant.applicationUUID),
      candidate: participant.candidate,
      role: participant.role,
      submittedAt: participant.submittedAt,
      year: participant.year || "Tanpa Tahun",
      stages,
    };
  });
}

function hasFailedBefore(stages, stageIndex) {
  return stages.slice(0, stageIndex).some((stage) => stage.status === "failed");
}

export function isStageLocked(stages, stageIndex) {
  if (stageIndex === 0) return false;
  if (hasFailedBefore(stages, stageIndex)) return true;

  const previousStages = stages.slice(0, stageIndex);
  return previousStages.some((stage) => stage.status !== "passed");
}

export function getStageView(stages, stageIndex) {
  const stage = stages[stageIndex];

  if (stage.status === "passed") {
    return {
      label: "Lulus",
      tone: "bg-green-100 text-green-700",
    };
  }

  if (stage.status === "failed") {
    return {
      label: "Tidak Lulus",
      tone: "bg-red-100 text-red-700",
    };
  }

  if (isStageLocked(stages, stageIndex)) {
    return {
      label: "Menunggu Tahap Sebelumnya",
      tone: "bg-slate-100 text-slate-700",
    };
  }

  return {
    label: "Belum Dinilai",
    tone: "bg-yellow-100 text-yellow-700",
  };
}

export function getParticipantSummary(stages) {
  const passedCount = stages.filter((stage) => stage.status === "passed").length;
  const failedStage = stages.find((stage) => stage.status === "failed");
  const progress = Math.round((passedCount / stages.length) * 100);

  if (failedStage) {
    return {
      label: "Ditolak",
      tone: "bg-red-100 text-red-700",
      progress,
      note: `Gagal di tahap ${failedStage.title}.`,
    };
  }

  if (passedCount === stages.length) {
    return {
      label: "Diterima",
      tone: "bg-green-100 text-green-700",
      progress: 100,
      note: "Peserta lulus seluruh tahapan seleksi.",
    };
  }

  return {
    label: "Diverifikasi",
    tone: "bg-yellow-100 text-yellow-700",
    progress,
    note: `${passedCount} dari ${stages.length} tahap sudah lulus.`,
  };
}

function getFailedStage(stages) {
  return (Array.isArray(stages) ? stages : []).find((stage) => stage.status === "failed");
}

function getFinalResultPayload(row) {
  const stages = Array.isArray(row?.stages) ? row.stages : [];
  const summary = getParticipantSummary(stages);

  if (summary.label === "Diterima") {
    const finalStage = stages[stages.length - 1];
    return {
      status: "Diterima",
      progress: 100,
      stage: cleanText(finalStage?.title) || "Seleksi Administrasi",
      note: summary.note,
    };
  }

  if (summary.label === "Ditolak") {
    const failedStage = getFailedStage(stages);
    return {
      status: "Ditolak",
      progress: Math.max(0, Math.min(99, Number(summary.progress || 0))),
      stage: failedStage
        ? `Ditolak pada ${failedStage.title}`
        : "Ditolak pada Tahap Seleksi",
      note: summary.note,
    };
  }

  return null;
}

export function publishTrackingResultsToParticipants(
  rows,
  publishedBy = "Pengawas"
) {
  if (typeof window === "undefined") {
    return {
      updatedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      eligibleCount: 0,
      missingApplicationCount: 0,
      skippedCount: 0,
    };
  }

  const trackingRows = Array.isArray(rows) ? rows : [];
  const now = new Date().toISOString();
  const currentApplications = getDashboardApplications();

  const finalResultByParticipantId = new Map();
  let eligibleCount = 0;
  let skippedCount = 0;

  trackingRows.forEach((row) => {
    const participantId = cleanText(row?.participantId);
    if (!participantId) return;

    const finalResult = getFinalResultPayload(row);
    if (!finalResult) {
      skippedCount += 1;
      return;
    }

    eligibleCount += 1;
    finalResultByParticipantId.set(participantId, finalResult);
  });

  let updatedCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let matchedCount = 0;

  const nextApplications = currentApplications.map((application) => {
    const verificationId = cleanText(application?.verificationId);
    if (!verificationId) return application;

    const finalResult = finalResultByParticipantId.get(verificationId);
    if (!finalResult) return application;

    matchedCount += 1;
    updatedCount += 1;
    if (finalResult.status === "Diterima") acceptedCount += 1;
    if (finalResult.status === "Ditolak") rejectedCount += 1;

    return {
      ...application,
      status: finalResult.status,
      progress: finalResult.progress,
      stage: finalResult.stage,
      selectionNote: finalResult.note,
      selectionPublishedAt: now,
      selectionPublishedBy: cleanText(publishedBy) || "Pengawas",
    };
  });

  window.localStorage.setItem(
    BPR_HIRE_APPLICATIONS_STORAGE_KEY,
    JSON.stringify(nextApplications)
  );

  return {
    updatedCount,
    acceptedCount,
    rejectedCount,
    eligibleCount,
    missingApplicationCount: Math.max(0, eligibleCount - matchedCount),
    skippedCount,
  };
}
