// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// Composable surface — the `<div className="panel-odontogram-controls">` region:
// the odontogram control panel (selection actions, Statuses/Tooth/Ortho/Caries/
// Fillings/Root-periodontium cards). Every input node here is a mount point the
// engine wires imperatively via `wireControls()`, so it is kept ALWAYS mounted
// and only hidden with CSS while the perio view is active — unmounting it would
// produce fresh DOM whose one-time listeners are never re-attached. Presentational:
// reads its gates from `useOdontogramUi()` and holds no state of its own.

import { useOdontogramUi } from "../OdontogramContext";

export default function ToothControlsSurface() {
  const { t, isPerioView, showStatusCard, showOrthoCard } = useOdontogramUi();

  return (
          <div className="panel-odontogram-controls" style={isPerioView ? { display: "none" } : undefined}>
          <div className="panel-header">
            <div>
              <div className="panel-title-row">
                <span className="panel-title">{t("panel.controls")}</span>
                <div className="panel-title-actions">
                  <button id="btnSelectNone" className="btn btn-ghost btn-icon btn-danger" title={t("panel.clearSelection")} aria-label={t("panel.clearSelection")}>{t("panel.clearSelection")}</button>
                  <button id="btnToggleControlsCard" className="icon-btn" title={t("actions.collapse", { label: t("panel.controls") })} aria-label={t("actions.collapse", { label: t("panel.controls") })}>
                    <span className="toggle-icon" aria-hidden="true">−</span>
                  </button>
                </div>
              </div>
              <div className="panel-subtitle">{t("panel.activeTooth")}: <span id="activeToothLabel" className="pill">{t("selection.none")}</span></div>
              <div id="controlsActions" className="panel-subtitle select-actions">
                <div className="select-actions-row">
                  <button id="btnSelectAll" className="btn btn-ghost btn-icon" title={t("panel.selectActions.all")}>{t("panel.selectActions.all")}</button>
                  <button id="btnSelectAllPresent" className="btn btn-ghost btn-icon fade-toggle" title={t("panel.selectActions.present")}>{t("panel.selectActions.present")}</button>
                  <button id="btnSelectPermanent" className="btn btn-ghost btn-icon fade-toggle" title={t("panel.selectActions.permanent")}>{t("panel.selectActions.permanent")}</button>
                  <button id="btnSelectMilk" className="btn btn-ghost btn-icon fade-toggle" title={t("panel.selectActions.milk")}>{t("panel.selectActions.milk")}</button>
                  <button id="btnSelectImplants" className="btn btn-ghost btn-icon fade-toggle" title={t("panel.selectActions.implants")}>{t("panel.selectActions.implants")}</button>
                  <button id="btnSelectAllMissing" className="btn btn-ghost btn-icon fade-toggle" title={t("panel.selectActions.missing")}>{t("panel.selectActions.missing")}</button>
                </div>
                <div className="select-actions-row">
                  <button id="btnSelectUpper" className="btn btn-ghost btn-icon" title={t("panel.selectActions.upper")}>{t("panel.selectActions.upper")}</button>
                  <button id="btnSelectUpperFront" className="btn btn-ghost btn-icon" title={t("panel.selectActions.upperFront")}>{t("panel.selectActions.upperFront")}</button>
                  <button id="btnSelectUpperMolar" className="btn btn-ghost btn-icon" title={t("panel.selectActions.upperMolar")}>{t("panel.selectActions.upperMolar")}</button>
                  <button id="btnSelectLower" className="btn btn-ghost btn-icon" title={t("panel.selectActions.lower")}>{t("panel.selectActions.lower")}</button>
                  <button id="btnSelectLowerFront" className="btn btn-ghost btn-icon" title={t("panel.selectActions.lowerFront")}>{t("panel.selectActions.lowerFront")}</button>
                  <button id="btnSelectLowerMolar" className="btn btn-ghost btn-icon" title={t("panel.selectActions.lowerMolar")}>{t("panel.selectActions.lowerMolar")}</button>
                </div>
              </div>
            </div>
            <div id="warnings" className="warnings"></div>
          </div>

          <div className="panel-body">
            <div className={showStatusCard ? "" : "hidden"}>
              <section className="card" id="statusCard">
                <div className="card-title card-title-row">
                  <span>{t("status.title")}</span>
                  <button id="btnToggleStatusCard" className="icon-btn" title={t("actions.collapse", { label: t("status.title") })} aria-label={t("actions.collapse", { label: t("status.title") })}>
                    <span className="toggle-icon" aria-hidden="true">−</span>
                  </button>
                </div>
                <div className="row status-actions" id="statusCardBody">
                  <button id="btnResetAll" className="btn btn-ghost btn-sm">{t("status.resetAll")}</button>
                  <button id="btnPrimaryDentition" className="btn btn-ghost btn-sm">{t("status.primaryDentition")}</button>
                  <button id="btnMixedDentition" className="btn btn-ghost btn-sm">{t("status.mixedDentition")}</button>
                  <button id="btnEdentulous" className="btn btn-toggle btn-sm" aria-pressed="false">{t("status.edentulous")}</button>
                </div>
                <div className="row status-extra-row">
                  <span>{t("status.extraLabel")}</span>
                  <select id="statusExtraSelect"></select>
                  <button id="statusExtraApply" className="btn btn-ghost btn-sm">{t("status.extraApply")}</button>
                </div>
              </section>
            </div>

            <section className="card">
              <div className="card-title card-title-row">
                <span>{t("tooth.title")}</span>
                <button id="btnResetTooth" className="btn btn-ghost btn-sm" title={t("tooth.resetTitle")} aria-label={t("tooth.resetTitle")}>{t("tooth.reset")}</button>
              </div>
              <div className="row">
                <span>{t("tooth.baseLabel")}</span>
                <select id="toothSelect"></select>
              </div>
              <div id="substrateRow" className="row">
                <span>{t("substrate.label")}</span>
                <select id="substrateSelect"></select>
              </div>
              <label id="extractionRow" className="row">
                <input type="checkbox" id="extractionWound" />
                <span>{t("tooth.extractionWound")}</span>
              </label>
              <label id="missingClosedRow" className="row">
                <input type="checkbox" id="missingClosed" />
                <span>{t("tooth.missingClosed")}</span>
              </label>
              <div id="restorationRow" className="row">
                <span>{t("restoration.label")}</span>
                <select id="restorationSelect"></select>
              </div>
              <label id="crownLeakageRow" className="row hidden">
                <input type="checkbox" id="crownLeakage" />
                <span>{t("crownLeakage.label")}</span>
              </label>
              <div id="brokenCrownRow" className="row inline-checks contact-row">
                <label>
                  <input type="checkbox" id="brokenMesial" />
                  <span>{t("tooth.broken.mesial")}</span>
                </label>
                <label>
                  <input type="checkbox" id="brokenIncisal" />
                  <span>{t("tooth.broken.incisal")}</span>
                </label>
                <label>
                  <input type="checkbox" id="brokenDistal" />
                  <span>{t("tooth.broken.distal")}</span>
                </label>
              </div>
              <div id="contactPointRow" className="row inline-checks contact-row">
                <label>
                  <input type="checkbox" id="contactMesial" />
                  <span>{t("tooth.contact.mesialMissing")}</span>
                </label>
                <label>
                  <input type="checkbox" id="contactDistal" />
                  <span>{t("tooth.contact.distalMissing")}</span>
                </label>
              </div>
              <div id="bruxismRow" className="inline-checks bruxism-row wear-stack">
                <div id="wearEdgeRow" className="row">
                  <label id="wearEdgeSelectLabel"><span>{t("tooth.bruxism.edgeWear")}</span><select id="wearEdgeSelect"></select></label>
                  <label id="wearEdgeToggleLabel" className="inline-check hidden"><input type="checkbox" id="wearEdgeToggle" /><span>{t("tooth.bruxism.edgeWear")}</span></label>
                </div>
                <div id="wearCervicalRow" className="row">
                  <label id="wearCervicalSelectLabel"><span>{t("tooth.bruxism.neckWear")}</span><select id="wearCervicalSelect"></select></label>
                  <label id="wearCervicalToggleLabel" className="inline-check hidden"><input type="checkbox" id="wearCervicalToggle" /><span>{t("tooth.bruxism.neckWear")}</span></label>
                </div>
              </div>
              <div id="discolorationRow" className="row inline-checks">
                <label id="discolorationSelectLabel"><span>{t("discoloration.label")}</span><select id="discolorationSelect"></select></label>
                <label id="discolorationToggleLabel" className="inline-check hidden"><input type="checkbox" id="discolorationToggle" /><span>{t("discoloration.label")}</span></label>
              </div>
              <div id="crownActionsRow" className="row inline-checks bridge-actions-row">
                <label id="bridgePillarRow" className="inline-check">
                  <input type="checkbox" id="bridgePillar" />
                  <span>{t("tooth.bridgePillar")}</span>
                </label>
                <label id="extractionPlanRow" className="inline-check">
                  <input type="checkbox" id="extractionPlan" />
                  <span>{t("tooth.extractionPlan")}</span>
                </label>
              </div>
              <label id="crownReplaceRow" className="row">
                <input type="checkbox" id="crownReplace" />
                <span>{t("tooth.crownReplace")}</span>
              </label>
              <label id="crownNeededRow" className="row">
                <input type="checkbox" id="crownNeeded" />
                <span>{t("tooth.crownNeeded")}</span>
              </label>
            </section>

            <div className={showOrthoCard ? "" : "hidden"}>
              <section id="orthoCard" className="card">
                <div className="card-title card-title-row">
                  <span>{t("toothInfo.orthodontics")}</span>
                </div>
                <div id="orthoApplianceRow" className="row">
                  <span>{t("ortho.appliance.label")}</span>
                  <select id="orthoApplianceSelect"></select>
                </div>
                <div id="orthoDriftRow" className="row">
                  <span>{t("ortho.drift.label")}</span>
                  <select id="orthoDriftSelect"></select>
                </div>
                <div id="orthoVerticalRow" className="row">
                  <span>{t("ortho.vertical.label")}</span>
                  <select id="orthoVerticalSelect"></select>
                </div>
                <label id="orthoRotationRow" className="row inline-check">
                  <input type="checkbox" id="orthoRotationToggle" />
                  <span>{t("ortho.rotation.label")}</span>
                </label>
              </section>
            </div>

            <section id="cariesSection" className="card">
              <div className="card-title card-title-row">
                <span>{t("caries.title")}</span>
                <button id="btnToggleCariesCard" className="icon-btn" title={t("actions.collapse", { label: t("caries.title") })} aria-label={t("actions.collapse", { label: t("caries.title") })}>
                  <span className="toggle-icon" aria-hidden="true">−</span>
                </button>
              </div>
              <div className="hint">{t("caries.hint")}</div>
              <div id="cariesDepthRow" className="row">
                <span>{t("caries.depthLabel")}</span>
                <select id="cariesDepthSelect"></select>
              </div>
              <div id="cariesChecks"></div>
              <div id="cariesSubcrownRow" className="check-grid subcrown-row"></div>
              <div id="rootCariesRow" className="row">
                <span>{t("caries.rootLabel")}</span>
                <select id="rootCariesSelect"></select>
              </div>
            </section>

            <section id="fillingSection" className="card">
              <div className="card-title card-title-row">
                <span>{t("filling.title")}</span>
                <button id="btnToggleFillingCard" className="icon-btn" title={t("actions.collapse", { label: t("filling.title") })} aria-label={t("actions.collapse", { label: t("filling.title") })}>
                  <span className="toggle-icon" aria-hidden="true">−</span>
                </button>
              </div>
              <div className="row">
                <span>{t("filling.typeLabel")}</span>
                <select id="fillingSelect"></select>
              </div>
              <div id="fillingSurfaceChecks" className="hidden"></div>
              {/* "simple" complexity: one filled/not-filled toggle shown instead
                  of the 5-surface grid (wired in odontogram.ts). It is a `.row`
                  LABEL (the whole pill is clickable — the native checkbox is
                  display:none), like #fissureSealingRow. */}
              <label id="fillingSimpleRow" className="row fissure-row hidden">
                <input type="checkbox" id="fillingSimpleToggle" />
                <span>{t("filling.simpleToggle")}</span>
              </label>
              {/* When the filling-defect feature is on, a defect select applies a
                  defect to ALL filled surfaces (simple mode has no per-surface cells). */}
              <div id="fillingSimpleDefectRow" className="row hidden">
                <span>{t("fillingDefect.label")}</span>
                <select id="fillingSimpleDefectSelect"></select>
              </div>
              <label id="fissureSealingRow" className="row fissure-row">
                <input type="checkbox" id="fissureSealing" />
                <span>{t("filling.fissureSealing")}</span>
              </label>
              <div id="fillingSubcariesSummary" className="hint hidden"></div>
              <div id="fillingDefectSummary" className="hint hidden"></div>
            </section>

            <section id="rootPeriodontiumSection" className="card">
              <div className="card-title card-title-row">
                <span>{t("card.rootPeriodontium")}</span>
                <button id="btnToggleRootPeriodontiumCard" className="icon-btn" title={t("actions.collapse", { label: t("card.rootPeriodontium") })} aria-label={t("actions.collapse", { label: t("card.rootPeriodontium") })}>
                  <span className="toggle-icon" aria-hidden="true">−</span>
                </button>
              </div>

              <div id="rpRootBlock">
                <div className="hint">{t("endo.hint")}</div>
                <div id="pulpEndoRow" className="row">
                  <span>{t("pulpEndo.label")}</span>
                  <select id="pulpEndoSelect"></select>
                </div>
                <div id="apicalDxRow" className="row">
                  <span>{t("apical.dxLabel")}</span>
                  <select id="apicalDxSelect"></select>
                </div>
                <div id="periapicalTypeRow" className="row hidden">
                  <span>{t("periapical.typeLabel")}</span>
                  <select id="periapicalTypeSelect"></select>
                </div>
                <div id="resorptionRow" className="row">
                  <span>{t("root.resorption")}</span>
                  <select id="resorptionSelect"></select>
                </div>
                <div className="row inline-checks">
                  <label>
                    <input type="checkbox" id="endoResection" />
                    <span>{t("endo.resection")}</span>
                  </label>
                  <label>
                    <input type="checkbox" id="parapulpalPin" />
                    <span>{t("endo.parapulpalPin")}</span>
                  </label>
                </div>
              </div>

              <div id="rpPerioBlock">
                <div id="mobilityRow" className="row">
                  <span>{t("inflammation.mobilityLabel")}</span>
                  <select id="mobilitySelect"></select>
                </div>
                <div id="perioRow" className="perio-block">
                  <div className="perio-block-title">{t("perio.title")}</div>
                  <div id="perioGrid" className="perio-grid"></div>
                  <div id="perioReadout" className="hint perio-readout"></div>
                </div>
                <div id="modsChecks" className="check-grid"></div>
                <div id="calculusRow" className="row inline-checks hidden">
                  <label><input type="checkbox" id="calculusToggle" /><span>{t("calculus.label")}</span></label>
                </div>
                <div id="periImplantRow" className="row hidden">
                  <span>{t("periImplant.label")}</span>
                  <select id="periImplantSelect"></select>
                </div>
              </div>
            </section>

          </div>
          </div>
  );
}
