// Part of React Odontogram Modul - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026

import { useCallback, useEffect, useRef, useState, useId } from "react";
import {
  exportPdf,
  hasAnyPerioData,
  getCaseMeta,
  setPatientName,
  setExamDate,
  onStateChange,
} from "./odontogram";
import type { PdfExportOptions } from "./perioPdf";

/** Translation function signature (subset of `useI18n`'s `t`). */
type TFn = (key: string, params?: Record<string, string | number>) => string;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * UI-3b Task 7: the "PDF report…" export-settings dialog. Mirrors
 * {@link DualStateConfirm}'s dialog contract exactly:
 *
 * - `.odon-confirm-backdrop` / `.odon-confirm-modal`, `role="dialog"` +
 *   `aria-modal`, labelled via `useId()`.
 * - Esc cancels; backdrop click cancels; focus is trapped inside while open
 *   and returned to the opener element on close.
 *
 * Behavior: four checkboxes (all default ON) — patient data, odontogram +
 * description, perio status, perio description + footer — plus name/exam-date
 * inputs that write straight through the P4a `setPatientName`/`setExamDate`
 * setters (same pattern as `PerioSidebar`'s case-meta panel). When
 * {@link hasAnyPerioData} is false the two perio checkboxes are `disabled`
 * (a "no perio data" note is shown) and are forced off in the opts handed to
 * `exportPdf()` regardless of their checked state — belt-and-suspenders on
 * top of `exportPdf()`'s own internal auto-skip.
 */
export default function ExportOptionsModal({
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

  const [patientData, setPatientDataOpt] = useState(true);
  const [odontogram, setOdontogramOpt] = useState(true);
  const [perioStatus, setPerioStatusOpt] = useState(true);
  const [perioDescription, setPerioDescriptionOpt] = useState(true);
  const [hasPerio, setHasPerio] = useState(false);
  const [caseMeta, setCaseMetaState] = useState(getCaseMeta());

  // Capture the opener + move focus into the dialog when it opens; restore
  // focus to the opener when it closes/unmounts. Also (re)read hasPerio +
  // caseMeta so the dialog reflects the current chart every time it opens.
  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    setHasPerio(hasAnyPerioData());
    setCaseMetaState(getCaseMeta());
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [open]);

  // Keep the name/exam-date inputs (and the hasPerio gate) in sync with the
  // module while the dialog is open, mirroring PerioSidebar's caseMeta
  // subscription.
  useEffect(() => {
    if (!open) return;
    return onStateChange(() => {
      setCaseMetaState(getCaseMeta());
      setHasPerio(hasAnyPerioData());
    });
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

  const handleExport = () => {
    const opts: PdfExportOptions = {
      patientData,
      odontogram,
      perioStatus: perioStatus && hasPerio,
      perioDescription: perioDescription && hasPerio,
    };
    exportPdf(opts).catch((err) => console.error("exportPdf failed", err));
    onClose();
  };

  return (
    <div
      className="odon-confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="exportOptionsModal"
        ref={dialogRef}
        className="odon-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <p className="odon-confirm-message" id={titleId}>
          {t("export.options.title")}
        </p>

        <div className="case-meta-row">
          <label className="case-meta-row-label" htmlFor="exportOptionsPatientName">
            {t("case.patientName")}
          </label>
          <input
            id="exportOptionsPatientName"
            className="case-meta-input"
            type="text"
            value={caseMeta.patientName ?? ""}
            onChange={(e) => setPatientName(e.target.value === "" ? null : e.target.value)}
          />
        </div>
        <div className="case-meta-row">
          <label className="case-meta-row-label" htmlFor="exportOptionsExamDate">
            {t("case.examDate")}
          </label>
          <input
            id="exportOptionsExamDate"
            className="case-meta-input"
            type="date"
            value={caseMeta.examDate ?? ""}
            onChange={(e) => setExamDate(e.target.value === "" ? null : e.target.value)}
          />
        </div>

        <label>
          <input
            type="checkbox"
            checked={patientData}
            onChange={(e) => setPatientDataOpt(e.target.checked)}
          />
          <span>{t("export.options.patientData")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={odontogram}
            onChange={(e) => setOdontogramOpt(e.target.checked)}
          />
          <span>{t("export.options.odontogram")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={perioStatus}
            disabled={!hasPerio}
            onChange={(e) => setPerioStatusOpt(e.target.checked)}
          />
          <span>{t("export.options.perioStatus")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={perioDescription}
            disabled={!hasPerio}
            onChange={(e) => setPerioDescriptionOpt(e.target.checked)}
          />
          <span>{t("export.options.perioDescription")}</span>
        </label>
        {!hasPerio && <p className="hint">{t("export.options.noPerio")}</p>}

        <div className="odon-confirm-actions">
          <button
            type="button"
            className="odon-confirm-btn odon-confirm-cancel"
            onClick={onClose}
          >
            {t("export.options.cancel")}
          </button>
          <button
            type="button"
            className="odon-confirm-btn odon-confirm-accept"
            onClick={handleExport}
          >
            {t("export.options.export")}
          </button>
        </div>
      </div>
    </div>
  );
}
