import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiFileText,
  FiShield,
  FiUserCheck,
  FiXCircle,
} from "react-icons/fi";
import Header from "../../../component/header";
import Sidebar from "../../../component/sidebar";
import { getDashboardUser } from "../../../utils/authUser";
import { fetchLamaranApplicationsFromBackend } from "../../../utils/applications";
import {
  buildTrackingRows,
  cleanText,
  formatStageSchedule,
  formatUpdatedAt,
  getParticipantSummary,
  getStageView,
  getTrackingParticipants,
  isStageLocked,
  saveTrackingRows,
} from "./tracking-progress-shared";

function getStageActionConfig(nextStatus) {
  if (nextStatus === "passed") {
    return {
      title: "Tetapkan Lulus?",
      message: "Tahap ini akan ditandai sebagai Lulus.",
      loadingMessage: "Menyimpan status Lulus...",
      successMessage: "Status tahap berhasil diubah menjadi Lulus.",
      confirmButtonColor: "#15803d",
    };
  }

  return {
    title: "Tetapkan Tidak Lulus?",
    message: "Tahap ini akan ditandai sebagai Tidak Lulus.",
    loadingMessage: "Menyimpan status Tidak Lulus...",
    successMessage: "Status tahap berhasil diubah menjadi Tidak Lulus.",
    confirmButtonColor: "#b91c1c",
  };
}

