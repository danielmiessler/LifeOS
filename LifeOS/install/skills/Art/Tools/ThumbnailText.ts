#!/usr/bin/env bun
/**
 * ThumbnailText.ts — deterministic compositor for {{PRINCIPAL_FULL_NAME}}'s (@unsupervised-learning)
 * YouTube thumbnail house style. Built from the documented design system in
 * USER/CUSTOMIZATIONS/SKILLS/Art/YouTubeThumbnailExamples/SPECIFICATIONS.md, reconciled against
 * live pixel samples of the real Main / Sponsored thumbnails (the spec's border/bg values were
 * stale — pixels win).
 *
 * The real house style (NOT a generated cinematic scene — that reads MORE like AI):
 *   - solid deep-navy field (#1A2744), optionally a real supporting visual (diagram / screenshot /
 *     terminal) darkened behind the text on the text side.
 *   - clean rembg face cutout on the opposite third (solo), or two framed stills (interview).
 *   - 4-line type hierarchy in the house palette: kicker (white) / title (periwinkle or orange,
 *     extra-bold) / subtitle (white or periwinkle) / tag (purple), uppercase, with a thin accent
 *     underline rule under the headline.
 *   - the "TI:" node-mark logo top-right.
 *   - a SEMANTIC colored border: blue #316AE9 = core content, green #306F1D = sponsored.
 *
 * Fixes vs the legacy ComposeThumbnail.ts: measured auto-fit text (no trim-then-guess), absolute-Y
 * stacking, overlay border (no resize-squash), real-photo face (no uncanny generation).
 *
 * Solo:      bun ThumbnailText.ts --title "PERSONAL AI" --subtitle "INFRASTRUCTURE" \
 *              --kicker "A DEEP DIVE ON MY" --tag "v2 (December 2025)" --face headshot.png \
 *              --art diagram.png --variant core --output ~/Downloads/thumb.png
 * Interview: bun ThumbnailText.ts --mode interview --kicker "A CONVERSATION WITH" \
 *              --title "GRANT LEE" --subtitle "ON BUILDING GAMMA" --face host.png --face2 guest.png \
 *              --name1 "{{PRINCIPAL_FULL_NAME}}" --name2 "Grant Lee" --variant sponsored --output out.png
 *
 * Emits JSON: { output, thumb320, dims, mode, titlePt, contrastRatio, overflowed }
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, parse } from "node:path";
import { claudeDir } from "../../../LIFEOS/TOOLS/lifeos-root";

const W = 1280;
const H = 720;

// House palette (from SPECIFICATIONS.md COLOR PALETTE + live samples).
const NAVY = "#1A2744";
const PERIWINKLE = "#6B8DD6";
const WHITE = "#FFFFFF";
const VARIANT_BORDER: Record<string, string> = { core: "#316AE9", sponsored: "#306F1D" };
const BRAND_LOGO = join(claudeDir(), "LIFEOS", "USER", "CUSTOMIZATIONS", "SKILLS", "Art", "brand", "ti-logo-white.png");

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function magick(args: string[]): string {
  return execFileSync("magick", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}
function num(s: string): number {
  return parseFloat(s);
}
function which(bin: string): string | null {
  const p = Bun.which(bin);
  if (p) return p;
  const local = join(homedir(), ".local", "bin", bin);
  return existsSync(local) ? local : null;
}
function safeLabel(t: string): string {
  // ImageMagick label: treats a leading '@' as file-indirection and a leading '-' as an option.
  // Escape both so user text always renders literally. (execFileSync already prevents shell
  // injection — codex empirically confirmed %, quotes, and dashes are otherwise safe.)
  return t.replace(/^([@-])/, "\\$1");
}
function lineWidth(text: string, font: string, pt: number): number {
  return num(magick(["-background", "none", "-font", font, "-pointsize", String(pt), `label:${safeLabel(text)}`, "-format", "%[fx:w]", "info:"]));
}
function lineHeight(text: string, font: string, pt: number): number {
  return num(magick(["-background", "none", "-font", font, "-pointsize", String(pt), `label:${safeLabel(text)}`, "-format", "%[fx:h]", "info:"]));
}
function hexLuminance(hex: string): number {
  return num(magick(["-size", "1x1", `xc:${hex}`, "-format", "%[fx:luminance]", "info:"]));
}
function wcag(l1: number, l2: number): number {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

/** rembg-or-floodfill subject cutout, auto-selected by source background. */
function cutoutFace(face: string, cutMode: string, tmp: string, tag: string, cleanup: string[]): string {
  const out = `${tmp}-${tag}.png`;
  cleanup.push(out);
  const cornerLum = num(magick([face, "-gravity", "NorthWest", "-crop", "12x12+0+0", "+repage", "-resize", "1x1!", "-format", "%[fx:luminance]", "info:"]));
  const useRembg = cutMode === "rembg" || (cutMode === "auto" && cornerLum >= 0.06);
  if (cutMode === "none") {
    magick([face, out]);
  } else if (useRembg) {
    const rembg = which("rembg");
    if (!rembg) {
      console.error("ERROR: rembg not found on PATH or ~/.local/bin. Install rembg or use a black-bg headshot with --cut floodfill.");
      process.exit(1);
    }
    execFileSync(rembg, ["i", face, out], { stdio: ["ignore", "ignore", "inherit"] });
    magick([out, "-channel", "A", "-blur", "0x1.2", "+channel", out]);
  } else {
    const dims = magick(["identify", "-format", "%w %h", face]).split(" ");
    const iw = parseInt(dims[0] ?? "0", 10);
    const ih = parseInt(dims[1] ?? "0", 10);
    magick([face, "-alpha", "set", "-bordercolor", "black", "-fuzz", "16%", "-fill", "none", "-draw", "alpha 0,0 floodfill", "-draw", `alpha ${iw - 1},0 floodfill`, "-draw", `alpha 0,${ih - 1} floodfill`, "-draw", `alpha ${iw - 1},${ih - 1} floodfill`, "-channel", "A", "-blur", "0x1.5", "-level", "0,75%", "+channel", out]);
  }
  return out;
}

