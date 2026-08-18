// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026

import { useCallback, useEffect, useRef, useId } from "react";

/** Translation function signature (subset of `useI18n`'s `t`). */
type TFn = (key: string, params?: Record<string, string | number>) => string;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const REPO_URL = "https://github.com/ZoliQua/React-Odontogram-Modul";

/** Human contributors and what each one added. Kept as data so a new
 *  contributor is a one-line addition here (and in the language READMEs).
 *  Claude / the AI assistant is intentionally never listed. */
const CONTRIBUTORS: { handle: string; descKey: string }[] = [
  { handle: "ZoliQua", descKey: "credits.contrib.zoliqua" },
  { handle: "odontodev", descKey: "credits.contrib.odontodev" },
  { handle: "JulianoBazzi", descKey: "credits.contrib.julianobazzi" },
  { handle: "yassine-bhn", descKey: "credits.contrib.yassine" },
  { handle: "saegerdirk-star", descKey: "credits.contrib.saegerdirk" },
];

/** External projects the app is built with. Names are proper nouns (not
 *  translated); each links to its home. */
const LIBRARIES: { name: string; url: string }[] = [
  { name: "jsPDF", url: "https://github.com/parallax/jsPDF" },
  { name: "DOMPurify", url: "https://github.com/cure53/DOMPurify" },
  { name: "React", url: "https://react.dev" },
  { name: "Vite", url: "https://vite.dev" },
  { name: "TypeScript", url: "https://www.typescriptlang.org" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com" },
];

/**
 * The "About and credits" popup. Mirrors {@link DualStateConfirm}'s dialog
 * contract: `role="dialog"` + `aria-modal`, Escape closes, backdrop click
 * closes, focus is trapped while open and returned to the opener on close.
 * Opened from the topbar Credits button (`creditsOpen` in the UI context).
 */
export default function CreditsModal({
  open,
  t,
  onClose,
}: {
  open: boolean;
  t: TFn;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="odon-confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="creditsModal"
        ref={dialogRef}
        className="odon-credits-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="odon-settings-close" onClick={onClose} aria-label={t("credits.close")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        <h2 className="odon-credits-title" id={titleId}>{t("credits.title")}</h2>

        <div className="odon-credits-body">
          <p className="odon-credits-intro">{t("credits.intro")}</p>

          <section className="odon-credits-section">
            <h3 className="odon-credits-heading">{t("credits.contributorsTitle")}</h3>
            <ul className="odon-credits-list">
              {CONTRIBUTORS.map((c) => (
                <li key={c.handle}>
                  <a
                    className="odon-credits-link"
                    href={`https://github.com/${c.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{c.handle}
                  </a>
                  <span className="odon-credits-desc">{t(c.descKey)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="odon-credits-section">
            <h3 className="odon-credits-heading">{t("credits.librariesTitle")}</h3>
            <ul className="odon-credits-libs">
              {LIBRARIES.map((l) => (
                <li key={l.name}>
                  <a className="odon-credits-link" href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a>
                </li>
              ))}
            </ul>
          </section>

          <p className="odon-credits-welcome">{t("credits.welcome")}</p>
        </div>

        <a className="odon-credits-star" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26 6.87.6-5.2 4.53 1.56 6.71L12 17.27 5.87 20.6l1.56-6.71-5.2-4.53 6.87-.6z"/></svg>
          <span>{t("credits.star")}</span>
        </a>
      </div>
    </div>
  );
}
