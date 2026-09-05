// Lesen/Schreiben der admin-editierbaren Content-Dateien
// (src/content/overrides.*.json + ticker.*.json). Mit Validierung.

import { readFile, writeFile } from 'node:fs/promises';
import { contentPaths } from './config.mjs';

async function readJsonFile(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Aktueller Content-Stand (Overrides + Ticker + Medien + Standard-Locales). */
export async function loadContent() {
  const p = contentPaths();
  const [overridesDe, overridesEn, tickerDe, tickerEn, media, localesDe, localesEn] =
    await Promise.all([
      readJsonFile(p.overridesDe, {}),
      readJsonFile(p.overridesEn, {}),
      readJsonFile(p.tickerDe, defaultTicker()),
      readJsonFile(p.tickerEn, defaultTicker()),
      readJsonFile(p.media, defaultMedia()),
      readJsonFile(p.localesDe, {}),
      readJsonFile(p.localesEn, {}),
    ]);
  return {
    overrides: { de: overridesDe, en: overridesEn },
    ticker: { de: tickerDe, en: tickerEn },
    media,
    defaults: { de: localesDe, en: localesEn },
  };
}

// Standard-Farben des Laufbands je Modus (entsprechen dem eingebauten Aussehen).
function defaultTickerColors(mode) {
  return mode === 'dark'
    ? { textColor: '#e2e8f0', bgColor: '#111827', bgOpacity: 100 }
    : { textColor: '#ffffff', bgColor: '#014f99', bgOpacity: 100 };
}
function defaultTickerStyle() {
  return {
    enabled: false,
    // Geteilte Typografie (gilt für Hell- und Dunkelmodus).
    fontSize: 14,
    fontFamily: '', // Dateiname im Fonts-Ordner; leer = Standardschrift
    letterSpacing: 0, // Buchstabenabstand in px (0 = normal)
    // Farben getrennt je Modus.
    light: defaultTickerColors('light'),
    dark: defaultTickerColors('dark'),
  };
}

/** Buchstabenabstand: auf [-5, 20] px begrenzen, auf 0,5 gerundet. */
function clampSpacing(v, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(-5, Math.min(20, Math.round(n * 2) / 2));
}

/** Erlaubt einen einfachen Schrift-Dateinamen (kein Pfad) oder '' (Standard). */
function normFontFile(v) {
  if (typeof v !== 'string' || v === '') return '';
  return /^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(woff2|woff|ttf|otf)$/i.test(v.trim()) ? v.trim() : '';
}

function defaultTicker() {
  return { enabled: false, speed: 'normal', items: [], style: defaultTickerStyle() };
}

function normHexColor(v, def) {
  if (typeof v !== 'string') return def;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v.trim());
  if (!m) return def;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  return '#' + h.toLowerCase();
}

function clampNum(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Wie clampNum, aber auf 0,5er-Schritte gerundet (z. B. Umriss-/Konturdicke).
function clampHalf(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n * 2) / 2));
}

/**
 * Validiert/normalisiert das Laufband-Design (fehlerhafte Werte -> Standard).
 * Migriert die alte flache Struktur (Farben oben, für beide Modi gleich) auf
 * getrennte Farb-Sätze light/dark — verhaltensneutral.
 */
export function validateTickerStyle(s) {
  const d = defaultTickerStyle();
  if (!isPlainObject(s)) return d;
  const hasSides = isPlainObject(s.light) || isPlainObject(s.dark);
  const flat = !hasSides && typeof s.textColor === 'string' ? s : null;
  const colors = (side, def) => {
    const o = isPlainObject(side) ? side : flat || {};
    return {
      textColor: normHexColor(o.textColor, def.textColor),
      bgColor: normHexColor(o.bgColor, def.bgColor),
      bgOpacity: clampNum(o.bgOpacity, 0, 100, def.bgOpacity),
    };
  };
  return {
    enabled: s.enabled === true,
    fontSize: clampNum(s.fontSize, 8, 48, d.fontSize),
    fontFamily: normFontFile(s.fontFamily),
    letterSpacing: clampSpacing(s.letterSpacing, d.letterSpacing),
    light: colors(s.light, d.light),
    dark: colors(s.dark, d.dark),
  };
}

// Standard-Design des Hero-Bereichs, getrennt für Hell- und Dunkelmodus. Die
// Standardwerte entsprechen dem jeweiligen Aussehen in global.css, sodass
// enabled=false (und auch enabled=true mit Standardwerten) unverändert wirkt.
function heroSideLight() {
  return {
    borderColor: '#014f99',
    borderWidth: 1,
    bgColor: '#ffffff',
    bgOpacity: 70,
    chipBgColor: '#014f99',
    chipBgOpacity: 15,
    chipTextColor: '#013f7a',
    chipBorderColor: '#ffffff',
    chipBorderOpacity: 20,
    chipHoverBgColor: '#0160b8',
    chipHoverTextColor: '#f5f4d6',
    ctaBgColor: '#014f99',
    ctaBgOpacity: 100,
    ctaTextColor: '#ffffff',
    ctaBorderColor: '#ffffff',
    ctaBorderOpacity: 0,
    ctaHoverBgColor: '#003971',
    ctaHoverTextColor: '#ffffff',
    titleTextColor: '#003971',
  };
}
function heroSideDark() {
  return {
    borderColor: '#e8a945',
    borderWidth: 1,
    bgColor: '#0e1c32',
    bgOpacity: 80,
    chipBgColor: '#142640',
    chipBgOpacity: 40,
    chipTextColor: '#f8e1a9',
    chipBorderColor: '#ffffff',
    chipBorderOpacity: 8,
    chipHoverBgColor: '#142640',
    chipHoverTextColor: '#f5f4d6',
    ctaBgColor: '#e8a945',
    ctaBgOpacity: 100,
    ctaTextColor: '#ffffff',
    ctaBorderColor: '#ffffff',
    ctaBorderOpacity: 0,
    ctaHoverBgColor: '#a07030',
    ctaHoverTextColor: '#ffffff',
    titleTextColor: '#f9f2d5',
  };
}
// Buchstaben-Konturbreite: [0, 5] px, auf 0,5 gerundet.
function clampStroke(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n * 2) / 2)) : def;
}
// Schriftgröße: 0 = Standard (CSS), sonst [8, 96] px (ganzzahlig).
function clampFont(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(8, Math.min(96, Math.round(n)));
}

