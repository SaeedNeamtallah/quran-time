import { SURAH_NAMES } from "@/lib/constants/app";
import {
  TAFSIR_GREEN_PROPHET_AND_SALAT_TERMS,
  TAFSIR_HIGHLIGHT_GROUPS,
  TAFSIR_RED_SACRED_TERMS
} from "@/lib/constants/tafsir-highlights";
import type { ReaderRoute } from "@/lib/types/app";
import type { ReadingMode, SessionPhase } from "@/lib/types/quran";

export function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatVerseMarker(verseKey: string) {
  const normalized = String(verseKey ?? "").trim();
  if (!normalized.includes(":")) return normalized || "--";
  return normalized.split(":").pop() || normalized;
}

export function getReadingModeLabel(mode: ReadingMode) {
  return mode === "page" ? "صفحة المصحف" : "أرباع متتالية";
}

export function getReaderRouteLabel(route: ReaderRoute) {
  return route === "/reader/page" ? "صفحة المصحف" : "أرباع متتالية";
}

export function getPhaseLabel(phase: SessionPhase) {
  return phase === "study" ? "وقت التركيز" : "استراحة قرآنية";
}

export function getSurahName(chapter: number) {
  return SURAH_NAMES[chapter - 1] ?? `سورة ${chapter}`;
}

