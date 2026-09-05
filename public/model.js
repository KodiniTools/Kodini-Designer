// Datenmodell des Adminbereichs: der zentrale App-Zustand plus alle reinen
// Hilfsfunktionen zum Erzeugen/Normalisieren von Ticker- und Medien-Daten sowie
// Pfad-Helfer für verschachtelte Overrides. Keine DOM-/API-Abhängigkeiten.

// --- Ticker-Standard & -Normalisierung ---
export function emptyTicker() {
  return { enabled: false, speed: 'normal', items: [], style: defaultTickerStyle() };
}
// Standard-Farben des Laufbands je Modus (entsprechen dem eingebauten Aussehen in
// TickerBar.astro: Hell = Blau/Weiß, Dunkel = Navy/Hellgrau).
export function defaultTickerColors(mode) {
  return mode === 'dark'
    ? { textColor: '#e2e8f0', bgColor: '#111827', bgOpacity: 100 }
    : { textColor: '#ffffff', bgColor: '#014f99', bgOpacity: 100 };
}
export function defaultTickerStyle() {
  return {
    enabled: false,
    // Geteilte Typografie (gilt für Hell- und Dunkelmodus).
    fontSize: 14,
    fontFamily: '',
    letterSpacing: 0,
    // Farben getrennt je Modus.
    light: defaultTickerColors('light'),
    dark: defaultTickerColors('dark'),
  };
}
// Buchstabenabstand auf [-5, 20] px begrenzen, auf 0,5 gerundet.
export function clampSpacing(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(-5, Math.min(20, Math.round(n * 2) / 2)) : def;
}
// Erlaubt einen einfachen Schrift-Dateinamen oder '' (Standardschrift).
export function normFontFile(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(woff2|woff|ttf|otf)$/i.test(v)
    ? v
    : '';
}
// Laufband-Design normalisieren (aus geladener Config). Migriert die alte flache
// Struktur (Farben auf oberster Ebene, für beide Modi gleich) auf getrennte
// Farb-Sätze light/dark — verhaltensneutral (die alten Farben galten global).
export function normTickerStyle(s) {
  const d = defaultTickerStyle();
  if (!s || typeof s !== 'object') return d;
  const clamp = (v, min, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  const hex = (v, def) => (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v)) ? v : def);
  const hasSides =
    (s.light && typeof s.light === 'object') || (s.dark && typeof s.dark === 'object');
  const flat = !hasSides && (typeof s.textColor === 'string' || typeof s.bgColor === 'string') ? s : null;
  const colors = (side, def) => {
    const o = side && typeof side === 'object' ? side : flat || {};
    return {
      textColor: hex(o.textColor, def.textColor),
      bgColor: hex(o.bgColor, def.bgColor),
      bgOpacity: clamp(o.bgOpacity, 0, 100, def.bgOpacity),
    };
  };
  return {
    enabled: s.enabled === true,
    fontSize: clamp(s.fontSize, 8, 48, d.fontSize),
    fontFamily: normFontFile(s.fontFamily),
    letterSpacing: clampSpacing(s.letterSpacing, d.letterSpacing),
    light: colors(s.light, d.light),
    dark: colors(s.dark, d.dark),
  };
}
// Vollständige Ticker-Konfiguration einer Sprache normalisieren.
export function normTicker(t) {
  if (!t || typeof t !== 'object') return emptyTicker();
  return {
    enabled: t.enabled === true,
    speed: ['slow', 'normal', 'fast'].includes(t.speed) ? t.speed : 'normal',
    items: Array.isArray(t.items)
      ? t.items.map((i) => ({ id: String(i.id ?? ''), text: i.text || '', link: i.link || '' }))
      : [],
    style: normTickerStyle(t.style),
  };
}
// Hex + Deckkraft(%) -> rgba() (für Vorschau).
export function rgbaFromHex(hex, opacityPct) {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(100, Number(opacityPct) || 0)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// --- Medien-Standard & -Normalisierung ---
// Standard-Design des Hero-Bereichs, getrennt für Hell- und Dunkelmodus
// (entspricht dem jeweiligen Aussehen in global.css).
export function heroSideLight() {
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
export function heroSideDark() {
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
export function defaultHeroDesign() {
  return {
    enabled: false,
    titleFont: '', // Überschriften-Schrift (Dateiname im /fonts-Ordner)
    buttonFont: '', // Schrift der Feature-Chips + CTA
    titleLetterSpacing: 0,
    titleStrokeColor: '#000000',
    titleStrokeWidth: 0,
    buttonLetterSpacing: 0,
    buttonStrokeColor: '#000000',
    buttonStrokeWidth: 0,
    titleFontSize: 0,
    subtitleFontSize: 0,
    chipFontSize: 0,
    ctaFontSize: 0,
    light: heroSideLight(),
    dark: heroSideDark(),
  };
}
// Einen Farb-Satz (Hell/Dunkel) normalisieren.
function normHeroSide(s, def) {
  if (!s || typeof s !== 'object') return def;
  const num = (v, min, max, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
  };
  const hex = (v, d) => (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v)) ? v : d);
  return {
    borderColor: hex(s.borderColor, def.borderColor),
    borderWidth: num(s.borderWidth, 0, 8, def.borderWidth),
    bgColor: hex(s.bgColor, def.bgColor),
    bgOpacity: num(s.bgOpacity, 0, 100, def.bgOpacity),
    chipBgColor: hex(s.chipBgColor, def.chipBgColor),
    chipBgOpacity: num(s.chipBgOpacity, 0, 100, def.chipBgOpacity),
    chipTextColor: hex(s.chipTextColor, def.chipTextColor),
    chipBorderColor: hex(s.chipBorderColor, def.chipBorderColor),
    chipBorderOpacity: num(s.chipBorderOpacity, 0, 100, def.chipBorderOpacity),
    chipHoverBgColor: hex(s.chipHoverBgColor, def.chipHoverBgColor),
    chipHoverTextColor: hex(s.chipHoverTextColor, def.chipHoverTextColor),
    ctaBgColor: hex(s.ctaBgColor, def.ctaBgColor),
    ctaBgOpacity: num(s.ctaBgOpacity, 0, 100, def.ctaBgOpacity),
    ctaTextColor: hex(s.ctaTextColor, def.ctaTextColor),
    ctaBorderColor: hex(s.ctaBorderColor, def.ctaBorderColor),
    ctaBorderOpacity: num(s.ctaBorderOpacity, 0, 100, def.ctaBorderOpacity),
    ctaHoverBgColor: hex(s.ctaHoverBgColor, def.ctaHoverBgColor),
    ctaHoverTextColor: hex(s.ctaHoverTextColor, def.ctaHoverTextColor),
    titleTextColor: hex(s.titleTextColor, def.titleTextColor),
  };
}
// Geladenes Hero-Design normalisieren (getrennt Hell/Dunkel). Migriert die alte
// flache Struktur (Farben auf oberster Ebene) auf beide Modi.
export function normHeroDesign(hd) {
  if (!hd || typeof hd !== 'object') return defaultHeroDesign();
  const hasSides =
    (hd.light && typeof hd.light === 'object') || (hd.dark && typeof hd.dark === 'object');
  const flat = !hasSides && typeof hd.borderColor === 'string' ? hd : null;
  const hex = (v, d) => (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v)) ? v : d);
  const stroke = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n * 2) / 2)) : 0;
  };
  const fontSize = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.max(8, Math.min(96, Math.round(n))) : 0;
  };
  return {
    enabled: hd.enabled === true,
    titleFont: normFontFile(hd.titleFont),
    buttonFont: normFontFile(hd.buttonFont),
    titleLetterSpacing: clampSpacing(hd.titleLetterSpacing, 0),
    titleStrokeColor: hex(hd.titleStrokeColor, '#000000'),
    titleStrokeWidth: stroke(hd.titleStrokeWidth),
    buttonLetterSpacing: clampSpacing(hd.buttonLetterSpacing, 0),
    buttonStrokeColor: hex(hd.buttonStrokeColor, '#000000'),
    buttonStrokeWidth: stroke(hd.buttonStrokeWidth),
    titleFontSize: fontSize(hd.titleFontSize),
    subtitleFontSize: fontSize(hd.subtitleFontSize),
    chipFontSize: fontSize(hd.chipFontSize),
    ctaFontSize: fontSize(hd.ctaFontSize),
    light: normHeroSide(hasSides ? hd.light : flat, heroSideLight()),
    dark: normHeroSide(hasSides ? hd.dark : flat, heroSideDark()),
  };
}