function defaultHeroDesign() {
  return {
    enabled: false,
    // Eigene Schriften (Dateiname im /fonts-Ordner; leer = Standard). Gelten für
    // beide Modi. titleFont: Überschriften, buttonFont: Feature-Chips + CTA.
    titleFont: '',
    buttonFont: '',
    // Typografie (für beide Modi): Buchstabenabstand + Buchstaben-Kontur (Rahmen)
    // je Gruppe (Überschriften bzw. Buttons). strokeWidth 0 = keine Kontur.
    titleLetterSpacing: 0,
    titleStrokeColor: '#000000',
    titleStrokeWidth: 0,
    buttonLetterSpacing: 0,
    buttonStrokeColor: '#000000',
    buttonStrokeWidth: 0,
    // Schriftgrößen (0 = Standard), je Hero-Text.
    titleFontSize: 0,
    subtitleFontSize: 0,
    chipFontSize: 0,
    ctaFontSize: 0,
    light: heroSideLight(),
    dark: heroSideDark(),
  };
}

/** Validiert einen Farb-Satz (Hell oder Dunkel) gegen dessen Standard. */
function validateHeroSide(s, def) {
  if (!isPlainObject(s)) return def;
  return {
    borderColor: normHexColor(s.borderColor, def.borderColor),
    borderWidth: clampNum(s.borderWidth, 0, 8, def.borderWidth),
    bgColor: normHexColor(s.bgColor, def.bgColor),
    bgOpacity: clampNum(s.bgOpacity, 0, 100, def.bgOpacity),
    chipBgColor: normHexColor(s.chipBgColor, def.chipBgColor),
    chipBgOpacity: clampNum(s.chipBgOpacity, 0, 100, def.chipBgOpacity),
    chipTextColor: normHexColor(s.chipTextColor, def.chipTextColor),
    chipBorderColor: normHexColor(s.chipBorderColor, def.chipBorderColor),
    chipBorderOpacity: clampNum(s.chipBorderOpacity, 0, 100, def.chipBorderOpacity),
    chipHoverBgColor: normHexColor(s.chipHoverBgColor, def.chipHoverBgColor),
    chipHoverTextColor: normHexColor(s.chipHoverTextColor, def.chipHoverTextColor),
    ctaBgColor: normHexColor(s.ctaBgColor, def.ctaBgColor),
    ctaBgOpacity: clampNum(s.ctaBgOpacity, 0, 100, def.ctaBgOpacity),
    ctaTextColor: normHexColor(s.ctaTextColor, def.ctaTextColor),
    ctaBorderColor: normHexColor(s.ctaBorderColor, def.ctaBorderColor),
    ctaBorderOpacity: clampNum(s.ctaBorderOpacity, 0, 100, def.ctaBorderOpacity),
    ctaHoverBgColor: normHexColor(s.ctaHoverBgColor, def.ctaHoverBgColor),
    ctaHoverTextColor: normHexColor(s.ctaHoverTextColor, def.ctaHoverTextColor),
    titleTextColor: normHexColor(s.titleTextColor, def.titleTextColor),
  };
}

/**
 * Validiert/normalisiert das Hero-Design (getrennt Hell/Dunkel).
 * Migriert die alte flache Struktur (Farben auf oberster Ebene) -> beide Modi.
 */
function validateHeroDesign(hd) {
  if (!isPlainObject(hd)) return defaultHeroDesign();
  const hasSides = isPlainObject(hd.light) || isPlainObject(hd.dark);
  const flat = !hasSides && typeof hd.borderColor === 'string' ? hd : null;
  return {
    enabled: hd.enabled === true,
    titleFont: normFontFile(hd.titleFont),
    buttonFont: normFontFile(hd.buttonFont),
    titleLetterSpacing: clampSpacing(hd.titleLetterSpacing, 0),
    titleStrokeColor: normHexColor(hd.titleStrokeColor, '#000000'),
    titleStrokeWidth: clampStroke(hd.titleStrokeWidth, 0),
    buttonLetterSpacing: clampSpacing(hd.buttonLetterSpacing, 0),
    buttonStrokeColor: normHexColor(hd.buttonStrokeColor, '#000000'),
    buttonStrokeWidth: clampStroke(hd.buttonStrokeWidth, 0),
    titleFontSize: clampFont(hd.titleFontSize),
    subtitleFontSize: clampFont(hd.subtitleFontSize),
    chipFontSize: clampFont(hd.chipFontSize),
    ctaFontSize: clampFont(hd.ctaFontSize),
    light: validateHeroSide(hasSides ? hd.light : flat, heroSideLight()),
    dark: validateHeroSide(hasSides ? hd.dark : flat, heroSideDark()),
  };
}