export function splitPlainTextIntoParagraphs(text: string, sentenceCount = 7) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.flatMap((block) => {
    const parts = block.match(/[^.!؟!?۔]+(?:[.!؟!?۔]+|$)/g) ?? [block];
    const units = parts.map((part) => part.trim()).filter(Boolean);

    if (units.length <= sentenceCount) return [block];

    const chunks: string[] = [];
    for (let index = 0; index < units.length; index += sentenceCount) {
      chunks.push(units.slice(index, index + sentenceCount).join(" ").trim());
    }
    return chunks;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTermsPattern(terms: readonly string[], allowLeadingArabicPrefix = false) {
  if (!terms.length) return "(?!)";

  const body = terms
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => {
      const chunks = term.split(/\s+/).map((chunk) => escapeRegExp(chunk));
      if (allowLeadingArabicPrefix && chunks.length) {
        chunks[0] = `(?:[وفبل])?${chunks[0]}`;
      }
      return chunks.join("\\s+");
    })
    .join("|");

  return `(?<![\\p{L}\\p{N}_])(?:${body})(?![\\p{L}\\p{N}_])`;
}

const AYAH_PATTERN = "﴿[^﴿﴾]*﴾";
const BRACKET_OR_QUOTE_PATTERN =
  "\\([^()]*\\)|\\{[^{}]*\\}|\\[[^\\[\\]]*\\]|«[^«»]*»|“[^”]*”|\"(?:[^\"]*)\"|'(?:[^']*)'";
const SEMICOLON_SEGMENT_PATTERN =
  "(?:;;|؛؛)[^\\n\\r]*?(?:;;|؛؛)|(?:;|؛)[^;؛\\n\\r]*(?:;|؛)";

const RED_PRIORITY_PATTERN = `${AYAH_PATTERN}|${BRACKET_OR_QUOTE_PATTERN}|${SEMICOLON_SEGMENT_PATTERN}`;

const RED_SACRED_PATTERN = buildTermsPattern(TAFSIR_RED_SACRED_TERMS);
const GREEN_PROPHET_AND_SALAT_PATTERN = buildTermsPattern(TAFSIR_GREEN_PROPHET_AND_SALAT_TERMS, true);

const GOLD_PATTERN = buildTermsPattern(TAFSIR_HIGHLIGHT_GROUPS.gold, true);
const BLUE_PATTERN = buildTermsPattern(TAFSIR_HIGHLIGHT_GROUPS.blue, true);
const PURPLE_PATTERN = buildTermsPattern(TAFSIR_HIGHLIGHT_GROUPS.purple, true);

const TAFSIR_HIGHLIGHT_REGEX = new RegExp(
  [
    `(?<redPriority>${RED_PRIORITY_PATTERN})`,
    `(?<gold>${GOLD_PATTERN})`,
    `(?<blue>${BLUE_PATTERN})`,
    `(?<purple>${PURPLE_PATTERN})`,
    `(?<green>${GREEN_PROPHET_AND_SALAT_PATTERN})`,
    `(?<redSacred>${RED_SACRED_PATTERN})`,
  ].join("|"),
  "giu"
);

export type TafsirHighlightType = "text" | "red" | "green" | "purple" | "blue" | "gold";

export interface TafsirHighlightPart {
  id: string;
  text: string;
  type: TafsirHighlightType;
  highlighted: boolean;
}

export function highlightTafsirText(text: string) {
  const source = String(text ?? "");
  if (!source) return [] as TafsirHighlightPart[];

  const parts: TafsirHighlightPart[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(TAFSIR_HIGHLIGHT_REGEX)) {
    const index = match.index ?? 0;
    const matchedText = match[0] ?? "";
    if (!matchedText) continue;

    if (index > lastIndex) {
      const plain = source.slice(lastIndex, index);
      if (plain) {
        parts.push({
          id: `txt-${lastIndex}-${plain.slice(0, 6)}`,
          text: plain,
          type: "text",
          highlighted: false
        });
      }
    }

    const groups = match.groups ?? {};
    const type: TafsirHighlightType = groups.redPriority || groups.redSacred
      ? "red"
      : groups.gold
        ? "gold"
      : groups.blue
        ? "blue"
      : groups.green
        ? "green"
      : groups.purple
        ? "purple"
        : "text";

    parts.push({
      id: `hl-${index}-${matchedText.slice(0, 6)}`,
      text: matchedText,
      type,
      highlighted: true
    });

    lastIndex = index + matchedText.length;
  }

  if (lastIndex < source.length) {
    const plain = source.slice(lastIndex);
    if (plain) {
      parts.push({
        id: `txt-${lastIndex}-${plain.slice(0, 6)}`,
        text: plain,
        type: "text",
        highlighted: false
      });
    }
  }

  return parts;
}

function buildHarakatPattern(phrase: string) {
  return phrase
    .split(" ")
    .map((word) => word.split("").join("[\\u064B-\\u065F]*"))
    .join("\\s+");
}

const ARABIC_PREFIXES = "(?:[وفبل][\\u064B-\\u065F]*)?";

const SACRED_CORE = [
  "اللَّه", "الله", "اللهم", "لله", "إله", "إلهي", 
  "رب", "ربه", "ربها", "ربهم", "ربكم", "ربنا", "ربي", "الرب",
  "رسول", "رسوله", "رسولهم", "رسولكم", "رسولنا", "الرسول",
  "نبي", "نبيه", "نبيها", "نبيهم", "نبيكم", "نبينا", "النبي", "أنبياء", "الأنبياء",
  "محمد", "محمدا", "محمداً", "أحمد",
  "صلى الله عليه وسلم", "صل الله عليه وسلم", "عليه الصلاة والسلام", "عليه السلام", "صلى الله عليه وآله وسلم",
  "رضي الله عنه", "رضي الله عنها", "رضي الله عنهما", "رضي الله عنهم",
  "عز وجل", "جل وعلا", "جل جلاله", "سبحانه وتعالى", "تبارك وتعالى", "تعالى", "سبحانه",
  "رضوان الله عليه", "رحمه الله", "رحمها الله", "رحمهم الله"
];

const SACRED_WORDS_PATTERN = SACRED_CORE.map(w => ARABIC_PREFIXES + buildHarakatPattern(w)).join("|");
const SACRED_REGEX = new RegExp(`(^|[\\s\\.,،؛\\-\\(«﴾\\[\\{])(${SACRED_WORDS_PATTERN})(?=$|[\\s\\.,،؛\\-\\)\\»﴿\\]\\}])`, "g");
const EXACT_SACRED_REGEX = new RegExp(`^(?:${SACRED_WORDS_PATTERN})$`);

export function parseSacredTexts(text: string) {
  return String(text ?? "")
    .split(SACRED_REGEX)
    .filter(Boolean)
    .map((part, index) => {
      return {
        id: `sac-${index}-${part.slice(0, 5)}`,
        text: part,
        isSacred: EXACT_SACRED_REGEX.test(part),
      };
    });
}