// --- Tool-Karten-Design (Tab „Tool-Karten") ---
// Standard je Modus = eingebautes Aussehen aus tool-cards.css (Rahmen 1px,
// Hintergrund Weiß bzw. Navy, Radius 16px, Hover-Rahmen Blau/Gold 22 %).
export function toolCardSideLight() {
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
export function toolCardSideDark() {
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
// Typografie der Karten-Texte (Hell + Dunkel gemeinsam); 0 / '' = Standard der Seite.
export const TOOL_CARD_WEIGHTS = ['', '400', '500', '600', '700', '800'];
export const TOOL_CARD_TRANSFORMS = ['', 'none', 'uppercase', 'capitalize'];
export function defaultToolCardText() {
  return { titleFont: '', titleSize: 0, titleWeight: '', titleSpacing: 0, titleTransform: '', textFont: '', badgeSize: 0, badgeWeight: '', badgeTransform: '', openSize: 0, openWeight: '', descSize: 0 };
}
export function normToolCardText(t) {
  const d = defaultToolCardText();
  if (!t || typeof t !== 'object') return d;
  const num = (v, min, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  const half = (v, min, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n * 2) / 2)) : def;
  };
  const weight = (v) => (TOOL_CARD_WEIGHTS.includes(String(v ?? '')) ? String(v ?? '') : '');
  const transform = (v) => (TOOL_CARD_TRANSFORMS.includes(v) ? v : '');
  return {
    titleFont: normFontFile(t.titleFont),
    titleSize: num(t.titleSize, 0, 40, 0),
    titleWeight: weight(t.titleWeight),
    titleSpacing: half(t.titleSpacing, -2, 5, 0),
    titleTransform: transform(t.titleTransform),
    textFont: normFontFile(t.textFont),
    badgeSize: num(t.badgeSize, 0, 20, 0),
    badgeWeight: weight(t.badgeWeight),
    badgeTransform: transform(t.badgeTransform),
    openSize: num(t.openSize, 0, 20, 0),
    openWeight: weight(t.openWeight),
    descSize: num(t.descSize, 0, 24, 0),
  };
}
export function defaultToolCardStyle() {
  return { light: toolCardSideLight(), dark: toolCardSideDark(), text: defaultToolCardText() };
}
export function defaultToolCards() {
  return { enabled: false, default: defaultToolCardStyle(), cards: {} };
}
export const TOOL_CARD_KEY = /^(tools|imageTools|diverseTools)\.[a-zA-Z0-9_-]+$/;
// --- Icon-Färbung je Tool-Karte (Tab „Icons") ---
// light/dark = Icon-Farbe (SVG als einfarbige Maske), bg/bgDark = Kasten-
// Hintergrund; '' = unverändert (Originalfarben bzw. Standard-Kasten).
export const ICON_TINT_FIELDS = ['light', 'dark', 'bg', 'bgDark'];
function normIconTint(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const [key, t] of Object.entries(v)) {
    if (!TOOL_CARD_KEY.test(key) || !t || typeof t !== 'object') continue;
    const e = {};
    let any = false;
    for (const f of ICON_TINT_FIELDS) {
      e[f] = normHexOrEmpty(t[f]);
      if (e[f]) any = true;
    }
    if (any) out[key] = e;
  }
  return out;
}
export function getIconTint(lang, id) {
  const m = state.media[lang] || {};
  const t = (m.iconTint && m.iconTint[id]) || {};
  const out = {};
  for (const f of ICON_TINT_FIELDS) out[f] = normHexOrEmpty(t[f]);
  return out;
}
// Teilweise setzen; ein Eintrag ohne jede Farbe wird entfernt.
export function setIconTint(lang, id, patch) {
  if (!TOOL_CARD_KEY.test(id)) return;
  const m = state.media[lang];
  if (!m.iconTint || typeof m.iconTint !== 'object') m.iconTint = {};
  const cur = getIconTint(lang, id);
  for (const f of ICON_TINT_FIELDS) if (f in patch) cur[f] = normHexOrEmpty(patch[f]);
  if (ICON_TINT_FIELDS.some((f) => cur[f])) m.iconTint[id] = cur;
  else delete m.iconTint[id];
}
export const TOOL_CARD_BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'];
function normToolCardSide(s, def) {
  if (!s || typeof s !== 'object') return def;
  const hex = (v, d) => (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v)) ? v : d);
  const num = (v, min, max, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : d;
  };
  return {
    borderColor: hex(s.borderColor, def.borderColor),
    borderOpacity: num(s.borderOpacity, 0, 100, def.borderOpacity),
    borderWidth: num(s.borderWidth, 0, 8, def.borderWidth),
    borderStyle: TOOL_CARD_BORDER_STYLES.includes(s.borderStyle) ? s.borderStyle : def.borderStyle,
    borderRadius: num(s.borderRadius, 0, 40, def.borderRadius),
    bgColor: hex(s.bgColor, def.bgColor),
    bgOpacity: num(s.bgOpacity, 0, 100, def.bgOpacity),
    gradient: s.gradient === true,
    bgColor2: hex(s.bgColor2, def.bgColor2),
    gradientAngle: num(s.gradientAngle, 0, 360, def.gradientAngle),
    hoverBorderColor: hex(s.hoverBorderColor, def.hoverBorderColor),
    hoverBorderOpacity: num(s.hoverBorderOpacity, 0, 100, def.hoverBorderOpacity),
    hoverBgColor: hex(s.hoverBgColor, def.hoverBgColor),
    hoverBgOpacity: num(s.hoverBgOpacity, 0, 100, def.hoverBgOpacity),
    titleColor: normHexOrEmpty(s.titleColor),
    badgeColor: normHexOrEmpty(s.badgeColor),
    badgeBgColor: normHexOrEmpty(s.badgeBgColor),
    badgeBgOpacity: num(s.badgeBgOpacity, 0, 100, 100),
    openColor: normHexOrEmpty(s.openColor),
    descColor: normHexOrEmpty(s.descColor),
    descBgColor: normHexOrEmpty(s.descBgColor),
    bgImage: normSiteMediaUrl(s.bgImage),
    bgImageOpacity: num(s.bgImageOpacity, 0, 100, 100),
    bgImageDarken: num(s.bgImageDarken, 0, 100, 0),
  };
}
export function normToolCardStyle(st) {
  const o = st && typeof st === 'object' ? st : {};
  return {
    light: normToolCardSide(o.light, toolCardSideLight()),
    dark: normToolCardSide(o.dark, toolCardSideDark()),
    text: normToolCardText(o.text),
  };
}
// Geladenes Tool-Karten-Design normalisieren (Standard + Einzel-Designs).
export function normToolCards(tc) {
  if (!tc || typeof tc !== 'object') return defaultToolCards();
  const cards = {};
  if (tc.cards && typeof tc.cards === 'object') {
    for (const [key, val] of Object.entries(tc.cards)) {
      if (TOOL_CARD_KEY.test(key) && val && typeof val === 'object')
        cards[key] = normToolCardStyle(val);
    }
  }
  return { enabled: tc.enabled === true, default: normToolCardStyle(tc.default), cards };
}
// Sichert, dass media.<lang>.toolCards vollständig existiert, und gibt es zurück.
export function getToolCards(lang) {
  const m = state.media[lang];
  if (!m.toolCards || typeof m.toolCards !== 'object' || !m.toolCards.default || !m.toolCards.cards)
    m.toolCards = normToolCards(m.toolCards);
  return m.toolCards;
}