// --- Tool-Karten-Design (Tab „Tool-Karten") ---
// Standard je Modus = eingebautes Aussehen aus tool-cards.css (verhaltensneutral).
function toolCardSideLight() {
  return {
    borderColor: '#e5e7eb',
    borderOpacity: 100,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 16,
    bgColor: '#ffffff',
    bgOpacity: 100,
    gradient: false,
    bgColor2: '#f1f5f9',
    gradientAngle: 135,
    hoverBorderColor: '#014f99',
    hoverBorderOpacity: 22,
    hoverBgColor: '#ffffff',
    hoverBgOpacity: 0,
    titleColor: '',
    badgeColor: '',
    badgeBgColor: '',
    badgeBgOpacity: 100,
    openColor: '',
    descColor: '',
    descBgColor: '',
    bgImage: '',
    bgImageOpacity: 100,
    bgImageDarken: 0,
  };
}
function toolCardSideDark() {
  return {
    borderColor: '#1d3a5c',
    borderOpacity: 100,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 16,
    bgColor: '#142640',
    bgOpacity: 100,
    gradient: false,
    bgColor2: '#0e1c32',
    gradientAngle: 135,
    hoverBorderColor: '#e8a945',
    hoverBorderOpacity: 22,
    hoverBgColor: '#142640',
    hoverBgOpacity: 0,
    titleColor: '',
    badgeColor: '',
    badgeBgColor: '',
    badgeBgOpacity: 100,
    openColor: '',
    descColor: '',
    descBgColor: '',
    bgImage: '',
    bgImageOpacity: 100,
    bgImageDarken: 0,
  };
}
function defaultToolCards() {
  return {
    enabled: false,
    default: { light: toolCardSideLight(), dark: toolCardSideDark() },
    cards: {},
  };
}
const TOOL_CARD_KEY = /^(tools|imageTools|diverseTools)\.[a-zA-Z0-9_-]+$/;
const TOOL_CARD_BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'];
const TOOL_CARDS_MAX = 200; // Sicherheitsgrenze für Einzel-Designs
/** Validiert einen Farb-Satz (Hell oder Dunkel) einer Tool-Karte. */
function validateToolCardSide(s, def) {
  if (!isPlainObject(s)) return def;
  return {
    borderColor: normHexColor(s.borderColor, def.borderColor),
    borderOpacity: clampNum(s.borderOpacity, 0, 100, def.borderOpacity),
    borderWidth: clampNum(s.borderWidth, 0, 8, def.borderWidth),
    borderStyle: TOOL_CARD_BORDER_STYLES.includes(s.borderStyle) ? s.borderStyle : def.borderStyle,
    borderRadius: clampNum(s.borderRadius, 0, 40, def.borderRadius),
    bgColor: normHexColor(s.bgColor, def.bgColor),
    bgOpacity: clampNum(s.bgOpacity, 0, 100, def.bgOpacity),
    gradient: s.gradient === true,
    bgColor2: normHexColor(s.bgColor2, def.bgColor2),
    gradientAngle: clampNum(s.gradientAngle, 0, 360, def.gradientAngle),
    hoverBorderColor: normHexColor(s.hoverBorderColor, def.hoverBorderColor),
    hoverBorderOpacity: clampNum(s.hoverBorderOpacity, 0, 100, def.hoverBorderOpacity),
    hoverBgColor: normHexColor(s.hoverBgColor, def.hoverBgColor),
    hoverBgOpacity: clampNum(s.hoverBgOpacity, 0, 100, def.hoverBgOpacity),
    titleColor: normHexColor(s.titleColor, ''),
    badgeColor: normHexColor(s.badgeColor, ''),
    badgeBgColor: normHexColor(s.badgeBgColor, ''),
    badgeBgOpacity: clampNum(s.badgeBgOpacity, 0, 100, 100),
    openColor: normHexColor(s.openColor, ''),
    descColor: normHexColor(s.descColor, ''),
    descBgColor: normHexColor(s.descBgColor, ''),
    bgImage: SITE_IMAGE_URL.test(String(s.bgImage ?? '')) ? s.bgImage : '',
    bgImageOpacity: clampNum(s.bgImageOpacity, 0, 100, 100),
    bgImageDarken: clampNum(s.bgImageDarken, 0, 100, 0),
  };
}
// Typografie der Karten-Texte (Hell + Dunkel gemeinsam); 0 / '' = Standard der Seite.
const TOOL_CARD_WEIGHTS = ['', '400', '500', '600', '700', '800'];
const TOOL_CARD_TRANSFORMS = ['', 'none', 'uppercase', 'capitalize'];
function defaultToolCardText() {
  return {
    titleFont: '',
    titleSize: 0,
    titleWeight: '',
    titleSpacing: 0,
    titleTransform: '',
    textFont: '',
    badgeSize: 0,
    badgeWeight: '',
    badgeTransform: '',
    openSize: 0,
    openWeight: '',
    descSize: 0,
  };
}
function validateToolCardText(t) {
  if (!isPlainObject(t)) return defaultToolCardText();
  const weight = (v) => (TOOL_CARD_WEIGHTS.includes(String(v ?? '')) ? String(v ?? '') : '');
  const transform = (v) => (TOOL_CARD_TRANSFORMS.includes(v) ? v : '');
  return {
    titleFont: normFontFile(t.titleFont),
    titleSize: clampNum(t.titleSize, 0, 40, 0),
    titleWeight: weight(t.titleWeight),
    titleSpacing: clampHalf(t.titleSpacing, -2, 5, 0),
    titleTransform: transform(t.titleTransform),
    textFont: normFontFile(t.textFont),
    badgeSize: clampNum(t.badgeSize, 0, 20, 0),
    badgeWeight: weight(t.badgeWeight),
    badgeTransform: transform(t.badgeTransform),
    openSize: clampNum(t.openSize, 0, 20, 0),
    openWeight: weight(t.openWeight),
    descSize: clampNum(t.descSize, 0, 24, 0),
  };
}
function validateToolCardStyle(st) {
  const o = isPlainObject(st) ? st : {};
  return {
    light: validateToolCardSide(o.light, toolCardSideLight()),
    dark: validateToolCardSide(o.dark, toolCardSideDark()),
    text: validateToolCardText(o.text),
  };
}
/**
 * Validiert das Tool-Karten-Design: Standard (alle Karten) + Einzel-Designs
 * (nur bekannte Schlüssel-Form "section.key", begrenzte Anzahl).
 */