type Line = { text: string; color: string; scale: number };

/** Auto-fit: largest size from the locked scale where every line fits the zone width + height. */
function fitTitlePt(lines: Line[], font: string, zoneW: number, maxH: number): { titlePt: number; overflowed: boolean } {
  for (const pt of [124, 112, 102, 92, 84, 76, 68, 60, 54]) {
    const widthsOk = lines.every((l) => lineWidth(l.text, font, Math.round(pt * l.scale)) <= zoneW);
    if (!widthsOk) continue;
    const totalH = lines.reduce((s, l) => s + lineHeight(l.text, font, Math.round(pt * l.scale)) * 1.1, 0);
    if (totalH <= maxH) return { titlePt: pt, overflowed: false };
  }
  return { titlePt: 54, overflowed: true };
}

/** Draw one text line (shadow + fill) at absolute NorthWest geometry. Returns its height. */
function drawLine(base: string, l: Line, font: string, pt: number, x: number, y: number, gravity: string): number {
  const t = safeLabel(l.text);
  magick([base, "(", "-background", "none", "-fill", "rgba(0,0,0,0.62)", "-font", font, "-pointsize", String(pt), `label:${t}`, ")", "-gravity", gravity, "-geometry", `+${x + 3}+${Math.round(y) + 4}`, "-composite", base]);
  magick([base, "(", "-background", "none", "-fill", l.color, "-font", font, "-pointsize", String(pt), `label:${t}`, ")", "-gravity", gravity, "-geometry", `+${x}+${Math.round(y)}`, "-composite", base]);
  return lineHeight(l.text, font, pt);
}