// Verfügbare Text-Animationen des Banner-Textes (zuschaltbar) und Tempo-Stufen.
export const BANNER_ANIM_TYPES = ['none', 'pulse', 'float', 'shake', 'wobble', 'glow'];
export const BANNER_ANIM_SPEEDS = ['slow', 'normal', 'fast'];
export function defaultMediaLocale() {
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
    heroBannerText: '', // Text über dem Einzelbanner
    heroBannerFont: '', // Schriftart des Banner-Textes (Dateiname im /fonts-Ordner)
    heroBannerTextColor: '#ffffff',
    heroBannerTextSize: 0, // px (0 = automatisch)
    heroBannerTextPos: 'center', // Alt: 'top'|'center'|'bottom' (nur noch Migration)
    heroBannerTextX: 50, // Freie Position in % (0=links, 100=rechts) – per Maus ziehbar
    heroBannerTextY: 50, // Freie Position in % (0=oben, 100=unten)
    heroBannerTextShadow: true, // Textschatten an/aus (Standard: an)
    heroBannerTextShadowColor: '#000000', // Farbe des Schattens
    heroBannerTextShadowX: 0, // Horizontaler Versatz des Schattens in px (-50–50)
    heroBannerTextShadowY: 2, // Vertikaler Versatz des Schattens in px (-50–50)
    heroBannerTextShadowBlur: 6, // Weichzeichnung des Schattens in px (0–40)
    heroBannerTextStrokeColor: '#000000', // Farbe des Umrisses (Kontur)
    heroBannerTextStrokeWidth: 0, // Dicke des Umrisses in px (0 = kein Umriss)
    heroBannerTextOpacity: 100, // Deckkraft des Textes in % (0–100)
    heroBannerTextAnim: 'none', // Animationstyp: none|pulse|float|shake|wobble|glow
    heroBannerTextAnimIntensity: 5, // Stärke der Animation (1–10)
    heroBannerTextAnimSpeed: 'normal', // Tempo: slow|normal|fast
    heroGrid: ['', '', '', '', '', ''],
    heroGridLinks: ['', '', '', '', '', ''],
    heroGridStyles: defaultCellStyles(),
    heroGridUniform: false, // „Standard für alle Kacheln" aktiv?
    heroGridUniformCell: 0, // Index der Master-Kachel, deren Werte gelten
    heroGridRatio: '1:1',
    heroGridFit: 'cover',
    textStyles: {}, // { "<textKey>": { size: px (0=auto), colorLight: Hex|'', colorDark: Hex|'', font: Datei|'' } }
    textStyleUniform: false, // „Standard für alle Slots" aktiv?
    textStyleUniformKey: 'hero.title', // Slot, dessen Stil dann für alle gilt
    heroDesign: defaultHeroDesign(),
    toolCards: defaultToolCards(), // Rahmen/Hintergrund der Tool-Karten (Tab „Tool-Karten")
    iconTint: {}, // Icon-Färbung je Karte (Tab „Icons"): { "tools.x": { light, dark, bg, bgDark } }
  };
}
// Text-Slots des „Texte"-Tabs, für die Größe/Farbe einstellbar sind.
export const TEXT_STYLE_KEYS = [
  'hero.title',
  'hero.subtitle',
  'hero.cta',
  'tools.sectionTitle',
  'imageTools.sectionTitle',
  'diverseTools.sectionTitle',
];
const textHex = (v) => (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v)) ? v : '');
const textNum = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
};
const textHalf = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n * 2) / 2)) : def;
};
export function normTextStyles(o) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const k of TEXT_STYLE_KEYS) {
    const s = o[k];
    if (!s || typeof s !== 'object') continue;
    const px = textNum(s.size, 0, 120, 0);
    const font = normFontFile(s.font);
    // Migration: altes einzelnes color gilt für beide Modi.
    const legacy = textHex(s.color);
    const colorLight = textHex(s.colorLight) || legacy;
    const colorDark = textHex(s.colorDark) || legacy;
    // Effekte (Schatten, Umriss, Deckkraft, Animation) – analog Banner-Text.
    const shadow = s.shadow === true;
    const strokeWidth = textHalf(s.strokeWidth, 0, 10, 0);
    const opacity = textNum(s.opacity, 0, 100, 100);
    const anim = BANNER_ANIM_TYPES.includes(s.anim) ? s.anim : 'none';
    const hasFx = shadow || strokeWidth > 0 || opacity < 100 || anim !== 'none';
    if (px > 0 || colorLight || colorDark || font || hasFx) {
      const entry = { size: px, colorLight, colorDark, font };
      if (hasFx) {
        entry.shadow = shadow;
        entry.shadowColor = textHex(s.shadowColor) || '#000000';
        entry.shadowX = textNum(s.shadowX, -50, 50, 0);
        entry.shadowY = textNum(s.shadowY, -50, 50, 2);
        entry.shadowBlur = textNum(s.shadowBlur, 0, 40, 6);
        entry.strokeColor = textHex(s.strokeColor) || '#000000';
        entry.strokeWidth = strokeWidth;
        entry.opacity = opacity;
        entry.anim = anim;
        entry.animIntensity = textNum(s.animIntensity, 1, 10, 5);
        entry.animSpeed = BANNER_ANIM_SPEEDS.includes(s.animSpeed) ? s.animSpeed : 'normal';
      }
      out[k] = entry;
    }
  }
  return out;
}
// Style-Objekt eines Text-Slots (legt es bei Bedarf an). Farben getrennt nach
// Hell/Dunkel; ein evtl. noch flaches color wird auf beide Modi migriert.
export function getTextStyle(lang, key) {
  const m = state.media[lang];
  if (!m.textStyles || typeof m.textStyles !== 'object') m.textStyles = {};
  if (!m.textStyles[key]) m.textStyles[key] = { size: 0, colorLight: '', colorDark: '', font: '' };
  const s = m.textStyles[key];
  if (typeof s.font !== 'string') s.font = '';
  if (typeof s.color === 'string' && s.color) {
    if (!s.colorLight) s.colorLight = s.color;
    if (!s.colorDark) s.colorDark = s.color;
    delete s.color;
  }
  if (typeof s.colorLight !== 'string') s.colorLight = '';
  if (typeof s.colorDark !== 'string') s.colorDark = '';
  // Effekt-Defaults ergänzen (für ältere Einträge ohne diese Felder). Entsprechen
  // dem „aus"-Zustand, sodass sich am Standardaussehen nichts ändert.
  if (typeof s.shadow !== 'boolean') s.shadow = false;
  if (typeof s.shadowColor !== 'string') s.shadowColor = '#000000';
  if (!Number.isFinite(s.shadowX)) s.shadowX = 0;
  if (!Number.isFinite(s.shadowY)) s.shadowY = 2;
  if (!Number.isFinite(s.shadowBlur)) s.shadowBlur = 6;
  if (typeof s.strokeColor !== 'string') s.strokeColor = '#000000';
  if (!Number.isFinite(s.strokeWidth)) s.strokeWidth = 0;
  if (!Number.isFinite(s.opacity)) s.opacity = 100;
  if (!BANNER_ANIM_TYPES.includes(s.anim)) s.anim = 'none';
  if (!Number.isFinite(s.animIntensity)) s.animIntensity = 5;
  if (!BANNER_ANIM_SPEEDS.includes(s.animSpeed)) s.animSpeed = 'normal';
  return s;
}
// Effektiver Stil eines Text-Slots: bei aktivem „Standard für alle Slots"
// gelten die Werte des gewählten Slots für alle (Größe, Farbe, Schriftart).
export function getEffectiveTextStyle(lang, key) {
  const m = state.media[lang];
  const own = getTextStyle(lang, key);
  if (!m.textStyleUniform) return own;
  return { ...getTextStyle(lang, m.textStyleUniformKey || TEXT_STYLE_KEYS[0]) };
}
// Empfohlene Bildabmessungen je Seitenverhältnis (crisp bei ~3-spaltiger Anzeige).
export const GRID_DIMS = { '1:1': '800 × 800 px', '16:9': '800 × 450 px', '2:3': '800 × 1200 px' };
// Verfügbare Hero-Raster-Layouts (Anordnung der Kacheln). `cells` = Anzahl der
// Bild-Plätze. 'mosaic' = eine große Kachel links + zwei kleine rechts.
export const HERO_LAYOUTS = {
  grid2: { label: '2 nebeneinander', cells: 2 },
  grid3: { label: '3 nebeneinander', cells: 3 },
  row4: { label: '4 nebeneinander', cells: 4 },
  grid4: { label: '4 im 2×2-Raster', cells: 4 },
  grid6: { label: '6 im 3×2-Raster', cells: 6 },
  big2: { label: '2 große nebeneinander', cells: 2 },
  vrow: { label: 'Vertikale Reihe', cells: 3 },
  mosaic: { label: 'Mosaik (1 groß + 2 klein)', cells: 3 },
};
export const HERO_GRID_MAX = 6; // größtmögliche Kachelzahl über alle Layouts
export function heroLayoutCells(layout) {
  return (HERO_LAYOUTS[layout] || HERO_LAYOUTS.grid3).cells;
}
function normHeroLayout(v) {
  return Object.prototype.hasOwnProperty.call(HERO_LAYOUTS, v) ? v : 'grid3';
}