function validateToolCards(tc) {
  if (!isPlainObject(tc)) return defaultToolCards();
  const cards = {};
  if (isPlainObject(tc.cards)) {
    let n = 0;
    for (const [key, val] of Object.entries(tc.cards)) {
      if (!TOOL_CARD_KEY.test(key) || !isPlainObject(val)) continue;
      if (++n > TOOL_CARDS_MAX) break;
      cards[key] = validateToolCardStyle(val);
    }
  }
  return { enabled: tc.enabled === true, default: validateToolCardStyle(tc.default), cards };
}

function defaultMediaLocale() {
  return {
    sectionVideos: {
      audio: '/videos/audio-tools.mp4',
      image: '/videos/image-tools.mp4',
      diverse: '/videos/diverse-tools.mp4',
    },
    heroMode: 'banner',
    heroLayout: 'grid3',
    heroBanner: '',
    heroBannerLink: '',
    heroGrid: ['', '', '', '', '', ''],
    heroGridLinks: ['', '', '', '', '', ''],
    heroGridStyles: defaultCellStyles(),
    heroGridUniform: false,
    heroGridUniformCell: 0,
    heroGridRatio: '1:1',
    heroGridFit: 'cover',
    textStyles: {},
    textStyleUniform: false,
    textStyleUniformKey: 'hero.title',
    heroDesign: defaultHeroDesign(),
    toolCards: defaultToolCards(),
    iconTint: {},
  };
}
const ICON_TINT_FIELDS = ['light', 'dark', 'bg', 'bgDark'];
/** Icon-Färbung je Tool-Karte: nur gültige Karten-Schlüssel und Hex-Farben; leere Einträge entfallen. */
function validateIconTint(v) {
  const out = {};
  if (!isPlainObject(v)) return out;
  for (const [key, t] of Object.entries(v)) {
    if (!TOOL_CARD_KEY.test(key) || !isPlainObject(t)) continue;
    const e = {};
    let any = false;
    for (const f of ICON_TINT_FIELDS) {
      e[f] = normHexColor(t[f], '');
      if (e[f]) any = true;
    }
    if (any) out[key] = e;
  }
  return out;
}
// Text-Slots des „Texte"-Tabs mit einstellbarer Größe/Farbe.
const TEXT_STYLE_KEYS = [
  'hero.title',
  'hero.subtitle',
  'hero.cta',
  'tools.sectionTitle',
  'imageTools.sectionTitle',
  'diverseTools.sectionTitle',
];
/**
 * Validiert die Text-Stile: nur bekannte Schlüssel, Größe 0–120, Hex-Farben.
 * Farbe getrennt nach Hell/Dunkel; ein altes einzelnes color wird migriert.
 */