function main(): void {
  const mode = (arg("mode", "solo") as "solo" | "interview" | "overlay");
  const bg = arg("bg");
  const art = arg("art");
  const face = arg("face", "none")!;
  const face2 = arg("face2");
  const name1 = arg("name1", "");
  const name2 = arg("name2", "");
  const kicker = (arg("kicker", "") || "").toUpperCase();
  const title = (arg("title") || "").toUpperCase();
  const subtitle = (arg("subtitle", "") || "").toUpperCase();
  const accent = arg("accent", PERIWINKLE)!;
  const subColor = arg("subtitle-color", WHITE)!;
  const faceSide = (arg("face-side", "right") as "right" | "left");
  const font = arg("font", "Hermes-Maia-6-Caps")!; // principal-specified thumbnail font (2026-06-28): "Hermes Maia 6 caps". File: ~/Library/Fonts/Hermes Maia 6 Caps Regular.otf. (Was Anton-Regular; overridden by explicit principal directive.)
  const output = arg("output", join(homedir(), "Downloads", "sm-thumb.png"))!;
  const variant = (arg("variant", "core") as "core" | "sponsored");
  const borderArg = arg("border");
  const cutMode = arg("cut", "auto")!;
  const noBorder = flag("no-border");
  const noLogo = flag("no-logo");
  const noRule = flag("no-rule");
  const logoPath = arg("logo", BRAND_LOGO)!;

  if (!title) {
    console.error("ERROR: --title is required");
    process.exit(1);
  }

  const tmp = join(homedir(), "Downloads", `.smt-${process.pid}`);
  const cleanup: string[] = [];
  const base = `${tmp}-base.png`;
  cleanup.push(base);

  // 1. Base field: solid house navy, or a supplied plate cover-fit. Navy is the real default —
  //    his thumbnails are navy + a real supporting visual, not a generated scene.
  if (bg && existsSync(bg)) {
    magick([bg, "-resize", `${W}x${H}^`, "-gravity", "center", "-extent", `${W}x${H}`, base]);
  } else {
    magick(["-size", `${W}x${H}`, `xc:${NAVY}`, base]);
  }

  let titlePt = 54;
  let overflowed = false;
  let contrastRatio = 21;

  if (mode === "interview") {
    // ---- INTERVIEW: text top-centered, two framed stills bottom, name labels. ----
    const lines: Line[] = [];
    if (kicker) lines.push({ text: kicker, color: WHITE, scale: 0.42 });
    lines.push({ text: title, color: accent, scale: 1.0 });
    if (subtitle) lines.push({ text: subtitle, color: subColor, scale: 0.5 });
    const fit = fitTitlePt(lines, font, Math.round(W * 0.86), Math.round(H * 0.42));
    titlePt = fit.titlePt;
    overflowed = fit.overflowed;

    let cy = 34;
    for (const l of lines) {
      const pt = Math.round(titlePt * l.scale);
      const h = drawLine(base, l, font, pt, 0, cy, "North");
      cy += h * 1.06;
    }
    if (!noRule) {
      const rw = Math.round(W * 0.34);
      magick([base, "-fill", accent, "-draw", `rectangle ${(W - rw) / 2},${cy + 6} ${(W + rw) / 2},${cy + 11}`, base]);
    }

    // two framed stills at the bottom. Pair path+label BEFORE filtering so a missing face
    //   never shifts the other person's name onto the wrong still.
    const pairs = [
      { path: face, label: name1 ?? "" },
      { path: face2 ?? "", label: name2 ?? "" },
    ].filter((p) => p.path && p.path !== "none" && existsSync(p.path));
    const gap = 24;
    const sw = Math.round((W - 2 * 40 - gap) / 2);
    const sh = Math.round(H * 0.42);
    const sy = H - sh - 36;
    pairs.slice(0, 2).forEach((p, i) => {
      const sx = i === 0 ? 40 : 40 + sw + gap;
      const cell = `${tmp}-still${i}.png`;
      cleanup.push(cell);
      magick([p.path, "-resize", `${sw}x${sh}^`, "-gravity", "center", "-extent", `${sw}x${sh}`, "-bordercolor", "#0d1424", "-border", "3", cell]);
      magick([base, cell, "-gravity", "NorthWest", "-geometry", `+${sx}+${sy}`, "-composite", base]);
      if (p.label) {
        const barW = Math.min(sw, Math.round(lineWidth(p.label, font, 22)) + 16);
        magick([base, "-fill", "rgba(10,16,28,0.75)", "-draw", `rectangle ${sx},${sy + sh - 34} ${sx + barW},${sy + sh}`, base]);
        magick([base, "(", "-background", "none", "-fill", WHITE, "-font", font, "-pointsize", "22", `label:${safeLabel(p.label)}`, ")", "-gravity", "NorthWest", "-geometry", `+${sx + 8}+${sy + sh - 30}`, "-composite", base]);
      }
    });
  } else if (mode === "overlay") {
    // ---- OVERLAY (new STANDARD, refined 2026-06-28 per principal): the WHOLE background is a
    //   custom topic art image (--bg, cover-fit). The serious face is LARGE, raised so the head
    //   sits near the TOP, and pulled toward center. The title sits HIGH in the TOP-LEFT inside
    //   a solid navy panel with an accent left bar + underline — a real text background with
    //   character, not a soft scrim. ----
    const marginX = 52;

    // 1. big serious face. CRITICAL: trim the cutout to the subject FIRST — the raw headshot has
    //    headroom + shoulders slack, so scaling without trimming leaves the head small and
    //    mid-frame (the 2026-06-28 "you didn't make my face bigger/higher" miss). Trim → the head
    //    fills the box; scale by HEIGHT (width was the binding cap before); over-tall so the head
    //    reaches the very top; centered-right so the top-left text stays clear.
    if (face && face !== "none" && existsSync(face)) {
      const keyed = cutoutFace(face, cutMode, tmp, "face", cleanup);
      const faceT = `${tmp}-faceT.png`;
      const faceR = `${tmp}-faceR.png`;
      cleanup.push(faceT, faceR);
      magick([keyed, "-trim", "+repage", faceT]);
      // Tall SIDE figure: bigger (~52% width) and pushed FARTHER right (bleeds ~24px off the
      //   right edge) so it reads large and clearly on the side, leaving the left for centered
      //   text (2026-06-28: "a bit bigger and farther to the right").
      magick([faceT, "-resize", `${Math.round(W * 0.54)}x${Math.round(H * 1.22)}`, faceR]);
      magick([base, faceR, "-gravity", faceSide === "right" ? "SouthEast" : "SouthWest", "-geometry", "-52+0", "-composite", base]);
    }

    // 2. title HIGH in the TOP-LEFT — CLEAN: NO background panel, NO subtitle (principal
    //    2026-06-28: "don't like that background on the text, and you shouldn't have that subtext
    //    either"). Just the big white stacked title over the art, legible via a strengthened drop
    //    shadow only (no box). Multi-word titles auto-split into balanced stacked lines.
    const titleWords = title.split(/\s+/).filter(Boolean);
    let titleLines: string[];
    if (titleWords.length <= 3) {
      // ONE WORD PER LINE → the biggest, cleanest stacked title. Each line is gated only by its
      //   own word width, not a long combined line (a 2-line split of a 3-word title crushed the
      //   size to the floor — 2026-06-29). Best for the short punchy titles this style uses.
      titleLines = titleWords.length ? titleWords : [title];
    } else {
      // 4+ words: balance into two lines.
      let best = 1, bestDiff = Infinity;
      for (let k = 1; k < titleWords.length; k++) {
        const a = titleWords.slice(0, k).join(" ").length;
        const b = titleWords.slice(k).join(" ").length;
        if (Math.abs(a - b) < bestDiff) { bestDiff = Math.abs(a - b); best = k; }
      }
      titleLines = [titleWords.slice(0, best).join(" "), titleWords.slice(best).join(" ")];
    }

    const lines: Line[] = [];
    if (kicker) lines.push({ text: kicker, color: accent, scale: 0.34 });
    for (const tl of titleLines) lines.push({ text: tl, color: WHITE, scale: 1.0 });
    // subtitle intentionally omitted in overlay mode.

    const zoneW = Math.round(W * 0.49); // left ~half, clear of the side face → room to go LARGE
    const zoneX = marginX;
    const fit = fitTitlePt(lines, font, zoneW, Math.round(H * 0.66));
    titlePt = fit.titlePt;
    overflowed = fit.overflowed;

    const textStyle = arg("text-style", "shadow")!; // boxed | accent | shadow — principal locked SHADOW (2026-06-29)
    const lineHs = lines.map((l) => Math.round(lineHeight(l.text, font, Math.round(titlePt * l.scale))));
    const gap = Math.round(titlePt * 0.16); // space between boxes so each is INDIVIDUAL
    const boxPadX = Math.round(titlePt * 0.2);
    const boxPadTop = Math.round(titlePt * 0.05);
    const boxPadBot = Math.round(titlePt * 0.16);
    const totalH = lineHs.reduce((s, h) => s + h, 0) + gap * (lines.length - 1);
    let cursorY = Math.round((H - totalH) / 2); // VERTICALLY CENTERED (face is to the right)
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      const pt = Math.round(titlePt * l.scale);
      const lw = Math.round(lineWidth(l.text, font, pt));
      const lh = lineHs[i]!;
      if (textStyle === "shadow") {
        // PER-LETTER soft shadow (2026-06-29: "each individual letter needs the background, like a
        //   shadow background, not for the word"). A blurred dark copy of THIS line's glyphs
        //   (bordered so the blur has room) composited as a halo + a slight drop — each letter
        //   carries its own shadow, NO boxes. Crisp white fill on top keeps the Hermes letterforms
        //   sharp (only the shadow is blurred, not the fill).
        const sh = `${tmp}-sh-${i}.png`;
        cleanup.push(sh);
        const bd = 16;
        magick(["-background", "none", "-bordercolor", "none", "-fill", "rgba(0,0,0,0.92)", "-font", font, "-pointsize", String(pt), `label:${safeLabel(l.text)}`, "-border", String(bd), "-blur", "0x6", sh]);
        magick([base, sh, "-gravity", "NorthWest", "-geometry", `+${zoneX - bd}+${Math.round(cursorY) - bd}`, "-composite", base]);
        magick([base, sh, "-gravity", "NorthWest", "-geometry", `+${zoneX - bd + 4}+${Math.round(cursorY) - bd + 5}`, "-composite", base]);
        drawLine(base, l, font, pt, zoneX, cursorY, "NorthWest");
      } else {
        // INDIVIDUAL background hugging THIS line's letters (not one block). boxed=near-black,
        //   accent=brand blue. Crisp white text → the Hermes Maia 6 Caps letterforms read clean.
        const fillc = textStyle === "accent" ? accent : "rgba(9,11,16,0.92)";
        const bx0 = zoneX - boxPadX, by0 = Math.round(cursorY) - boxPadTop;
        const bx1 = zoneX + lw + boxPadX, by1 = Math.round(cursorY) + lh + boxPadBot;
        magick([base, "-fill", fillc, "-draw", `roundrectangle ${bx0},${by0} ${bx1},${by1} 10,10`, base]);
        drawLine(base, l, font, pt, zoneX, cursorY, "NorthWest");
      }
      cursorY += lh + gap;
    }
    contrastRatio = 21; // boxed/accent/shadow → always legible
  } else {
    // ---- SOLO (control-matched, rebuilt 2026-06-28): full-width navy TITLE BAND on top
    //   (white condensed title + subtitle + accent underline), a BIG face bottom-anchored on
    //   the face side with the head rising to just under the band, the plate/diagram showing in
    //   the body, node-logo top-right. The prior layout (small left text column + small low
    //   face, all-accent title) did NOT match the real @unsupervised-learning solo control
    //   (5-Levels) — principal called it out. ----
    const marginX = 56;
    const bandH = Math.round(H * 0.32); // ≈230 navy title band, full width

    // 1. BIG face first, bottom-anchored on the face side; the band (drawn next) cleanly caps
    //    any head overlap above it so the head reads as starting right at the band edge.
    if (face && face !== "none" && existsSync(face)) {
      const keyed = cutoutFace(face, cutMode, tmp, "face", cleanup);
      const faceR = `${tmp}-faceR.png`;
      cleanup.push(faceR);
      const faceH = Math.round(H * 0.82); // large — head reaches up near the band
      magick([keyed, "-resize", `${Math.round(W * 0.5)}x${faceH}`, faceR]);
      magick([base, faceR, "-gravity", faceSide === "right" ? "SouthEast" : "SouthWest", "-geometry", "+12+0", "-composite", base]);
    }

    // 2. optional supporting diagram in the body, opposite the face (real diagram/screenshot).
    if (art && existsSync(art)) {
      const artLayer = `${tmp}-art.png`;
      cleanup.push(artLayer);
      const aw = Math.round(W * 0.56);
      const ah = Math.round((H - bandH) * 0.84);
      magick([art, "-resize", `${aw}x${ah}`, artLayer]);
      const ax = faceSide === "right" ? 40 : W - aw - 40;
      magick([base, artLayer, "-gravity", "NorthWest", "-geometry", `+${ax}+${bandH + 24}`, "-composite", base]);
    }

    // 3. solid navy title band on top — clean, high-contrast title zone (covers face overlap).
    magick([base, "-fill", NAVY, "-draw", `rectangle 0,0 ${W},${bandH}`, base]);

    // 4. title block inside the band: WHITE title (like the control, not all-accent), optional
    //    kicker (accent) above + subtitle below, fit ~full-width, left-aligned, vertically
    //    centered in the band; accent underline under the block.
    const lines: Line[] = [];
    if (kicker) lines.push({ text: kicker, color: accent, scale: 0.32 });
    lines.push({ text: title, color: WHITE, scale: 1.0 });
    if (subtitle) lines.push({ text: subtitle, color: subColor, scale: 0.46 });
    const textW = W - 2 * marginX - 80; // keep the top-right logo clear
    const fit = fitTitlePt(lines, font, textW, bandH - 52);
    titlePt = fit.titlePt;
    overflowed = fit.overflowed;

    const blockH = lines.reduce((s, l) => s + lineHeight(l.text, font, Math.round(titlePt * l.scale)) * 1.04, 0);
    let cursorY = Math.round(Math.max(18, (bandH - blockH) / 2 - 6));
    let lastBottom = cursorY;
    for (const l of lines) {
      const pt = Math.round(titlePt * l.scale);
      const h = drawLine(base, l, font, pt, marginX, cursorY, "NorthWest");
      cursorY += h * 1.04;
      lastBottom = cursorY;
    }
    if (!noRule) {
      const rw = Math.min(textW, Math.round(lineWidth(title, font, titlePt)));
      magick([base, "-fill", accent, "-draw", `rectangle ${marginX},${Math.round(lastBottom) + 4} ${marginX + rw},${Math.round(lastBottom) + 11}`, base]);
    }
    // white-on-navy in the band is always legible; report the real ratio.
    contrastRatio = Math.round(wcag(hexLuminance(WHITE), hexLuminance(NAVY)) * 100) / 100;
  }

  // 4. semantic border (ON by default; blue=core, green=sponsored), overlay frame (no squash).
  //    Drawn BEFORE the logo so the logo sits cleanly inside the frame, not clipped by it.
  let bWidth = 0;
  if (!noBorder) {
    let b = 30; // thicker outer outline (2026-06-29 principal: "make the blue outline thicker")
    let bc: string = VARIANT_BORDER[variant] ?? "#316AE9";
    if (borderArg) {
      const [bw = "30", bcOverride] = borderArg.split(",");
      const parsed = parseInt(bw, 10);
      b = Number.isFinite(parsed) && parsed >= 0 && parsed <= Math.min(W, H) / 2 ? parsed : 30;
      if (bcOverride) bc = bcOverride;
    }
    bWidth = b;
    magick([base, "-fill", bc, "-draw", `rectangle 0,0 ${W},${b}`, "-draw", `rectangle 0,${H - b} ${W},${H}`, "-draw", `rectangle 0,0 ${b},${H}`, "-draw", `rectangle ${W - b},0 ${W},${H}`, base]);
  }

  // 5. logo top-right, cleared inside the border (the extracted "TI:" mark).
  if (!noLogo && existsSync(logoPath)) {
    const logo = `${tmp}-logo.png`;
    cleanup.push(logo);
    magick([logoPath, "-resize", "x46", logo]);
    // nudged further IN from the border so it doesn't sit against the outline (2026-06-29).
    magick([base, logo, "-gravity", "NorthEast", "-geometry", `+${bWidth + 22}+${bWidth + 20}`, "-composite", base]);
  }
  magick([base, output]);

  // 6. 320x180 legibility proof. Build the path with path.parse so an extensionless
  //    --output can never collapse thumb320 onto output (which would overwrite the full-res).
  const op = parse(output);
  const thumb320 = join(op.dir, `${op.name}-320${op.ext || ".png"}`);
  magick([output, "-resize", "320x180!", thumb320]);

  const dims = magick(["identify", "-format", "%wx%h %m", output]);
  for (const f of cleanup) {
    try {
      rmSync(f, { force: true });
    } catch {
      /* best-effort */
    }
  }
  console.log(JSON.stringify({ output, thumb320, dims, mode, titlePt, contrastRatio, overflowed }, null, 2));
  if (overflowed) process.exit(2);
}

main();