// Per-Kachel-Design (Rahmen + Hintergrund + optionaler Text/Schrift). Standard
// entspricht dem bisherigen Aussehen: kein Rahmen, leicht bläulicher Hintergrund.
export function defaultCellStyle() {
  return {
    borderColor: '#014f99',
    borderWidth: 0,
    bgColor: '#014f99',
    bgOpacity: 8,
    text: '', // Standardtext über dem Bild / im leeren Kasten
    font: '', // Schriftart des Textes (Dateiname im /fonts-Ordner; leer = Standard)
    textColor: '#ffffff', // Farbe des Textes
    textSize: 0, // Schriftgröße in px (0 = automatisch)
    textPos: 'center', // Alt: 'top'|'center'|'bottom' (nur noch Migration)
    textX: 50, // Freie Position in % (0=links, 100=rechts) – per Maus ziehbar
    textY: 50, // Freie Position in % (0=oben, 100=unten)
    // Bildbearbeitung des Kachel-Mediums (Layout-Tab): Deckkraft (%), Abdunkelung (%),
    // Weichzeichner (px) und Sättigung (%; 100 = Original, 0 = Graustufen).
    imgOpacity: 100,
    imgDarken: 0,
    imgBlur: 0,
    imgSaturate: 100,
  };
}
// Grenzen der Bildbearbeitung je Feld (min, max) – auch für die Slider im Layout-Tab.
export const CELL_IMG_FIELDS = {
  imgOpacity: { min: 0, max: 100, label: 'Deckkraft', unit: '%' },
  imgDarken: { min: 0, max: 100, label: 'Abdunkelung', unit: '%' },
  imgBlur: { min: 0, max: 20, label: 'Weichzeichner', unit: 'px' },
  imgSaturate: { min: 0, max: 200, label: 'Sättigung', unit: '%' },
};
// Erlaubte Text-Positionen im Overlay (Alt-Format, nur noch für Migration).
export function normTextPos(v) {
  return ['top', 'center', 'bottom'].includes(v) ? v : 'center';
}
// Freie Position (0–100 %). Fehlt sie, wird sie aus der alten top/center/bottom-
// Angabe abgeleitet, damit bestehende Layouts erhalten bleiben.
export function normPosPct(v, legacyPos, axisDefault) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  return { top: 10, center: 50, bottom: 90 }[legacyPos] ?? axisDefault;
}
export function defaultCellStyles() {
  return Array.from({ length: HERO_GRID_MAX }, () => defaultCellStyle());
}
function normCellStyle(s) {
  const d = defaultCellStyle();
  if (!s || typeof s !== 'object') return d;
  const hex = (v, def) => (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v)) ? v : def);
  const num = (v, min, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  return {
    borderColor: hex(s.borderColor, d.borderColor),
    borderWidth: num(s.borderWidth, 0, 20, d.borderWidth),
    bgColor: hex(s.bgColor, d.bgColor),
    bgOpacity: num(s.bgOpacity, 0, 100, d.bgOpacity),
    text: typeof s.text === 'string' ? s.text.slice(0, 120) : '',
    font: normFontFile(s.font),
    textColor: hex(s.textColor, d.textColor),
    textSize: num(s.textSize, 0, 96, d.textSize),
    textPos: normTextPos(s.textPos),
    textX: normPosPct(s.textX, undefined, 50),
    textY: normPosPct(s.textY, normTextPos(s.textPos), 50),
    imgOpacity: num(s.imgOpacity, 0, 100, d.imgOpacity),
    imgDarken: num(s.imgDarken, 0, 100, d.imgDarken),
    imgBlur: num(s.imgBlur, 0, 20, d.imgBlur),
    imgSaturate: num(s.imgSaturate, 0, 200, d.imgSaturate),
  };
}
export function normCellStyles(arr) {
  return Array.from({ length: HERO_GRID_MAX }, (_, i) =>
    normCellStyle(Array.isArray(arr) ? arr[i] : null),
  );
}
// Sichert, dass heroGridStyles existiert und gibt das Style-Objekt der Kachel i.
export function getCellStyle(lang, i) {
  const m = state.media[lang];
  if (!Array.isArray(m.heroGridStyles)) m.heroGridStyles = defaultCellStyles();
  if (!m.heroGridStyles[i]) m.heroGridStyles[i] = defaultCellStyle();
  return m.heroGridStyles[i];
}
// Eigenschaften, die „Standard für alle Kacheln" von der Master-Kachel übernimmt.
export const CELL_SYNC_PROPS = [
  'borderColor',
  'borderWidth',
  'bgColor',
  'bgOpacity',
  'font',
  'textSize',
  'textColor',
  'textX',
  'textY',
  'imgOpacity',
  'imgDarken',
  'imgBlur',
  'imgSaturate',
];
// Effektiver Style der Kachel i: bei aktivem „Standard für alle Kacheln" werden
// die synchronisierten Eigenschaften von der Master-Kachel übernommen; der
// eigene Text (und das Bild) bleiben je Kachel erhalten.
export function getEffectiveCellStyle(lang, i) {
  const m = state.media[lang];
  const base = getCellStyle(lang, i);
  if (!m.heroGridUniform) return base;
  const master = getCellStyle(lang, m.heroGridUniformCell || 0);
  const out = { ...base };
  for (const p of CELL_SYNC_PROPS) out[p] = master[p];
  return out;
}
// Hex-Farbe (#rgb oder #rrggbb) oder '' (= Standard/keine eigene Farbe).
export function normHexOrEmpty(v) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v)) ? v : '';
}
// Globale (sprachübergreifende) Seiten-Einstellungen. globalFont = Basis-
// Schriftart der ganzen Seite (Dateiname im /fonts-Ordner; leer = Standard).
// bgColor/bgColorDark = Seiten-Hintergrundfarbe für Hell-/Dunkelmodus
// (leer = Standardfarbe des jeweiligen Modus).
// bgOpacity*: Deckkraft (0–100 %) über der Standardfarbe; bgGradient*/bgColor2*/
// bgGradientType*/bgAngle*: optionaler Farbverlauf je Modus (Suffix Dark = Dunkel).
export function defaultSite() {
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
    // Muster je Modus: 'none' | 'dots' | 'grid' mit Farbe, Abstand (px),
    // Stärke (px) und Deckkraft (%).
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
    // Hintergrundbild je Modus (URL; leer = keins) mit Abdunkelung (%),
    // Weichzeichner (px), Deckkraft (%) und fixierter Position beim Scrollen.
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
    // Abgesetzte Tool-Sektionen (Audio/Bild/Diverse): style 'band' (volle
    // Breite) | 'card' (abgerundet in der Sektion); je Sektion Hell/Dunkel mit
    // Tönung (color '' = keine, opacity %) und optionalem Bild.
    sections: defaultSections(),
  };
}
export const SITE_SECTION_KEYS = ['audio', 'image', 'diverse'];
export const SECTION_LABELS = { audio: 'Audio-Tools', image: 'Bild-Tools', diverse: 'Diverse Tools' };
export const SECTION_STYLES = ['band', 'card'];
export function defaultSectionSide() {
  return { color: '', opacity: 8, image: '', imageDarken: 0, imageBlur: 0, imageOpacity: 100 };
}
export const SECTION_GAP_MAX = 160;
export function defaultSections() {
  const o = { style: 'band', gap: 0 };
  for (const k of SITE_SECTION_KEYS) o[k] = { light: defaultSectionSide(), dark: defaultSectionSide() };
  return o;
}
function normGap(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(SECTION_GAP_MAX, Math.round(n))) : 0;
}
function normSectionSide(v) {
  const d = defaultSectionSide();
  if (!v || typeof v !== 'object') return d;
  const num = (x, min, max, def) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  return {
    color: normHexOrEmpty(v.color),
    opacity: num(v.opacity, 0, 100, 8),
    image: normSiteMediaUrl(v.image),
    imageDarken: num(v.imageDarken, 0, 100, 0),
    imageBlur: num(v.imageBlur, 0, 40, 0),
    imageOpacity: num(v.imageOpacity, 0, 100, 100),
  };
}
export function normSections(v) {
  const o = defaultSections();
  if (!v || typeof v !== 'object') return o;
  o.style = SECTION_STYLES.includes(v.style) ? v.style : 'band';
  o.gap = normGap(v.gap);
  for (const k of SITE_SECTION_KEYS) {
    const c = v[k] && typeof v[k] === 'object' ? v[k] : {};
    o[k] = { light: normSectionSide(c.light), dark: normSectionSide(c.dark) };
  }
  return o;
}
export const SITE_GRADIENT_TYPES = ['linear', 'radial'];
export const SITE_PATTERNS = ['none', 'dots', 'grid'];
// Bild-Felder in media.site (Hintergrundbild Hell/Dunkel) – können wie die
// Sprach-Slots eine gestagte Datei ('staged:<id>') referenzieren.
export const SITE_MEDIA_KEYS = ['bgImage', 'bgImageDark'];
const SITE_MEDIA_URL = /^(\/[^\s"'()\\]*|https?:\/\/[^\s"'()\\]+|staged:[\w-]+)$/;
export function normSiteMediaUrl(v) {
  const t = String(v ?? '').trim();
  return SITE_MEDIA_URL.test(t) ? t : '';
}
// Effekt-Schlüssel (Feldpräfix in media.site) mit Beschriftung.
export const SITE_FX = [
  { key: 'fxAurora', label: 'Aurora-Farbflecken' },
  { key: 'fxNoise', label: 'Feines Rauschen' },
  { key: 'fxSpotlight', label: 'Maus-Spotlight' },
];
export function normSite(s) {
  if (!s || typeof s !== 'object') return defaultSite();
  const num = (v, min, max, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : d;
  };
  const gtype = (v) => (SITE_GRADIENT_TYPES.includes(v) ? v : 'linear');
  const pat = (v) => (SITE_PATTERNS.includes(v) ? v : 'none');
  return {
    globalFont: normFontFile(s.globalFont),
    bgColor: normHexOrEmpty(s.bgColor),
    bgColorDark: normHexOrEmpty(s.bgColorDark),
    bgOpacity: num(s.bgOpacity, 0, 100, 100),
    bgOpacityDark: num(s.bgOpacityDark, 0, 100, 100),
    bgGradient: s.bgGradient === true,
    bgGradientDark: s.bgGradientDark === true,
    bgColor2: normHexOrEmpty(s.bgColor2),
    bgColor2Dark: normHexOrEmpty(s.bgColor2Dark),
    bgGradientType: gtype(s.bgGradientType),
    bgGradientTypeDark: gtype(s.bgGradientTypeDark),
    bgAngle: num(s.bgAngle, 0, 360, 180),
    bgAngleDark: num(s.bgAngleDark, 0, 360, 180),
    fxAurora: s.fxAurora === true,
    fxAuroraIntensity: num(s.fxAuroraIntensity, 0, 100, 50),
    fxNoise: s.fxNoise === true,
    fxNoiseIntensity: num(s.fxNoiseIntensity, 0, 100, 50),
    fxSpotlight: s.fxSpotlight === true,
    fxSpotlightIntensity: num(s.fxSpotlightIntensity, 0, 100, 50),
    bgPattern: pat(s.bgPattern),
    bgPatternDark: pat(s.bgPatternDark),
    bgPatternColor: normHexOrEmpty(s.bgPatternColor) || '#014f99',
    bgPatternColorDark: normHexOrEmpty(s.bgPatternColorDark) || '#e8a945',
    bgPatternSpacing: num(s.bgPatternSpacing, 4, 200, 24),
    bgPatternSpacingDark: num(s.bgPatternSpacingDark, 4, 200, 24),
    bgPatternThickness: num(s.bgPatternThickness, 1, 6, 1),
    bgPatternThicknessDark: num(s.bgPatternThicknessDark, 1, 6, 1),
    bgPatternOpacity: num(s.bgPatternOpacity, 0, 100, 12),
    bgPatternOpacityDark: num(s.bgPatternOpacityDark, 0, 100, 12),
    bgImage: normSiteMediaUrl(s.bgImage),
    bgImageDark: normSiteMediaUrl(s.bgImageDark),
    bgImageDarken: num(s.bgImageDarken, 0, 100, 0),
    bgImageDarkenDark: num(s.bgImageDarkenDark, 0, 100, 0),
    bgImageBlur: num(s.bgImageBlur, 0, 40, 0),
    bgImageBlurDark: num(s.bgImageBlurDark, 0, 40, 0),
    bgImageOpacity: num(s.bgImageOpacity, 0, 100, 100),
    bgImageOpacityDark: num(s.bgImageOpacityDark, 0, 100, 100),
    bgImageFixed: s.bgImageFixed !== false,
    bgImageFixedDark: s.bgImageFixedDark !== false,
    sections: normSections(s.sections),
  };
}
// Seiten-Hintergrund eines Modus als CSS-background-Wert – identisch zur
// Berechnung auf der Seite (content.ts getSiteBackgroundStyle): eigene Farbe
// bzw. Verlauf mit Deckkraft ÜBER der Standardfarbe. Für alle Admin-Vorschauen
// (Hintergrund-Tab, Tool-Karten), damit sie das gleiche Ergebnis zeigen.
export function siteBgLayerCss(mode) {
  const s = getSiteBg(mode);
  const base = PAGE_BG_DEFAULT[mode];
  const layers = sitePatternLayers(s);
  let ground = base;
  if (s.color) {
    const c1 = rgbaFromHex(s.color, s.opacity);
    if (s.gradient && s.color2) {
      const c2 = rgbaFromHex(s.color2, s.opacity);
      layers.push(
        s.type === 'radial'
          ? `radial-gradient(ellipse at 50% 0%, ${c1}, ${c2})`
          : `linear-gradient(${s.angle}deg, ${c1}, ${c2})`,
      );
    } else if (s.opacity >= 100) ground = s.color;
    else layers.push(`linear-gradient(${c1}, ${c1})`);
  }
  return layers.length ? `${layers.join(', ')}, ${ground}` : ground;
}
// Muster-Ebenen (Punktraster / Gitter) als background-Einträge – identisch zu
// content.ts sitePatternLayers. Leer bei 'none'.
export function sitePatternLayers(s) {
  if ((s.pattern !== 'dots' && s.pattern !== 'grid') || !s.patternColor) return [];
  const c = rgbaFromHex(s.patternColor, s.patternOpacity);
  const t = s.patternThickness;
  const size = `${s.patternSpacing}px ${s.patternSpacing}px`;
  if (s.pattern === 'dots')
    return [`radial-gradient(circle, ${c} ${t}px, transparent ${t + 0.5}px) 0 0 / ${size} repeat`];
  return [
    `linear-gradient(${c} ${t}px, transparent ${t}px) 0 0 / ${size} repeat`,
    `linear-gradient(90deg, ${c} ${t}px, transparent ${t}px) 0 0 / ${size} repeat`,
  ];
}
// Bild-Ebene eines Modus für die Admin-Vorschau: null ohne Bild, sonst
// { url, filter, opacity, fixed } (url = auflösbare Vorschau-URL, staged via objUrl).
export function siteBgImageLayer(mode, resolveUrl) {
  const s = getSiteBg(mode);
  if (!s.image) return null;
  const url = resolveUrl ? resolveUrl(s.image) : s.image;
  if (!url) return null;
  const f = [];
  if (s.imageBlur > 0) f.push(`blur(${s.imageBlur}px)`);
  if (s.imageDarken > 0) f.push(`brightness(${(1 - s.imageDarken / 100).toFixed(3)})`);
  return { url, filter: f.join(' ') || 'none', opacity: s.imageOpacity / 100, fixed: s.imageFixed };
}
// Effekt lesen: { on, intensity } für key aus SITE_FX.
export function getSiteFx(key) {
  const s = siteObj();
  return { on: s[key] === true, intensity: s[`${key}Intensity`] };
}
// Effekt setzen (Teilobjekt { on?, intensity? }).
export function setSiteFx(key, patch) {
  const s = siteObj();
  if ('on' in patch) s[key] = patch.on === true;
  if ('intensity' in patch) {
    const n = Number(patch.intensity);
    s[`${key}Intensity`] = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
  }
}
// Sichert, dass media.site vollständig (mit allen Feldern) vorliegt.
function siteObj() {
  if (!state.media.site || typeof state.media.site !== 'object') state.media.site = defaultSite();
  const s = state.media.site;
  const d = defaultSite();
  for (const k of Object.keys(d)) if (!(k in s)) s[k] = d[k];
  return s;
}
// Hintergrund-Einstellungen eines Modus als einheitliches Objekt
// { color, opacity, gradient, color2, type, angle } (color '' = Standard).
export function getSiteBg(mode) {
  const s = siteObj();
  const k = (key) => (mode === 'dark' ? key + 'Dark' : key);
  return {
    color: s[k('bgColor')] || '',
    opacity: s[k('bgOpacity')],
    gradient: s[k('bgGradient')] === true,
    color2: s[k('bgColor2')] || '',
    type: s[k('bgGradientType')],
    angle: s[k('bgAngle')],
    pattern: s[k('bgPattern')],
    patternColor: s[k('bgPatternColor')] || '',
    patternSpacing: s[k('bgPatternSpacing')],
    patternThickness: s[k('bgPatternThickness')],
    patternOpacity: s[k('bgPatternOpacity')],
    image: s[k('bgImage')] || '',
    imageDarken: s[k('bgImageDarken')],
    imageBlur: s[k('bgImageBlur')],
    imageOpacity: s[k('bgImageOpacity')],
    imageFixed: s[k('bgImageFixed')] !== false,
  };
}
// Teilweise setzen (nur übergebene Felder), Werte werden normalisiert.
export function setSiteBg(mode, patch) {
  const s = siteObj();
  const k = (key) => (mode === 'dark' ? key + 'Dark' : key);
  const num = (v, min, max, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : d;
  };
  if ('color' in patch) s[k('bgColor')] = normHexOrEmpty(patch.color);
  if ('opacity' in patch) s[k('bgOpacity')] = num(patch.opacity, 0, 100, 100);
  if ('gradient' in patch) s[k('bgGradient')] = patch.gradient === true;
  if ('color2' in patch) s[k('bgColor2')] = normHexOrEmpty(patch.color2);
  if ('type' in patch)
    s[k('bgGradientType')] = SITE_GRADIENT_TYPES.includes(patch.type) ? patch.type : 'linear';
  if ('angle' in patch) s[k('bgAngle')] = num(patch.angle, 0, 360, 180);
  if ('pattern' in patch)
    s[k('bgPattern')] = SITE_PATTERNS.includes(patch.pattern) ? patch.pattern : 'none';
  if ('patternColor' in patch) {
    const d = mode === 'dark' ? '#e8a945' : '#014f99';
    s[k('bgPatternColor')] = normHexOrEmpty(patch.patternColor) || d;
  }
  if ('patternSpacing' in patch) s[k('bgPatternSpacing')] = num(patch.patternSpacing, 4, 200, 24);
  if ('patternThickness' in patch)
    s[k('bgPatternThickness')] = num(patch.patternThickness, 1, 6, 1);
  if ('patternOpacity' in patch) s[k('bgPatternOpacity')] = num(patch.patternOpacity, 0, 100, 12);
  if ('image' in patch) s[k('bgImage')] = normSiteMediaUrl(patch.image);
  if ('imageDarken' in patch) s[k('bgImageDarken')] = num(patch.imageDarken, 0, 100, 0);
  if ('imageBlur' in patch) s[k('bgImageBlur')] = num(patch.imageBlur, 0, 40, 0);
  if ('imageOpacity' in patch) s[k('bgImageOpacity')] = num(patch.imageOpacity, 0, 100, 100);
  if ('imageFixed' in patch) s[k('bgImageFixed')] = patch.imageFixed !== false;
}
// Bild-Feld in media.site lesen/setzen (key aus SITE_MEDIA_KEYS).
export function getSiteMediaVal(key) {
  return SITE_MEDIA_KEYS.includes(key) ? siteObj()[key] || '' : '';
}
export function setSiteMediaVal(key, val) {
  if (SITE_MEDIA_KEYS.includes(key)) siteObj()[key] = normSiteMediaUrl(val);
}
// Sichert die vollständige Sektions-Struktur in media.site.sections.
function sectionsObj() {
  const s = siteObj();
  if (!s.sections || typeof s.sections !== 'object') s.sections = defaultSections();
  const o = s.sections;
  if (!SECTION_STYLES.includes(o.style)) o.style = 'band';
  o.gap = normGap(o.gap);
  for (const k of SITE_SECTION_KEYS) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    for (const mode of ['light', 'dark']) {
      if (!o[k][mode] || typeof o[k][mode] !== 'object') o[k][mode] = defaultSectionSide();
      const d = defaultSectionSide();
      for (const f of Object.keys(d)) if (!(f in o[k][mode])) o[k][mode][f] = d[f];
    }
  }
  return o;
}
export function getSectionStyle() {
  return sectionsObj().style;
}
export function setSectionStyle(v) {
  sectionsObj().style = SECTION_STYLES.includes(v) ? v : 'band';
}
// Abstand zwischen abgesetzten Sektionen (px, 0–SECTION_GAP_MAX).
export function getSectionGap() {
  return sectionsObj().gap;
}
export function setSectionGap(v) {
  sectionsObj().gap = normGap(v);
}
// Einstellungen einer Sektion (key aus SITE_SECTION_KEYS) für einen Modus.
export function getSiteSection(key, mode) {
  return { ...sectionsObj()[key][mode] };
}
// Teilweise setzen (nur übergebene Felder), Werte werden normalisiert.
export function setSiteSection(key, mode, patch) {
  if (!SITE_SECTION_KEYS.includes(key)) return;
  const side = sectionsObj()[key][mode];
  const num = (v, min, max, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : d;
  };
  if ('color' in patch) side.color = normHexOrEmpty(patch.color);
  if ('opacity' in patch) side.opacity = num(patch.opacity, 0, 100, 8);
  if ('image' in patch) side.image = normSiteMediaUrl(patch.image);
  if ('imageDarken' in patch) side.imageDarken = num(patch.imageDarken, 0, 100, 0);
  if ('imageBlur' in patch) side.imageBlur = num(patch.imageBlur, 0, 40, 0);
  if ('imageOpacity' in patch) side.imageOpacity = num(patch.imageOpacity, 0, 100, 100);
}
// Alle Bild-Plätze in media.site (Seiten-Hintergrund + Sektionen) als
// { path, label, get(), set(v) } – für Upload beim Veröffentlichen, Auflösen
// von staged:-Referenzen und „wird verwendet in" der Mediathek.
export function siteImageSlots() {
  const modeLabel = (m) => (m === 'dark' ? 'Dunkel' : 'Hell');
  const slots = SITE_MEDIA_KEYS.map((key) => ({
    root: 'site',
    xLang: 'shared',
    path: [key],
    label: `Global · Seiten-Hintergrund (${modeLabel(key.endsWith('Dark') ? 'dark' : 'light')})`,
  }));
  for (const k of SITE_SECTION_KEYS)
    for (const mode of ['light', 'dark'])
      slots.push({
        root: 'site',
        xLang: 'shared',
        path: ['sections', k, mode, 'image'],
        label: `Global · Sektion ${SECTION_LABELS[k]} (${modeLabel(mode)})`,
      });
  for (const slot of slots) {
    slot.get = () => {
      sectionsObj();
      const v = getPath(siteObj(), slot.path);
      return typeof v === 'string' ? v : '';
    };
    slot.set = (v) => {
      sectionsObj();
      setPath(siteObj(), slot.path, normSiteMediaUrl(v));
    };
  }
  return slots;
}
// Bild-Plätze der Tool-Karten (Hintergrundbild je Karte/Modus, beide Sprachen):
// { root: 'de'|'en', xLang, path, label, get(), set(v) } – Upload in den
// Ordner der Sprache.
export function toolCardImageSlots() {
  const modeLabel = (m) => (m === 'dark' ? 'Dunkel' : 'Hell');
  const slots = [];
  for (const lang of MEDIA_LANGS) {
    const tc = state.media[lang] && state.media[lang].toolCards;
    if (!tc || typeof tc !== 'object') continue;
    const entries = [['default', 'Standard (alle Karten)']];
    for (const id of Object.keys(tc.cards && typeof tc.cards === 'object' ? tc.cards : {}))
      entries.push([id, id]);
    for (const [id, name] of entries)
      for (const mode of ['light', 'dark']) {
        const path =
          id === 'default'
            ? ['toolCards', 'default', mode, 'bgImage']
            : ['toolCards', 'cards', id, mode, 'bgImage'];
        slots.push({
          root: lang,
          xLang: lang,
          path,
          label: `${lang.toUpperCase()} · Tool-Karte ${name} (${modeLabel(mode)})`,
        });
      }
  }
  for (const slot of slots) {
    slot.get = () => {
      const v = getPath(state.media[slot.root], slot.path);
      return typeof v === 'string' ? v : '';
    };
    slot.set = (v) => setPath(state.media[slot.root], slot.path, normSiteMediaUrl(v));
  }
  return slots;
}
// Alle Bild-Plätze außerhalb der Sprach-Slots (Seite + Tool-Karten).
export function allImageSlots() {
  return [...siteImageSlots(), ...toolCardImageSlots()];
}
// Standard-Hintergrundfarben je Modus (identisch zu global.css --bg-color).
export const PAGE_BG_DEFAULT = { light: '#fafafa', dark: '#091428' };
// Seiten-Hintergrundfarbe (global) lesen. mode: 'light' | 'dark'. '' = Standard.
export function getPageBg(mode) {
  if (!state.media.site || typeof state.media.site !== 'object') state.media.site = defaultSite();
  return (mode === 'dark' ? state.media.site.bgColorDark : state.media.site.bgColor) || '';
}
// Seiten-Hintergrundfarbe (global) setzen ('' = Standard des Modus).
export function setPageBg(mode, val) {
  if (!state.media.site || typeof state.media.site !== 'object') state.media.site = defaultSite();
  const hex = normHexOrEmpty(val);
  if (mode === 'dark') state.media.site.bgColorDark = hex;
  else state.media.site.bgColor = hex;
}
// Medien werden pro Sprache getrennt gepflegt, plus globale site-Einstellungen:
// { site: {...}, de: {...}, en: {...} }.
export function defaultMedia() {
  return { site: defaultSite(), de: defaultMediaLocale(), en: defaultMediaLocale() };
}
// Aktuell gesetzte globale Basis-Schrift (Dateiname oder '').
export function getGlobalFont() {
  if (!state.media.site || typeof state.media.site !== 'object') state.media.site = defaultSite();
  return state.media.site.globalFont || '';
}
// Globale Basis-Schrift setzen ('' = Standard).
export function setGlobalFont(file) {
  if (!state.media.site || typeof state.media.site !== 'object') state.media.site = defaultSite();
  state.media.site.globalFont = normFontFile(file);
}

// Normalisiert einen geladenen Medien-Stand auf { de, en }. Akzeptiert auch die
// alte, sprachunabhängige Struktur ({ sectionVideos, heroBanner }) und wendet
// sie auf beide Sprachen an.
export function normalizeMedia(m) {
  const mk = (o) => {
    const d = defaultMediaLocale();
    const sv = o && typeof o.sectionVideos === 'object' && o.sectionVideos ? o.sectionVideos : {};
    const grid = Array.isArray(o?.heroGrid) ? o.heroGrid : [];
    const gridLinks = Array.isArray(o?.heroGridLinks) ? o.heroGridLinks : [];
    return {
      sectionVideos: {
        audio: sv.audio || d.sectionVideos.audio,
        image: sv.image || d.sectionVideos.image,
        diverse: sv.diverse || d.sectionVideos.diverse,
      },
      heroMode: o && o.heroMode === 'grid' ? 'grid' : 'banner',
      heroLayout: normHeroLayout(o?.heroLayout),
      heroBanner: o && typeof o.heroBanner === 'string' ? o.heroBanner : '',
      heroBannerLink: o && typeof o.heroBannerLink === 'string' ? o.heroBannerLink : '',
      heroBannerText: typeof o?.heroBannerText === 'string' ? o.heroBannerText.slice(0, 120) : '',
      heroBannerFont: normFontFile(o?.heroBannerFont),
      heroBannerTextColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(o?.heroBannerTextColor))
        ? o.heroBannerTextColor
        : '#ffffff',
      heroBannerTextSize: Number.isFinite(Number(o?.heroBannerTextSize))
        ? Math.max(0, Math.min(96, Math.round(Number(o.heroBannerTextSize))))
        : 0,
      heroBannerTextPos: normTextPos(o?.heroBannerTextPos),
      heroBannerTextX: normPosPct(o?.heroBannerTextX, undefined, 50),
      heroBannerTextY: normPosPct(o?.heroBannerTextY, normTextPos(o?.heroBannerTextPos), 50),
      // Textschatten (Standard: an, rückwärtskompatibel), Umriss (Kontur), Deckkraft.
      heroBannerTextShadow: o?.heroBannerTextShadow !== false,
      heroBannerTextShadowColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
        String(o?.heroBannerTextShadowColor),
      )
        ? o.heroBannerTextShadowColor
        : '#000000',
      heroBannerTextShadowX: Number.isFinite(Number(o?.heroBannerTextShadowX))
        ? Math.max(-50, Math.min(50, Math.round(Number(o.heroBannerTextShadowX))))
        : 0,
      heroBannerTextShadowY: Number.isFinite(Number(o?.heroBannerTextShadowY))
        ? Math.max(-50, Math.min(50, Math.round(Number(o.heroBannerTextShadowY))))
        : 2,
      heroBannerTextShadowBlur: Number.isFinite(Number(o?.heroBannerTextShadowBlur))
        ? Math.max(0, Math.min(40, Math.round(Number(o.heroBannerTextShadowBlur))))
        : 6,
      heroBannerTextStrokeColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
        String(o?.heroBannerTextStrokeColor),
      )
        ? o.heroBannerTextStrokeColor
        : '#000000',
      heroBannerTextStrokeWidth: Number.isFinite(Number(o?.heroBannerTextStrokeWidth))
        ? Math.max(0, Math.min(10, Math.round(Number(o.heroBannerTextStrokeWidth) * 2) / 2))
        : 0,
      heroBannerTextOpacity: Number.isFinite(Number(o?.heroBannerTextOpacity))
        ? Math.max(0, Math.min(100, Math.round(Number(o.heroBannerTextOpacity))))
        : 100,
      // Animationstyp (Migration: alte boolean heroBannerTextPulse -> 'pulse').
      heroBannerTextAnim: BANNER_ANIM_TYPES.includes(o?.heroBannerTextAnim)
        ? o.heroBannerTextAnim
        : o?.heroBannerTextPulse === true
          ? 'pulse'
          : 'none',
      heroBannerTextAnimIntensity: Number.isFinite(
        Number(o?.heroBannerTextAnimIntensity ?? o?.heroBannerTextPulseIntensity),
      )
        ? Math.max(
            1,
            Math.min(
              10,
              Math.round(Number(o.heroBannerTextAnimIntensity ?? o.heroBannerTextPulseIntensity)),
            ),
          )
        : 5,
      heroBannerTextAnimSpeed: BANNER_ANIM_SPEEDS.includes(o?.heroBannerTextAnimSpeed)
        ? o.heroBannerTextAnimSpeed
        : 'normal',
      heroGrid: [0, 1, 2, 3, 4, 5].map((i) => (typeof grid[i] === 'string' ? grid[i] : '')),
      heroGridLinks: [0, 1, 2, 3, 4, 5].map((i) =>
        typeof gridLinks[i] === 'string' ? gridLinks[i] : '',
      ),
      heroGridStyles: normCellStyles(o?.heroGridStyles),
      heroGridUniform: o?.heroGridUniform === true,
      heroGridUniformCell: Number.isFinite(Number(o?.heroGridUniformCell))
        ? Math.max(0, Math.min(HERO_GRID_MAX - 1, Math.round(Number(o.heroGridUniformCell))))
        : 0,
      heroGridRatio: ['1:1', '16:9', '2:3'].includes(o?.heroGridRatio) ? o.heroGridRatio : '1:1',
      heroGridFit: o?.heroGridFit === 'contain' ? 'contain' : 'cover',
      textStyles: normTextStyles(o?.textStyles),
      textStyleUniform: o?.textStyleUniform === true,
      textStyleUniformKey: TEXT_STYLE_KEYS.includes(o?.textStyleUniformKey)
        ? o.textStyleUniformKey
        : TEXT_STYLE_KEYS[0],
      heroDesign: normHeroDesign(o?.heroDesign),
      toolCards: normToolCards(o?.toolCards),
      iconTint: normIconTint(o?.iconTint),
    };
  };
  if (m && typeof m === 'object' && m.sectionVideos)
    return { site: defaultSite(), de: mk(m), en: mk(m) };
  const src = m && typeof m === 'object' ? m : {};
  return { site: normSite(src.site), de: mk(src.de), en: mk(src.en) };
}

