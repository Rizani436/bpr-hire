import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowRight,
  FiAward,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLock,
  FiMail,
  FiMapPin,
  FiMenu,
  FiPhone,
  FiSend,
  FiShield,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  getMasterVacancies,
  getVacancyOpenStatus,
} from "../../utils/masterVacancies";
import ThemeToggle from "../../component/theme-toggle";

const NAV_ITEMS = [
  { label: "Beranda", href: "#beranda", active: true },
  { label: "Tentang Kami", href: "#tentang-kami" },
  { label: "Keunggulan", href: "#keunggulan" },
  { label: "Persyaratan", action: "requirements" },
  { label: "Kontak", href: "#kontak" },
];

const VALUE_CARDS = [
  {
    icon: FiUsers,
    title: "Talenta Berkualitas",
    description: "Terbuka bagi kandidat yang memenuhi kualifikasi posisi.",
    tone: "value-card--green",
  },
  {
    icon: FiAward,
    title: "Seleksi Transparan",
    description: "Setiap tahapan rekrutmen disusun dengan proses yang jelas dan terukur.",
    tone: "value-card--blue",
  },
  {
    icon: FiTrendingUp,
    title: "Pengembangan Karier",
    description: "Mendukung kebutuhan SDM PT. BPR NTB (Perseroda) secara berkelanjutan.",
    tone: "value-card--green",
  },
  {
    icon: FiShield,
    title: "Keamanan Data",
    description: "Pengelolaan data pelamar dilakukan dengan standar keamanan yang terjaga.",
    tone: "value-card--blue",
  },
];

const ABOUT_POINTS = [
  {
    icon: FiUsers,
    title: "Sistem Terintegrasi",
    description: "Seluruh alur rekrutmen dikelola dalam satu platform resmi.",
  },
  {
    icon: FiClock,
    title: "Proses Efisien",
    description: "Administrasi dan evaluasi berlangsung lebih ringkas, tepat, dan terstruktur.",
  },
  {
    icon: FiLock,
    title: "Kerahasiaan Data",
    description: "Informasi pelamar diproses sesuai prinsip keamanan dan akuntabilitas.",
  },
];

const HERO_FLOATING = [
  {
    icon: FiUsers,
    title: "Talenta",
    subtitle: "Terbaik",
    className: "hero-chip hero-chip--talenta",
  },
  {
    icon: FiShield,
    title: "Sistem",
    subtitle: "Aman",
    className: "hero-chip hero-chip--aman",
  },
  {
    icon: FiTrendingUp,
    title: "Proses",
    subtitle: "Efisien",
    className: "hero-chip hero-chip--efisien",
  },
  {
    icon: FiUsers,
    title: "Seleksi",
    subtitle: "Transparan",
    className: "hero-chip hero-chip--transparan",
  },
];

const FOOTER_LINKS_LEFT = ["Tentang Kami", "Keunggulan"];
const FOOTER_LINKS_RIGHT = ["Karir", "Kontak"];
const MAX_VISIBLE_REQUIREMENT_LAYERS = 3;

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStatusPresentation(status) {
  if (status === "open") return "Aktif";
  if (status === "scheduled") return "Terjadwal";
  if (status === "expired") return "Berakhir";
  return "Nonaktif";
}

function normalizeSelectionFlow(value) {
  return cleanText(value).toLowerCase() === "langsung" ? "langsung" : "berurutan";
}

function NavMenu({ onClick, onRequirementsClick }) {
  return (
    <>
      {NAV_ITEMS.map((item) =>
        item.action === "requirements" ? (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              onClick?.();
              onRequirementsClick?.();
            }}
            className="nav-item nav-item-button"
          >
            {item.label}
          </button>
        ) : (
          <a
            key={item.label}
            href={item.href}
            onClick={onClick}
            className={`nav-item ${item.active ? "nav-item--active" : ""}`}
          >
            {item.label}
          </a>
        )
      )}
    </>
  );
}

function MainPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [requirementLayerStartIndex, setRequirementLayerStartIndex] = useState(0);
  const [masterVacancies, setMasterVacancies] = useState(() => getMasterVacancies());

  useEffect(() => {
    const refreshVacancies = () => {
      setMasterVacancies(getMasterVacancies());
    };

    window.addEventListener("focus", refreshVacancies);
    window.addEventListener("storage", refreshVacancies);

    return () => {
      window.removeEventListener("focus", refreshVacancies);
      window.removeEventListener("storage", refreshVacancies);
    };
  }, []);

  const requirementLayerOptions = useMemo(() => {
    if (!Array.isArray(masterVacancies) || masterVacancies.length === 0) {
      return [];
    }

    return masterVacancies.map((vacancy) => ({
      title: cleanText(vacancy.title) || "Posisi",
      department: cleanText(vacancy.department) || "Departemen",
      location: cleanText(vacancy.location) || "Lokasi",
      type: cleanText(vacancy.type) || "Full Time",
      description:
        cleanText(vacancy.description) ||
        "Informasi posisi belum dilengkapi.",
      icon: FiBriefcase,
      summary:
        cleanText(vacancy.summary) ||
        cleanText(vacancy.description) ||
        "Ringkasan tugas belum dilengkapi.",
      requirements:
        Array.isArray(vacancy.requirements) && vacancy.requirements.length > 0
          ? vacancy.requirements
          : [],
      qualifications:
        Array.isArray(vacancy.qualifications) && vacancy.qualifications.length > 0
          ? vacancy.qualifications
          : [],
      requiredDocuments:
        Array.isArray(vacancy.requiredDocuments) &&
        vacancy.requiredDocuments.length > 0
          ? vacancy.requiredDocuments
          : [],
      selectionStages:
        Array.isArray(vacancy.selectionStages) &&
        vacancy.selectionStages.length > 0
          ? vacancy.selectionStages
          : [],
      selectionFlow: normalizeSelectionFlow(vacancy.selectionFlow),
      statusLabel: normalizeStatusPresentation(getVacancyOpenStatus(vacancy)),
    }));
  }, [masterVacancies]);

  const maxRequirementLayerStartIndex = Math.max(
    0,
    requirementLayerOptions.length - MAX_VISIBLE_REQUIREMENT_LAYERS
  );
  const visibleRequirementLayers = requirementLayerOptions.slice(
    requirementLayerStartIndex,
    requirementLayerStartIndex + MAX_VISIBLE_REQUIREMENT_LAYERS
  );
  const canSlidePrevLayer = requirementLayerStartIndex > 0;
  const canSlideNextLayer = requirementLayerStartIndex < maxRequirementLayerStartIndex;
  const visibleLayerStartNumber =
    requirementLayerOptions.length === 0 ? 0 : requirementLayerStartIndex + 1;
  const visibleLayerEndNumber =
    requirementLayerOptions.length === 0
      ? 0
      : Math.min(
          requirementLayerStartIndex + MAX_VISIBLE_REQUIREMENT_LAYERS,
          requirementLayerOptions.length
        );

  useEffect(() => {
    setRequirementLayerStartIndex((previousIndex) =>
      Math.min(previousIndex, maxRequirementLayerStartIndex)
    );
  }, [maxRequirementLayerStartIndex]);

  const openRequirementsPopup = () => {
    setRequirementLayerStartIndex(0);
    setRequirementsOpen(true);
  };

  const handleSlideRequirementLayer = (direction) => {
    setRequirementLayerStartIndex((previousIndex) => {
      if (direction === "prev") {
        return Math.max(0, previousIndex - 1);
      }

      return Math.min(maxRequirementLayerStartIndex, previousIndex + 1);
    });
  };

  const openRequirementDetail = (layer) => {
    setRequirementsOpen(false);
    setSelectedRequirement(layer);
  };

  return (
    <div className="main-page">
      <header className="site-header">
        <div className="layout header-inner">
          <a href="#beranda" className="brand-link">
            <img src="/bpr.png" alt="BPR HIRE" className="brand-logo" />
          </a>

          <nav className="desktop-nav" aria-label="Navigasi utama">
            <NavMenu onRequirementsClick={openRequirementsPopup} />
          </nav>

          <div className="header-actions">
            <ThemeToggle
              className="bh-theme-toggle main-theme-toggle"
              titlePrefix="Tema Main Page"
            />
            <Link to="/login" className="header-cta desktop-cta">
              More / Login
              <FiArrowRight className="header-cta-icon" />
            </Link>

            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="mobile-nav-wrap">
            <div className="layout mobile-nav">
              <NavMenu
                onClick={() => setMobileOpen(false)}
                onRequirementsClick={openRequirementsPopup}
              />
              <Link
                to="/login"
                className="header-cta"
                onClick={() => setMobileOpen(false)}
              >
                More / Login
                <FiArrowRight className="header-cta-icon" />
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {requirementsOpen ? (
        <div
          className="requirements-popup-backdrop"
          role="presentation"
          onClick={() => setRequirementsOpen(false)}
        >
          <section
            className="requirements-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="requirements-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="requirements-popup-head">
              <div>
                <p>Persyaratan</p>
                <h2 id="requirements-popup-title">Pilih Layer Posisi</h2>
              </div>
              <button
                type="button"
                className="requirements-popup-close"
                onClick={() => setRequirementsOpen(false)}
                aria-label="Tutup popup persyaratan"
              >
                <FiX />
              </button>
            </div>

            <div className="requirements-layer-toolbar">
              <p className="requirements-layer-counter">
                Menampilkan {visibleLayerStartNumber}-{visibleLayerEndNumber} dari{" "}
                {requirementLayerOptions.length} layer
              </p>
              {requirementLayerOptions.length > MAX_VISIBLE_REQUIREMENT_LAYERS ? (
                <div className="requirements-layer-nav-buttons">
                  <button
                    type="button"
                    className="requirements-layer-nav-button"
                    onClick={() => handleSlideRequirementLayer("prev")}
                    disabled={!canSlidePrevLayer}
                    aria-label="Geser layer sebelumnya"
                  >
                    <FiArrowLeft />
                  </button>
                  <button
                    type="button"
                    className="requirements-layer-nav-button"
                    onClick={() => handleSlideRequirementLayer("next")}
                    disabled={!canSlideNextLayer}
                    aria-label="Geser layer berikutnya"
                  >
                    <FiArrowRight />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="requirements-layer-grid">
              {visibleRequirementLayers.length > 0 ? (
                visibleRequirementLayers.map((layer) => {
                  const Icon = layer.icon;
                  return (
                    <article key={layer.title} className="requirements-layer-card">
                      <span className="requirements-layer-icon">
                        <Icon />
                      </span>
                      <h3>{layer.title}</h3>
                      <p>{layer.description}</p>
                      <button
                        type="button"
                        className="requirements-layer-detail"
                        onClick={() => openRequirementDetail(layer)}
                      >
                        Detail
                      </button>
                    </article>
                  );
                })
              ) : (
                <article className="requirements-layer-card">
                  <h3>Belum Ada Lamaran</h3>
                  <p>Lamaran akan tampil setelah dipublikasikan oleh pengawas.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {selectedRequirement ? (
        <div
          className="position-detail-backdrop"
          role="presentation"
          onClick={() => setSelectedRequirement(null)}
        >
          <section
            className="position-detail-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="position-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="position-detail-close"
              onClick={() => setSelectedRequirement(null)}
              aria-label="Tutup detail persyaratan"
            >
              <FiX />
            </button>

            <div className="position-detail-header">
              <span className="position-detail-main-icon">
                <FiBriefcase />
              </span>
              <div className="position-detail-title-wrap">
                <p>Informasi Posisi</p>
                <div className="position-detail-title-row">
                  <h2 id="position-detail-title">{selectedRequirement.title}</h2>
                  <span>{selectedRequirement.statusLabel || "Aktif"}</span>
                </div>
              </div>
            </div>

            <div className="position-detail-summary">
              <p>{selectedRequirement.summary}</p>
              <aside className="position-detail-brief">
                <h3>Detail Singkat</h3>
                <dl>
                  <div>
                    <dt>Departemen</dt>
                    <dd>
                      <FiBriefcase />
                      {selectedRequirement.department}
                    </dd>
                  </div>
                  <div>
                    <dt>Lokasi</dt>
                    <dd>
                      <FiMapPin />
                      {selectedRequirement.location}
                    </dd>
                  </div>
                  <div>
                    <dt>Tipe Pekerjaan</dt>
                    <dd>
                      <FiClock />
                      {selectedRequirement.type}
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>

            <div className="position-detail-grid">
              <article className="position-detail-section">
                <div className="position-detail-section-head position-detail-section-head--green">
                  <span>
                    <FiFileText />
                  </span>
                  <h3>Persyaratan Umum</h3>
                </div>
                <ul>
                  {selectedRequirement.requirements.length === 0 ? (
                    <li>
                      <FiClock />
                      <span>Persyaratan belum diatur.</span>
                    </li>
                  ) : (
                    selectedRequirement.requirements.map((item) => (
                      <li key={item}>
                        <FiCheckCircle />
                        <span>{item}</span>
                      </li>
                    ))
                  )}
                </ul>
              </article>

              <article className="position-detail-section">
                <div className="position-detail-section-head position-detail-section-head--blue">
                  <span>
                    <FiUserCheck />
                  </span>
                  <h3>Kualifikasi</h3>
                </div>
                <ul>
                  {selectedRequirement.qualifications.length === 0 ? (
                    <li>
                      <FiClock />
                      <span>Kualifikasi belum diatur.</span>
                    </li>
                  ) : (
                    selectedRequirement.qualifications.map((item) => (
                      <li key={item}>
                        <FiCheckCircle />
                        <span>{item}</span>
                      </li>
                    ))
                  )}
                </ul>
              </article>

              <article className="position-detail-section">
                <div className="position-detail-section-head position-detail-section-head--purple">
                  <span>
                    <FiFileText />
                  </span>
                  <h3>Dokumen yang Diperlukan</h3>
                </div>
                <ul>
                  {selectedRequirement.requiredDocuments.length === 0 ? (
                    <li>
                      <FiClock />
                      <span>Dokumen persyaratan belum diatur.</span>
                    </li>
                  ) : (
                    selectedRequirement.requiredDocuments.map((item) => (
                      <li key={item}>
                        <FiCheckCircle />
                        <span>{item}</span>
                      </li>
                    ))
                  )}
                </ul>
              </article>

              <article className="position-detail-section">
                <div className="position-detail-section-head position-detail-section-head--orange">
                  <span>
                    <FiTrendingUp />
                  </span>
                  <h3>
                    Tahapan Seleksi Lanjutan{" "}
                    {selectedRequirement.selectionFlow === "langsung"
                      ? "(Langsung)"
                      : "(Berurutan)"}
                  </h3>
                </div>
                <div className="position-detail-steps">
                  {selectedRequirement.selectionStages.length === 0 ? (
                    <div className="position-detail-step">
                      <span>1</span>
                      <div>
                        <h4>Belum ada tahap lanjutan</h4>
                        <p>Tahap Administrasi tetap menjadi tahap pertama secara otomatis.</p>
                      </div>
                    </div>
                  ) : (
                    selectedRequirement.selectionStages.map((stage, index) => (
                      <div
                        key={cleanText(stage.title) || `stage-${index + 1}`}
                        className="position-detail-step"
                      >
                        <span>{index + 1}</span>
                        <div>
                          <h4>{stage.title}</h4>
                          <p>{stage.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>

            <div className="position-detail-footer">
              <p>Informasi lebih lanjut dapat menghubungi tim rekrutmen PT. BPR NTB (Perseroda) melalui menu Kontak.</p>
              <button type="button" onClick={() => setSelectedRequirement(null)}>
                Tutup
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <main>
        <section id="beranda" className="hero-section">
          <div className="hero-noise hero-noise--one" />
          <div className="hero-noise hero-noise--two" />
          <div className="layout hero-layout">
            <div className="hero-copy">
              <span className="hero-badge">BPR HIRE</span>
              <h1 className="hero-title">
                Temukan Peluang.
                <span>Wujudkan Potensi.</span>
              </h1>
              <p className="hero-text">
                BPR HIRE merupakan platform rekrutmen resmi PT. BPR NTB
                (Perseroda) untuk mendukung proses seleksi yang transparan,
                terukur, dan akuntabel.
              </p>

              <Link to="/login" className="hero-button">
                More / Login
                <FiArrowRight className="hero-button-icon" />
              </Link>

              <div className="hero-note">
                <span className="hero-note-icon">
                  <FiShield />
                </span>
                <div>
                  <strong>Resmi, Transparan, dan Terverifikasi</strong>
                  <p>Platform rekrutmen PT. BPR NTB (Perseroda)</p>
                </div>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit--outer" />
              <div className="orbit orbit--mid" />
              <div className="orbit orbit--inner" />

              <div className="orbit-accent orbit-accent--one" />
              <div className="orbit-accent orbit-accent--two" />
              <div className="orbit-accent orbit-accent--three" />

              <div className="hero-center">
                <img src="/bpr.png" alt="BPR HIRE" />
              </div>

              {HERO_FLOATING.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={`${item.title}-${item.subtitle}`} className={item.className}>
                    <span>
                      <Icon />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </article>
                );
              })}

              <div className="hero-dot-grid" />
              <div className="hero-blob hero-blob--a" />
            </div>
          </div>
        </section>

        <section id="keunggulan" className="value-section">
          <div className="layout">
            <h2 className="section-title-center">
              Rekrutmen Lebih Mudah, Hasil Lebih Berkualitas
            </h2>

            <div className="value-grid">
              {VALUE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className={`value-card ${card.tone}`}>
                    <span className="value-icon">
                      <Icon />
                    </span>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="tentang-kami" className="about-section">
          <div className="layout about-layout">
            <div className="about-copy">
              <p className="section-eyebrow">Tentang BPR HIRE</p>
              <h2>
                Platform Rekrutmen Resmi BPR HIRE
                <br />
                untuk <span>PT. BPR NTB (Perseroda)</span>
              </h2>
              <p className="about-text">
                BPR HIRE dirancang sebagai kanal rekrutmen resmi yang
                mendukung standarisasi seleksi, ketepatan administrasi, dan
                pengalaman pelamar yang profesional.
              </p>

              <div className="about-list">
                {ABOUT_POINTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="about-item">
                      <span>
                        <Icon />
                      </span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="about-visual" aria-hidden="true">
              <div className="dashboard-preview-shell">
                <aside className="dashboard-preview-sidebar">
                  <img src="/bpr.png" alt="" />
                  <div className="dashboard-preview-menu">
                    <span className="dashboard-preview-menu-item dashboard-preview-menu-item--active" />
                    <span className="dashboard-preview-menu-item" />
                    <span className="dashboard-preview-menu-item" />
                    <span className="dashboard-preview-menu-item" />
                  </div>
                </aside>
                <div className="dashboard-preview-main">
                  <div className="dashboard-preview-head">
                    <span className="dashboard-preview-head-title" />
                    <span className="dashboard-preview-head-profile" />
                  </div>
                  <div className="dashboard-preview-stats">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="dashboard-preview-panels">
                    <span className="dashboard-preview-panel dashboard-preview-panel--wide" />
                    <span className="dashboard-preview-panel dashboard-preview-panel--side" />
                    <span className="dashboard-preview-panel dashboard-preview-panel--wide" />
                  </div>
                </div>
              </div>
              <div className="dashboard-preview-shadow" />
            </div>
          </div>
        </section>

        <section id="karir" className="cta-section">
          <div className="layout cta-inner">
            <div className="cta-message">
              <span className="cta-icon">
                <FiSend />
              </span>
              <div>
                <h2>Siap Memulai Karier Anda?</h2>
                <p>
                  Bergabung bersama PT. BPR NTB (Perseroda) melalui proses rekrutmen yang resmi.
                </p>
              </div>
            </div>

            <Link to="/login" className="cta-button">
              More / Login
              <FiArrowRight />
            </Link>
          </div>
        </section>
      </main>

      <footer id="kontak" className="site-footer">
        <div className="layout footer-layout">
          <div className="footer-brand">
            <img src="/bpr.png" alt="BPR HIRE" />
            <p>
              BPR HIRE adalah platform rekrutmen resmi PT. BPR NTB
              (Perseroda) untuk menjaring talenta yang sesuai kebutuhan
              organisasi.
            </p>
          </div>

          <div className="footer-links">
            <h3>Quick Link</h3>
            <div>
              {FOOTER_LINKS_LEFT.map((item) => (
                <a key={item} href="#">
                  {item}
                </a>
              ))}
            </div>
            <div>
              {FOOTER_LINKS_RIGHT.map((item) => (
                <a key={item} href="#">
                  {item}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-contact">
            <h3>Hubungi Kami</h3>
            <p>
              <FiPhone />
              (0370) 641875
            </p>
            <p>
              <FiMail />
              rekrutmen@bprntb.co.id
            </p>
            <p>
              <FiMapPin />
              Mataram, Nusa Tenggara Barat
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MainPage;
