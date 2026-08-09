import { describe, it, expect } from "vitest";
import { sanitizePluginSvg } from "../pluginSanitize";

describe("sanitizePluginSvg", () => {
  it("passes benign SVG fragments through with attributes intact", () => {
    const out = sanitizePluginSvg('<circle cx="10" cy="10" r="4" fill="red" />');
    expect(out).toContain("<circle");
    expect(out).toContain('fill="red"');
  });

  it("strips <script> elements", () => {
    const out = sanitizePluginSvg('<circle r="4" /><script>window.pwned = true<' + '/script>');
    expect(out).not.toContain("script");
    expect(out).toContain("<circle");
  });

  it("strips event-handler attributes", () => {
    const out = sanitizePluginSvg('<image href="x" onerror="window.pwned=true" />');
    expect(out).not.toContain("onerror");
  });

  it("strips foreignObject/iframe/object/embed vectors", () => {
    const out = sanitizePluginSvg('<foreignObject><iframe src="https://evil.example"></iframe></foreignObject><object data="x"></object><embed src="y" />');
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("foreignObject");
    expect(out).not.toContain("object");
    expect(out).not.toContain("embed");
  });

  it("strips javascript: URLs", () => {
    const out = sanitizePluginSvg('<a href="javascript:window.pwned=true"><text>x</text></a>');
    expect(out).not.toContain("javascript:");
  });

  it("returns an empty string for wholly malicious input", () => {
    expect(sanitizePluginSvg("<script>1<" + "/script>")).toBe("");
  });
});