// Sprachen + Slots. 'heroBanner' liegt auf oberster Ebene der Sprache, die
// anderen unter sectionVideos.
export const MEDIA_LANGS = ['de', 'en'];
// Slot-Schlüssel: Sektions-Videos, Einzel-Banner und die sechs Rasterbilder.
export const MEDIA_KEYS = [
  'audio',
  'image',
  'diverse',
  'heroBanner',
  'grid0',
  'grid1',
  'grid2',
  'grid3',
  'grid4',
  'grid5',
];
export function getMediaVal(lang, key) {
  if (key === 'heroBanner') return state.media[lang].heroBanner || '';
  const g = /^grid([0-5])$/.exec(key);
  if (g) return (state.media[lang].heroGrid || [])[+g[1]] || '';
  return state.media[lang].sectionVideos[key] || '';
}
export function setMediaVal(lang, key, val) {
  if (key === 'heroBanner') {
    state.media[lang].heroBanner = val;
    return;
  }
  const g = /^grid([0-5])$/.exec(key);
  if (g) {
    if (!Array.isArray(state.media[lang].heroGrid))
      state.media[lang].heroGrid = ['', '', '', '', '', ''];
    state.media[lang].heroGrid[+g[1]] = val;
    return;
  }
  state.media[lang].sectionVideos[key] = val;
}
export function defMediaVal(key) {
  if (key === 'heroBanner' || /^grid[0-5]$/.test(key)) return '';
  return defaultMediaLocale().sectionVideos[key];
}
// Ersetzt eine Medien-URL in ALLEN Slots (beide Sprachen) — z.B. nachdem eine
// Datei serverseitig verschoben wurde, damit die Zuweisungen erhalten bleiben.
export function updateMediaUrlEverywhere(oldUrl, newUrl) {
  for (const lang of MEDIA_LANGS) {
    for (const key of MEDIA_KEYS) {
      if (getMediaVal(lang, key) === oldUrl) setMediaVal(lang, key, newUrl);
    }
  }
  for (const slot of allImageSlots()) {
    if (slot.get() === oldUrl) slot.set(newUrl);
  }
}