function validateTextStyles(o) {
  const out = {};
  if (!isPlainObject(o)) return out;
  for (const k of TEXT_STYLE_KEYS) {
    const s = o[k];
    if (!isPlainObject(s)) continue;
    const size = clampNum(s.size, 0, 120, 0);
    const font = normFontFile(s.font);
    const legacy = normHexColor(s.color, '');
    const colorLight = normHexColor(s.colorLight, '') || legacy;
    const colorDark = normHexColor(s.colorDark, '') || legacy;
    // Effekte (Schatten, Umriss, Deckkraft, Animation) – analog Banner-Text.
    const shadow = s.shadow === true;
    const strokeWidth = clampHalf(s.strokeWidth, 0, 10, 0);
    const opacity = clampNum(s.opacity, 0, 100, 100);
    const anim = BANNER_ANIM_TYPES.includes(s.anim) ? s.anim : 'none';
    const hasFx = shadow || strokeWidth > 0 || opacity < 100 || anim !== 'none';
    if (size > 0 || colorLight || colorDark || font || hasFx) {
      const entry = { size, colorLight, colorDark, font };
      if (hasFx) {
        entry.shadow = shadow;
        entry.shadowColor = normHexColor(s.shadowColor, '#000000');
        entry.shadowX = clampNum(s.shadowX, -50, 50, 0);
        entry.shadowY = clampNum(s.shadowY, -50, 50, 2);
        entry.shadowBlur = clampNum(s.shadowBlur, 0, 40, 6);
        entry.strokeColor = normHexColor(s.strokeColor, '#000000');
        entry.strokeWidth = strokeWidth;
        entry.opacity = opacity;
        entry.anim = anim;
        entry.animIntensity = clampNum(s.animIntensity, 1, 10, 5);
        entry.animSpeed = BANNER_ANIM_SPEEDS.includes(s.animSpeed) ? s.animSpeed : 'normal';
      }
      out[k] = entry;
    }
  }
  return out;
}
// Erlaubte Hero-Raster-Layouts (Anordnung der Kacheln).
const HERO_LAYOUTS = ['grid2', 'grid3', 'row4', 'grid4', 'grid6', 'big2', 'vrow', 'mosaic'];
// Verfügbare Text-Animationen des Banner-Textes und Tempo-Stufen.
const BANNER_ANIM_TYPES = ['none', 'pulse', 'float', 'shake', 'wobble', 'glow'];
const BANNER_ANIM_SPEEDS = ['slow', 'normal', 'fast'];
// Größtmögliche Kachelzahl über alle Layouts (für Raster + Per-Kachel-Design).
const HERO_GRID_MAX = 6;
// Per-Kachel-Design (Rahmen + Hintergrund); Standard = kein Rahmen, bg 8 %.
function defaultCellStyle() {
  return {
    borderColor: '#014f99',
    borderWidth: 0,
    bgColor: '#014f99',
    bgOpacity: 8,
    text: '',
    font: '',
    textColor: '#ffffff',
    textSize: 0,
    textPos: 'center',
    textX: 50,
    textY: 50,
    // Bildbearbeitung des Kachel-Mediums: Deckkraft, Abdunkelung, Weichzeichner, Sättigung.
    imgOpacity: 100,
    imgDarken: 0,
    imgBlur: 0,
    imgSaturate: 100,
  };
}
const TEXT_POS = ['top', 'center', 'bottom'];
function normTextPos(v) {
  return TEXT_POS.includes(v) ? v : 'center';
}
// Freie Position (0–100 %). Fehlt sie, aus altem top/center/bottom ableiten.
function normPosPct(v, legacyPos, axisDefault) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  return { top: 10, center: 50, bottom: 90 }[legacyPos] ?? axisDefault;
}
function defaultCellStyles() {
  return Array.from({ length: HERO_GRID_MAX }, () => defaultCellStyle());
}
function validateCellStyle(s) {
  const d = defaultCellStyle();
  if (!isPlainObject(s)) return d;
  return {
    borderColor: normHexColor(s.borderColor, d.borderColor),
    borderWidth: clampNum(s.borderWidth, 0, 20, d.borderWidth),
    bgColor: normHexColor(s.bgColor, d.bgColor),
    bgOpacity: clampNum(s.bgOpacity, 0, 100, d.bgOpacity),
    text: typeof s.text === 'string' ? s.text.slice(0, 120) : '',
    font: normFontFile(s.font),
    textColor: normHexColor(s.textColor, d.textColor),
    textSize: clampNum(s.textSize, 0, 96, d.textSize),
    textPos: normTextPos(s.textPos),
    textX: normPosPct(s.textX, undefined, 50),
    textY: normPosPct(s.textY, normTextPos(s.textPos), 50),
    imgOpacity: clampNum(s.imgOpacity, 0, 100, d.imgOpacity),
    imgDarken: clampNum(s.imgDarken, 0, 100, d.imgDarken),
    imgBlur: clampNum(s.imgBlur, 0, 20, d.imgBlur),
    imgSaturate: clampNum(s.imgSaturate, 0, 200, d.imgSaturate),
  };
}