function CekTracking() {
  const navigate = useNavigate();
  const { participantId = "" } = useParams();
  const currentUser = getDashboardUser();

  const [trackingRows, setTrackingRows] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [participantsLoadError, setParticipantsLoadError] = useState("");
  const [hasLoadedParticipants, setHasLoadedParticipants] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadParticipants = async () => {
      setIsLoadingParticipants(true);
      setParticipantsLoadError("");

      try {
        const backendApplications = await fetchLamaranApplicationsFromBackend();
        if (!isMounted) return;

        const participants = getTrackingParticipants(backendApplications);
        setTrackingRows(buildTrackingRows(participants));
        setHasLoadedParticipants(true);
      } catch (error) {
        if (!isMounted) return;

        setTrackingRows([]);
        setHasLoadedParticipants(false);
        setParticipantsLoadError(
          cleanText(error?.message) || "Gagal memuat data peserta dari backend."
        );
      } finally {
        if (isMounted) {
          setIsLoadingParticipants(false);
        }
      }
    };

    loadParticipants();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedParticipants) return;
    saveTrackingRows(trackingRows);
  }, [hasLoadedParticipants, trackingRows]);

  const decodedParticipantId = useMemo(
    () => cleanText(decodeURIComponent(participantId)),
    [participantId]
  );

  const selectedRow = useMemo(() => {
    if (!decodedParticipantId) return null;

    const row = trackingRows.find((item) => item.participantId === decodedParticipantId);
    if (!row) return null;

    return {
      ...row,
      summary: getParticipantSummary(row.stages),
    };
  }, [decodedParticipantId, trackingRows]);

  const updateStageStatus = (stageId, nextStatus) => {
    if (!decodedParticipantId) return;

    setTrackingRows((prevRows) =>
      prevRows.map((row) => {
        if (row.participantId !== decodedParticipantId) return row;

        const stageIndex = row.stages.findIndex((stage) => stage.id === stageId);
        if (stageIndex < 0) return row;

        const nextStages = row.stages.map((stage, index) => {
          if (index === stageIndex) {
            return {
              ...stage,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            };
          }

          if (nextStatus === "failed" && index > stageIndex) {
            return {
              ...stage,
              status: "pending",
              updatedAt: "",
            };
          }

          return stage;
        });

        return {
          ...row,
          stages: nextStages,
        };
      })
    );
  };

  const handleStageStatusAction = async (stage, nextStatus) => {
    const actionConfig = getStageActionConfig(nextStatus);

    const confirmResult = await Swal.fire({
      title: actionConfig.title,
      text: `${stage.title} - ${actionConfig.message}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Pilih",
      cancelButtonText: "Tidak",
      reverseButtons: true,
      confirmButtonColor: actionConfig.confirmButtonColor,
      cancelButtonColor: "#64748b",
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({
      title: "Memproses",
      text: actionConfig.loadingMessage,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    updateStageStatus(stage.id, nextStatus);
    Swal.close();

    await Swal.fire({
      title: "Berhasil",
      text: actionConfig.successMessage,
      icon: "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#1d4ed8",
    });
  };

  const handleOpenCekData = () => {
    if (!selectedRow?.participantId) return;

    navigate(`/pengawas/cek-data/${encodeURIComponent(selectedRow.participantId)}`, {
      state: {
        verificationItem: {
          id: selectedRow.participantId,
          candidate: selectedRow.candidate,
          role: selectedRow.role,
          status: selectedRow.summary.label,
          submittedAt: selectedRow.submittedAt,
          lastUpdate: selectedRow.submittedAt,
          notes:
            "Data peserta dibuka dari Tracking Progress pada tahap Seleksi Administrasi.",
        },
      },
    });
  };

  return (
    <div className="bh-dashboard-shell min-h-screen bg-[#f7fbff] text-[#09275a] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bh-dashboard-sidebar-shell border-b border-[#dfe8f5] bg-white p-4 shadow-[12px_0_40px_rgba(20,57,96,0.05)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Sidebar role="pengawas" />
      </aside>

      <main className="bh-dashboard-main min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-10">
        <Header user={{ ...currentUser, role: "pengawas" }} />

        {(isLoadingParticipants || participantsLoadError) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
              participantsLoadError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {participantsLoadError || "Memuat data peserta dari backend..."}
          </div>
        )}

        {isLoadingParticipants ? (
          <section className="rounded-[10px] border border-dashed border-[#cddbf0] bg-white px-5 py-10 text-center shadow-[0_12px_28px_rgba(21,54,92,0.04)] sm:px-6">
            <FiShield className="mx-auto text-3xl text-[#5b7390]" />
            <p className="mt-3 text-sm text-[#607792]">
              Data tracking peserta sedang dimuat dari backend.
            </p>
          </section>
        ) : !selectedRow ? (
          <section className="rounded-[10px] border border-dashed border-[#cddbf0] bg-white px-5 py-10 text-center shadow-[0_12px_28px_rgba(21,54,92,0.04)] sm:px-6">
            <FiShield className="mx-auto text-3xl text-[#5b7390]" />
            <p className="mt-3 text-sm text-[#607792]">
              Data tracking peserta tidak ditemukan.
            </p>
            <button
              type="button"
              onClick={() => navigate("/pengawas/tracking-progress")}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cddbf0] bg-[#edf5ff] px-4 text-sm font-bold text-[#10315f]"
            >
              <FiArrowLeft />
              Kembali ke Tabel
            </button>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600">Pengawas Rekrutmen</p>
                  <h2 className="mt-2 text-2xl font-bold leading-tight text-[#09275a]">
                    Cek Tracking Peserta
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#506783]">
                    Tentukan hasil setiap tahap seleksi peserta. Jika ada 1 tahap
                    tidak lulus, status peserta otomatis menjadi ditolak.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/pengawas/tracking-progress")}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d6dfed] bg-white px-4 text-sm font-bold text-[#143765]"
                >
                  <FiArrowLeft />
                  Kembali ke Tabel
                </button>
              </div>
            </section>

            <section className="rounded-[10px] border border-[#dfe8f5] bg-white p-5 shadow-[0_12px_28px_rgba(21,54,92,0.06)] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <FiFileText className="text-[#17355e]" />
                    <h3 className="text-lg font-bold text-[#102d5b]">
                      Detail Tracking - {selectedRow.candidate}
                    </h3>
                  </div>
                  <p className="text-xs text-[#607792]">
                    {selectedRow.role} | ID: {selectedRow.participantId}
                  </p>
                </div>
                <span
                  className={`w-max rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedRow.summary.tone}`}
                >
                  {selectedRow.summary.label}
                </span>
              </div>

              <div className="mb-4 grid gap-1 text-xs text-[#506783]">
                <p className="inline-flex items-center gap-1.5">
                  <FiClock />
                  Masuk antrian: {selectedRow.submittedAt}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <FiUserCheck />
                  Progress: {selectedRow.summary.progress}%
                </p>
                <p className="text-[#607792]">{selectedRow.summary.note}</p>
              </div>

              <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#e8edf5]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[#43bd32] to-[#158a3b]"
                  style={{ width: `${selectedRow.summary.progress}%` }}
                />
              </div>

              <div className="grid gap-3">
                {selectedRow.stages.map((stage, stageIndex) => {
                  const stageView = getStageView(selectedRow.stages, stageIndex);
                  const stageSchedule = formatStageSchedule(stage);
                  const locked = isStageLocked(selectedRow.stages, stageIndex);
                  const autoLocked = Boolean(stage.autoLocked);
                  const actionLocked = locked || autoLocked;

                  return (
                    <article
                      key={stage.id}
                      className="rounded-lg border border-[#dbe6f6] bg-[#fbfdff] px-3 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#153a67]">
                            Tahap {stageIndex + 1} - {stage.title}
                          </p>
                          <p className="mt-1 text-xs text-[#607792]">{stage.description}</p>
                          {stageSchedule && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                              <FiClock />
                              {stageSchedule}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-[#7c91a9]">
                            Update: {formatUpdatedAt(stage.updatedAt)}
                          </p>
                        </div>
                        <span
                          className={`w-max rounded-full px-2.5 py-1 text-[11px] font-semibold ${stageView.tone}`}
                        >
                          {stageView.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {stage.id === "administrasi" && (
                          <button
                            type="button"
                            onClick={handleOpenCekData}
                            className="inline-flex items-center gap-1 rounded-md border border-[#c8dbf5] bg-[#ecf5ff] px-3 py-1.5 text-xs font-semibold text-[#17477d]"
                          >
                            <FiFileText />
                            Cek Data...
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStageStatusAction(stage, "passed")}
                          disabled={actionLocked}
                          className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                            stage.status === "passed"
                              ? "border-green-300 bg-green-100 text-green-700"
                              : "border-green-200 bg-green-50 text-green-700"
                          } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500`}
                        >
                          <FiCheck />
                          Lulus
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStageStatusAction(stage, "failed")}
                          disabled={actionLocked}
                          className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                            stage.status === "failed"
                              ? "border-red-300 bg-red-100 text-red-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500`}
                        >
                          <FiXCircle />
                          Tidak Lulus
                        </button>
                      </div>

                      {locked && stage.status === "pending" && (
                        <p className="mt-2 text-[11px] text-[#7b8da5]">
                          Tahap ini bisa dinilai setelah tahap sebelumnya lulus.
                        </p>
                      )}
                      {autoLocked && (
                        <p className="mt-2 text-[11px] text-red-700">
                          Status tahap ini dikunci otomatis oleh kualifikasi biodata.
                          {stage.autoReason ? ` Alasan: ${stage.autoReason}` : ""}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default CekTracking;

