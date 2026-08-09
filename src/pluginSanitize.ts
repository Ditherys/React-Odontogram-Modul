// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// Plugin renderSvg() output is third-party content injected into the live SVG
// via innerHTML — it MUST pass through DOMPurify first. SVG profile only;
// script-capable elements are forbidden outright (foreignObject added on top
// of the spec's list because it can smuggle arbitrary HTML into an SVG).

import DOMPurify, { type Config } from "dompurify";

// Typed via dompurify's own `Config` (not `as const`) — `FORBID_TAGS` is a
// mutable `string[]` in that interface, so a `readonly` tuple from `as const`
// does not structurally match it.
const PLUGIN_SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script", "iframe", "object", "embed", "foreignObject"],
};

// DOMPurify parses its input with the HTML parser. A bare SVG fragment (no
// enclosing <svg> root) therefore lands in the HTML namespace rather than the
// SVG namespace, and DOMPurify's SVG profile then strips every element as
// "unknown" — silently discarding legitimate plugin output, not just
// malicious content. Wrapping in a throwaway <svg> root before sanitizing,
// then unwrapping the root afterwards, keeps elements in the correct
// namespace so the allowlist actually applies. This affects real browsers
// the same way it affects jsdom — it is not a test-environment quirk.
const SVG_WRAPPER_OPEN = /^<svg[^>]*>/;
const SVG_WRAPPER_CLOSE = /<\/svg>\s*$/;

/** Sanitize a plugin-supplied SVG fragment. Returns "" when nothing safe remains. */
export function sanitizePluginSvg(svgContent: string): string {
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
  const sanitized = DOMPurify.sanitize(wrapped, PLUGIN_SVG_CONFIG);
  return sanitized.replace(SVG_WRAPPER_OPEN, "").replace(SVG_WRAPPER_CLOSE, "");
}