// --- Pfad-Helfer für verschachtelte Overrides ---
export function getPath(obj, path) {
  let cur = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}
export function setPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (typeof cur[path[i]] !== 'object' || cur[path[i]] == null) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
}
export function delPath(obj, path) {
  const stack = [obj];
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] == null) return;
    cur = cur[path[i]];
    stack.push(cur);
  }
  delete cur[path[path.length - 1]];
  // leere Eltern-Objekte aufräumen
  for (let i = path.length - 2; i >= 0; i--) {
    const parent = stack[i];
    const key = path[i];
    if (parent[key] && typeof parent[key] === 'object' && Object.keys(parent[key]).length === 0)
      delete parent[key];
  }
}

// --- Navigation: Ebenen-Konstanten (reine Daten) ---
export const SUBTABS = [
  { key: 'ticker', label: 'Laufband' },
  { key: 'texts', label: 'Texte' },
  { key: 'media', label: 'Medien' },
  { key: 'layout', label: 'Layout' },
  { key: 'design', label: 'Hero-Design' },
  { key: 'background', label: 'Hintergrund' },
  { key: 'cards', label: 'Tool-Karten' },
  { key: 'files', label: 'Dateien' },
  { key: 'icons', label: 'Icons' },
  { key: 'advanced', label: 'Erweitert' },
];
export const LANG_SECTIONS = ['de', 'en'];

// --- Zentraler App-Zustand ---
export const state = {
  overrides: { de: {}, en: {} },
  ticker: { de: emptyTicker(), en: emptyTicker() }, // style ist pro Sprache Teil des Tickers
  media: defaultMedia(),
  loadedMedia: defaultMedia(), // Fallback für nicht aufgelöste Staging-Refs beim Speichern
  defaults: { de: {}, en: {} },
  stagedItems: [], // aus IndexedDB (nur im Browser)
  serverFiles: { de: [], en: [], shared: [] }, // Server-Uploads getrennt nach Sprache
  fonts: [], // verfügbare Schriftarten aus /fonts (für die Laufband-Schrift)
  objectUrls: new Map(), // id -> objectURL (für Vorschau)
  nav: { section: 'de', sub: 'ticker' }, // Ebene 1 (de|en|fields|publish) + Ebene 2
  publishing: false, // läuft gerade eine Veröffentlichung?
  profile: null, // aktives Site-Profil (öffentliche Infos aus /api/session)
  // Generischer Tab „Felder“ (Profile ohne Home-Vertrag): { groups, values }
  generic: null,
};