/** Globale (sprachübergreifende) Seiten-Einstellungen (Standard). */
function defaultSite() {
  // globalFont: Basis-Schriftart der ganzen Seite (Dateiname im /fonts-Ordner;
  // leer = System-Standard 'Supreme'). Wirkt über alle Sprachen hinweg.
  // bgColor/bgColorDark: Seiten-Hintergrundfarbe für Hell-/Dunkelmodus
  // (leer = Standardfarbe des jeweiligen Modus).
  // bgOpacity*: Deckkraft (0–100 %) über der Standardfarbe; bgGradient*/bgColor2*/
  // bgGradientType*/bgAngle*: optionaler Farbverlauf je Modus.
  return {
    globalFont: '',
    bgColor: '',
    bgColorDark: '',
    bgOpacity: 100,
    bgOpacityDark: 100,
    bgGradient: false,
    bgGradientDark: false,
    bgColor2: '',
    bgColor2Dark: '',
    bgGradientType: 'linear',
    bgGradientTypeDark: 'linear',
    bgAngle: 180,
    bgAngleDark: 180,
    // Hintergrund-Effekte (global): an/aus + Intensität 0–100.
    fxAurora: false,
    fxAuroraIntensity: 50,
    fxNoise: false,
    fxNoiseIntensity: 50,
    fxSpotlight: false,
    fxSpotlightIntensity: 50,
    // Muster je Modus (Punktraster/Gitter): Art, Farbe, Abstand, Stärke, Deckkraft.
    bgPattern: 'none',
    bgPatternDark: 'none',
    bgPatternColor: '#014f99',
    bgPatternColorDark: '#e8a945',
    bgPatternSpacing: 24,
    bgPatternSpacingDark: 24,
    bgPatternThickness: 1,
    bgPatternThicknessDark: 1,
    bgPatternOpacity: 12,
    bgPatternOpacityDark: 12,
    // Hintergrundbild je Modus: URL, Abdunkelung, Weichzeichner, Deckkraft, fixiert.
    bgImage: '',
    bgImageDark: '',
    bgImageDarken: 0,
    bgImageDarkenDark: 0,
    bgImageBlur: 0,
    bgImageBlurDark: 0,
    bgImageOpacity: 100,
    bgImageOpacityDark: 100,
    bgImageFixed: true,
    bgImageFixedDark: true,
    // Abgesetzte Tool-Sektionen: style 'band' | 'card', je Sektion Hell/Dunkel.
    sections: defaultSections(),
  };
}
const SECTION_KEYS = ['audio', 'image', 'diverse'];
function defaultSectionSide() {
  return { color: '', opacity: 8, image: '', imageDarken: 0, imageBlur: 0, imageOpacity: 100 };
}
function defaultSections() {
  const o = { style: 'band', gap: 0 };
  for (const k of SECTION_KEYS) o[k] = { light: defaultSectionSide(), dark: defaultSectionSide() };
  return o;
}
/** Validiert die Sektions-Einstellungen (Tönung/Bild je Sektion und Modus). */
function validateSections(v) {
  const out = defaultSections();
  if (!isPlainObject(v)) return out;
  out.style = v.style === 'card' ? 'card' : 'band';
  out.gap = clampNum(v.gap, 0, 160, 0);
  for (const k of SECTION_KEYS) {
    for (const mode of ['light', 'dark']) {
      const side = isPlainObject(v[k]) && isPlainObject(v[k][mode]) ? v[k][mode] : {};
      out[k][mode] = {
        color: normHexColor(side.color, ''),
        opacity: clampNum(side.opacity, 0, 100, 8),
        image: SITE_IMAGE_URL.test(String(side.image ?? '')) ? side.image : '',
        imageDarken: clampNum(side.imageDarken, 0, 100, 0),
        imageBlur: clampNum(side.imageBlur, 0, 40, 0),
        imageOpacity: clampNum(side.imageOpacity, 0, 100, 100),
      };
    }
  }
  return out;
}
const SITE_GRADIENT_TYPES = ['linear', 'radial'];
const SITE_PATTERNS = ['none', 'dots', 'grid'];
const SITE_IMAGE_URL = /^(\/[^\s"'()\\]*|https?:\/\/[^\s"'()\\]+)$/;
/** Validiert die globalen Seiten-Einstellungen. */
function validateSite(s) {
  if (!isPlainObject(s)) return defaultSite();
  const gtype = (v) => (SITE_GRADIENT_TYPES.includes(v) ? v : 'linear');
  return {
    globalFont: normFontFile(s.globalFont),
    // Ungültige/fehlende Farbe -> '' (= Standard); gültige Werte auf #rrggbb normiert.
    bgColor: normHexColor(s.bgColor, ''),
    bgColorDark: normHexColor(s.bgColorDark, ''),
    bgOpacity: clampNum(s.bgOpacity, 0, 100, 100),
    bgOpacityDark: clampNum(s.bgOpacityDark, 0, 100, 100),
    bgGradient: s.bgGradient === true,
    bgGradientDark: s.bgGradientDark === true,
    bgColor2: normHexColor(s.bgColor2, ''),
    bgColor2Dark: normHexColor(s.bgColor2Dark, ''),
    bgGradientType: gtype(s.bgGradientType),
    bgGradientTypeDark: gtype(s.bgGradientTypeDark),
    bgAngle: clampNum(s.bgAngle, 0, 360, 180),
    bgAngleDark: clampNum(s.bgAngleDark, 0, 360, 180),
    fxAurora: s.fxAurora === true,
    fxAuroraIntensity: clampNum(s.fxAuroraIntensity, 0, 100, 50),
    fxNoise: s.fxNoise === true,
    fxNoiseIntensity: clampNum(s.fxNoiseIntensity, 0, 100, 50),
    fxSpotlight: s.fxSpotlight === true,
    fxSpotlightIntensity: clampNum(s.fxSpotlightIntensity, 0, 100, 50),
    bgPattern: SITE_PATTERNS.includes(s.bgPattern) ? s.bgPattern : 'none',
    bgPatternDark: SITE_PATTERNS.includes(s.bgPatternDark) ? s.bgPatternDark : 'none',
    bgPatternColor: normHexColor(s.bgPatternColor, '#014f99'),
    bgPatternColorDark: normHexColor(s.bgPatternColorDark, '#e8a945'),
    bgPatternSpacing: clampNum(s.bgPatternSpacing, 4, 200, 24),
    bgPatternSpacingDark: clampNum(s.bgPatternSpacingDark, 4, 200, 24),
    bgPatternThickness: clampNum(s.bgPatternThickness, 1, 6, 1),
    bgPatternThicknessDark: clampNum(s.bgPatternThicknessDark, 1, 6, 1),
    bgPatternOpacity: clampNum(s.bgPatternOpacity, 0, 100, 12),
    bgPatternOpacityDark: clampNum(s.bgPatternOpacityDark, 0, 100, 12),
    // Bild-URL: interner Pfad oder http(s) ohne Zeichen, die CSS url("…") brechen.
    bgImage: SITE_IMAGE_URL.test(String(s.bgImage ?? '')) ? s.bgImage : '',
    bgImageDark: SITE_IMAGE_URL.test(String(s.bgImageDark ?? '')) ? s.bgImageDark : '',
    bgImageDarken: clampNum(s.bgImageDarken, 0, 100, 0),
    bgImageDarkenDark: clampNum(s.bgImageDarkenDark, 0, 100, 0),
    bgImageBlur: clampNum(s.bgImageBlur, 0, 40, 0),
    bgImageBlurDark: clampNum(s.bgImageBlurDark, 0, 40, 0),
    bgImageOpacity: clampNum(s.bgImageOpacity, 0, 100, 100),
    bgImageOpacityDark: clampNum(s.bgImageOpacityDark, 0, 100, 100),
    bgImageFixed: s.bgImageFixed !== false,
    bgImageFixedDark: s.bgImageFixedDark !== false,
    sections: validateSections(s.sections),
  };
}

/** Medien-Standard ({ site, de, en }). */
function defaultMedia() {
  return { site: defaultSite(), de: defaultMediaLocale(), en: defaultMediaLocale() };
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validiert eine Ticker-Konfiguration und normalisiert sie. */
export function validateTicker(t) {
  if (!isPlainObject(t)) throw new Error('ticker muss ein Objekt sein');
  const speed = ['slow', 'normal', 'fast'].includes(t.speed) ? t.speed : 'normal';
  if (!Array.isArray(t.items)) throw new Error('ticker.items muss ein Array sein');
  const items = t.items.map((it, i) => {
    if (!isPlainObject(it)) throw new Error(`ticker.items[${i}] ungültig`);
    if (typeof it.text !== 'string' || it.text.length === 0)
      throw new Error(`ticker.items[${i}].text fehlt`);
    // Keine Wort-/Längenbegrenzung mehr für den Laufband-Text – nur eine großzügige
    // Sicherheitsgrenze gegen versehentlich riesige Eingaben (mehrzeilig erlaubt).
    if (it.text.length > 10000) throw new Error(`ticker.items[${i}].text zu lang`);
    const out = { id: String(it.id ?? i + 1), text: it.text };
    if (it.link != null) {
      if (typeof it.link !== 'string') throw new Error(`ticker.items[${i}].link ungültig`);
      // Nur interne Pfade oder http(s)-URLs erlauben
      if (!/^(\/[^\s]*|https?:\/\/[^\s]+)$/.test(it.link))
        throw new Error(`ticker.items[${i}].link muss / oder http(s) sein`);
      out.link = it.link;
    }
    return out;
  });
  return { enabled: t.enabled === true, speed, items, style: validateTickerStyle(t.style) };
}

/** Validiert Overrides (nur Plain-Object, begrenzte Tiefe/Größe). */
export function validateOverrides(o) {
  if (!isPlainObject(o)) throw new Error('overrides muss ein Objekt sein');
  const json = JSON.stringify(o);
  if (json.length > 2 * 1024 * 1024) throw new Error('overrides zu groß');
  return o;
}

/** Erlaubt interne Pfade oder http(s)-URLs. */
function isValidMediaUrl(v) {
  return typeof v === 'string' && /^(\/[^\s]*|https?:\/\/[^\s]+)$/.test(v);
}

/** Validiert die Medien EINER Sprache; fehlende Werte fallen auf Standard zurück. */
function validateMediaLocale(m, langLabel) {
  const def = defaultMediaLocale();
  if (!isPlainObject(m)) return def;
  const sv = isPlainObject(m.sectionVideos) ? m.sectionVideos : {};
  const out = { sectionVideos: {} };
  for (const key of ['audio', 'image', 'diverse']) {
    const val = sv[key];
    if (val == null || val === '') {
      out.sectionVideos[key] = def.sectionVideos[key];
    } else if (!isValidMediaUrl(val)) {
      throw new Error(`media.${langLabel}.sectionVideos.${key} ungültig`);
    } else {
      out.sectionVideos[key] = val;
    }
  }
  // Hero-Modus: 'banner' (Einzelbild) oder 'grid' (Kachel-Raster).
  out.heroMode = m.heroMode === 'grid' ? 'grid' : 'banner';
  // Raster-Layout (Anordnung der Kacheln); Fallback auf 3 nebeneinander.
  out.heroLayout = HERO_LAYOUTS.includes(m.heroLayout) ? m.heroLayout : 'grid3';
  // Option 1 – Hero-Banner: optional. Leerer String = kein Banner; sonst gültige URL.
  out.heroBanner = '';
  if (m.heroBanner != null && m.heroBanner !== '') {
    if (!isValidMediaUrl(m.heroBanner)) throw new Error(`media.${langLabel}.heroBanner ungültig`);
    out.heroBanner = m.heroBanner;
  }
  // Verlinkung des Banners (optional): interner Pfad oder http(s). Leer = kein Link.
  out.heroBannerLink = '';
  if (m.heroBannerLink != null && m.heroBannerLink !== '') {
    if (!isValidMediaUrl(m.heroBannerLink))
      throw new Error(`media.${langLabel}.heroBannerLink muss / oder http(s) sein`);
    out.heroBannerLink = m.heroBannerLink;
  }
  // Text über dem Banner (optional) + Schriftart, Farbe, Größe, Position.
  out.heroBannerText = typeof m.heroBannerText === 'string' ? m.heroBannerText.slice(0, 120) : '';
  out.heroBannerFont = normFontFile(m.heroBannerFont);
  out.heroBannerTextColor = normHexColor(m.heroBannerTextColor, '#ffffff');
  out.heroBannerTextSize = clampNum(m.heroBannerTextSize, 0, 96, 0);
  out.heroBannerTextPos = normTextPos(m.heroBannerTextPos);
  out.heroBannerTextX = normPosPct(m.heroBannerTextX, undefined, 50);
  out.heroBannerTextY = normPosPct(m.heroBannerTextY, normTextPos(m.heroBannerTextPos), 50);
  // Textschatten (Standard: an, rückwärtskompatibel), Umriss (Kontur) und Deckkraft.
  out.heroBannerTextShadow = m.heroBannerTextShadow !== false;
  out.heroBannerTextShadowColor = normHexColor(m.heroBannerTextShadowColor, '#000000');
  out.heroBannerTextShadowX = clampNum(m.heroBannerTextShadowX, -50, 50, 0);
  out.heroBannerTextShadowY = clampNum(m.heroBannerTextShadowY, -50, 50, 2);
  out.heroBannerTextShadowBlur = clampNum(m.heroBannerTextShadowBlur, 0, 40, 6);
  out.heroBannerTextStrokeColor = normHexColor(m.heroBannerTextStrokeColor, '#000000');
  out.heroBannerTextStrokeWidth = clampHalf(m.heroBannerTextStrokeWidth, 0, 10, 0);
  out.heroBannerTextOpacity = clampNum(m.heroBannerTextOpacity, 0, 100, 100);
  // Text-Animation (zuschaltbar) + Intensität (1–10) + Tempo. Migration: die alte
  // boolean heroBannerTextPulse=true wird zu anim='pulse'.
  out.heroBannerTextAnim = BANNER_ANIM_TYPES.includes(m.heroBannerTextAnim)
    ? m.heroBannerTextAnim
    : m.heroBannerTextPulse === true
      ? 'pulse'
      : 'none';
  out.heroBannerTextAnimIntensity = clampNum(
    m.heroBannerTextAnimIntensity ?? m.heroBannerTextPulseIntensity,
    1,
    10,
    5,
  );
  out.heroBannerTextAnimSpeed = BANNER_ANIM_SPEEDS.includes(m.heroBannerTextAnimSpeed)
    ? m.heroBannerTextAnimSpeed
    : 'normal';
  // Option 2 – Hero-Raster: bis zu sechs Felder, je '' oder gültige URL.
  out.heroGrid = ['', '', '', '', '', ''];
  if (Array.isArray(m.heroGrid)) {
    for (let i = 0; i < HERO_GRID_MAX; i++) {
      const v = m.heroGrid[i];
      if (v == null || v === '') continue;
      if (!isValidMediaUrl(v)) throw new Error(`media.${langLabel}.heroGrid[${i}] ungültig`);
      out.heroGrid[i] = v;
    }
  }
  // Verlinkung der Rasterbilder (optional): interner Pfad oder http(s).
  out.heroGridLinks = ['', '', '', '', '', ''];
  if (Array.isArray(m.heroGridLinks)) {
    for (let i = 0; i < HERO_GRID_MAX; i++) {
      const v = m.heroGridLinks[i];
      if (v == null || v === '') continue;
      if (!isValidMediaUrl(v))
        throw new Error(`media.${langLabel}.heroGridLinks[${i}] muss / oder http(s) sein`);
      out.heroGridLinks[i] = v;
    }
  }
  // Per-Kachel-Design (Rahmen + Hintergrund) – genau HERO_GRID_MAX Einträge.
  out.heroGridStyles = Array.from({ length: HERO_GRID_MAX }, (_, i) =>
    validateCellStyle(Array.isArray(m.heroGridStyles) ? m.heroGridStyles[i] : null),
  );
  // „Standard für alle Kacheln": Master-Kachel-Werte gelten für alle.
  out.heroGridUniform = m.heroGridUniform === true;
  out.heroGridUniformCell = clampNum(m.heroGridUniformCell, 0, HERO_GRID_MAX - 1, 0);
  // Seitenverhältnis + Darstellung (zuschneiden vs. ganzes Bild) des Rasters.
  out.heroGridRatio = ['1:1', '16:9', '2:3'].includes(m.heroGridRatio) ? m.heroGridRatio : '1:1';
  out.heroGridFit = m.heroGridFit === 'contain' ? 'contain' : 'cover';
  // Text-Stile (Größe/Farbe/Schrift) der Slots aus dem „Texte"-Tab.
  out.textStyles = validateTextStyles(m.textStyles);
  // „Standard für alle Slots": Stil eines Slots gilt für alle.
  out.textStyleUniform = m.textStyleUniform === true;
  out.textStyleUniformKey = TEXT_STYLE_KEYS.includes(m.textStyleUniformKey)
    ? m.textStyleUniformKey
    : TEXT_STYLE_KEYS[0];
  // Hero-Design (Rahmen/Hintergrund/Buttons) – optional, mit Standard-Fallback.
  out.heroDesign = validateHeroDesign(m.heroDesign);
  // Tool-Karten-Design (Rahmen/Hintergrund je Karte) – optional, mit Standard.
  out.toolCards = validateToolCards(m.toolCards);
  // Icon-Färbung je Karte (Tab „Icons") – optional.
  out.iconTint = validateIconTint(m.iconTint);
  return out;
}

/**
 * Validiert die Medien-Konfiguration und normalisiert auf { de, en }.
 * Akzeptiert die alte, sprachunabhängige Struktur ({ sectionVideos, heroBanner })
 * und wendet sie auf beide Sprachen an.
 */
export function validateMedia(m) {
  if (!isPlainObject(m)) throw new Error('media muss ein Objekt sein');
  // Alte, flache Struktur -> auf beide Sprachen anwenden.
  if (isPlainObject(m.sectionVideos)) {
    const one = validateMediaLocale(m, 'de');
    return { site: defaultSite(), de: one, en: JSON.parse(JSON.stringify(one)) };
  }
  return {
    site: validateSite(m.site),
    de: validateMediaLocale(m.de ?? {}, 'de'),
    en: validateMediaLocale(m.en ?? {}, 'en'),
  };
}

const pretty = (obj) => JSON.stringify(obj, null, 2) + '\n';

/**
 * Speichert einen kompletten Content-Stand (Draft im Arbeitsverzeichnis;
 * noch NICHT committet — das macht publish()).
 * payload: { overrides:{de,en}, ticker:{de,en}, media }
 */
export async function saveContent(payload) {
  if (!isPlainObject(payload)) throw new Error('ungültiger Payload');
  const overrides = payload.overrides || {};
  const ticker = payload.ticker || {};

  const oDe = validateOverrides(overrides.de ?? {});
  const oEn = validateOverrides(overrides.en ?? {});
  const tDe = validateTicker(ticker.de ?? defaultTicker());
  const tEn = validateTicker(ticker.en ?? defaultTicker());
  const media = validateMedia(payload.media ?? defaultMedia());

  const p = contentPaths();
  await Promise.all([
    writeFile(p.overridesDe, pretty(oDe), 'utf8'),
    writeFile(p.overridesEn, pretty(oEn), 'utf8'),
    writeFile(p.tickerDe, pretty(tDe), 'utf8'),
    writeFile(p.tickerEn, pretty(tEn), 'utf8'),
    writeFile(p.media, pretty(media), 'utf8'),
  ]);

  return { overrides: { de: oDe, en: oEn }, ticker: { de: tDe, en: tEn }, media };
}
