import { promises as fs } from "node:fs";
import path from "node:path";

import type { QuranVerse } from "@/lib/types/quran";
import { clampInt } from "@/lib/utils/normalizers";

interface DownloadedMushafData {
  generated_at?: string;
  source?: string;
  pages?: Record<string, QuranVerse[]>;
  rubs?: Record<string, QuranVerse[]>;
  verse_sequence?: string[];
}

const configuredPath = process.env.MUSHAF_DOWNLOAD_PATH?.trim() || "";
const DOWNLOAD_FILE_PATH = configuredPath
  ? path.resolve(process.cwd(), configuredPath)
  : path.resolve(process.cwd(), "..", "quran_offline.json");

let cachedData: DownloadedMushafData | null = null;
let inFlight: Promise<DownloadedMushafData | null> | null = null;
let missingFileLogged = false;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDownloadedData(raw: unknown): DownloadedMushafData | null {
  if (!isObject(raw)) return null;

  const pages = isObject(raw.pages) ? (raw.pages as Record<string, QuranVerse[]>) : undefined;
  const rubs = isObject(raw.rubs) ? (raw.rubs as Record<string, QuranVerse[]>) : undefined;
  const verseSequence = Array.isArray(raw.verse_sequence)
    ? raw.verse_sequence
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    : undefined;

  if (!pages && !rubs && !verseSequence?.length) return null;

  return {
    generated_at: typeof raw.generated_at === "string" ? raw.generated_at : undefined,
    source: typeof raw.source === "string" ? raw.source : undefined,
    pages,
    rubs,
    verse_sequence: verseSequence
  };
}

async function loadDownloadedMushafData() {
  if (cachedData) return cachedData;
  if (inFlight) return inFlight;

  inFlight = fs
    .readFile(DOWNLOAD_FILE_PATH, "utf8")
    .then((raw) => {
      const parsed = parseDownloadedData(JSON.parse(raw));
      cachedData = parsed;
      return parsed;
    })
    .catch((error: unknown) => {
      if (!missingFileLogged) {
        missingFileLogged = true;
        const message = error instanceof Error ? error.message : "unknown error";
        console.warn(`[downloaded-mushaf] Unable to read ${DOWNLOAD_FILE_PATH}: ${message}`);
      }
      cachedData = null;
      return null;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function getVerses(record: Record<string, QuranVerse[]> | undefined, key: number) {
  if (!record) return null;
  const verses = record[String(key)];
  if (!Array.isArray(verses) || verses.length === 0) return null;
  return verses;
}

export async function getDownloadedMushafData() {
  return loadDownloadedMushafData();
}

export async function getDownloadedPageVerses(pageNumber: number) {
  const data = await loadDownloadedMushafData();
  if (!data) return null;

  const normalizedPage = clampInt(pageNumber, 1, 604, 1);
  return getVerses(data.pages, normalizedPage);
}

export async function getDownloadedRubVerses(rubNumber: number) {
  const data = await loadDownloadedMushafData();
  if (!data) return null;

  const normalizedRub = clampInt(rubNumber, 1, 240, 1);
  return getVerses(data.rubs, normalizedRub);
}

export async function hasDownloadedMushafData() {
  const data = await loadDownloadedMushafData();
  return Boolean(data?.pages && Object.keys(data.pages).length > 0 && data?.rubs && Object.keys(data.rubs).length > 0);
}
