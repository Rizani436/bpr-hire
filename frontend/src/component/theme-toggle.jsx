import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import {
  THEME_CHANGE_EVENT,
  THEME_DARK,
  getActiveThemeMode,
  toggleThemeMode,
} from "../utils/themeMode";

function ThemeToggle({ className = "", titlePrefix = "Tema" }) {
  const [themeMode, setThemeMode] = useState(() => getActiveThemeMode());
  const isDarkMode = themeMode === THEME_DARK;

  useEffect(() => {
    const syncThemeMode = (event) => {
      const modeFromEvent = event?.detail?.mode;
      if (modeFromEvent === THEME_DARK || modeFromEvent === "light") {
        setThemeMode(modeFromEvent);
        return;
      }

      setThemeMode(getActiveThemeMode());
    };

    window.addEventListener(THEME_CHANGE_EVENT, syncThemeMode);
    window.addEventListener("storage", syncThemeMode);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncThemeMode);
      window.removeEventListener("storage", syncThemeMode);
    };
  }, []);

  const handleToggle = () => {
    setThemeMode(toggleThemeMode());
  };

  const title = isDarkMode ? `${titlePrefix}: Dark` : `${titlePrefix}: Light`;

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={title}
      aria-label={title}
      className={className}
    >
      <span className="bh-theme-toggle-icon" aria-hidden="true">
        {isDarkMode ? <FiMoon /> : <FiSun />}
      </span>
      <span className="bh-theme-toggle-label">{isDarkMode ? "Dark" : "Light"}</span>
    </button>
  );
}

export default ThemeToggle;
