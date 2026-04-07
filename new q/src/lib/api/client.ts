"use client";

import type { AppSettings } from "@/lib/types/app";
import type {
  AppStatusPayload,
  ChapterIndexPayload,
  PageRecitationPayload,
  PageWordTimingsPayload,
  PaginatedVersesResponse,
  RecitationsPayload,
  RubRecitationPayload,
  RubResponse,
  RubWordTimingsPayload,
  TafsirPayload,
  VerseSequencePayload,
  VerseAudioResponse
} from "@/lib/types/quran";
import { clampInt } from "@/lib/utils/normalizers";
import type { QuranVerse } from "@/lib/types/quran";

let cachedStatus: AppStatusPayload | null = null;
let cachedVerseSequence: string[] | null = null;
let cachedChapterIndex: ChapterIndexPayload | null = null;

async function parseJsonResponse<T>(response: Response) {
  if (!response.ok) {
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) detail = payload.detail;
    } catch {
      // Ignore JSON parse failures for error messages.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export async function fetchAppStatus() {
  const response = await fetch("/api/status", { cache: "no-store" });
  const payload = await parseJsonResponse<AppStatusPayload>(response);
  cachedStatus = payload;
  return payload;
}

export async function hasBackend() {
  if (cachedStatus?.backendAvailable !== undefined) {
    return cachedStatus.backendAvailable;
  }
  const status = await fetchAppStatus();
  return Boolean(status.backendAvailable);
}

export async function fetchChapterIndex() {
  if (cachedChapterIndex) return cachedChapterIndex;
  const response = await fetch("/api/chapter_index", { cache: "force-cache" });
  cachedChapterIndex = await parseJsonResponse<ChapterIndexPayload>(response);
  return cachedChapterIndex;
}

export async function fetchRubContent(currentRub: number, count: number) {
  const safeRub = clampInt(currentRub, 1, 240, 1);
  const safeCount = clampInt(count, 1, 8, 1);

  const response = await fetch(`/api/rub?count=${safeCount}&rub_number=${safeRub}`, { cache: "no-store" });
  return parseJsonResponse<RubResponse>(response);
}

export async function setRubPosition(nextRub: number) {
  const response = await fetch("/api/set_rub", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ rub_number: clampInt(nextRub, 1, 240, 1) })
  });
  return parseJsonResponse<{ message: string; current_rub: number }>(response);
}

export async function fetchSurahChallengeContent(chapter: number, page: number, perPage: number) {
  const safeChapter = clampInt(chapter, 1, 114, 18);
  const safePage = clampInt(page, 1, 9999, 1);
  const safePerPage = clampInt(perPage, 1, 200, 15);

  const response = await fetch(
    `/api/surah_challenge?chapter=${safeChapter}&page=${safePage}&per_page=${safePerPage}`,
    { cache: "no-store" }
  );
  return parseJsonResponse<PaginatedVersesResponse>(response);
}

export async function fetchPageContent(pageNumber: number) {
  const safePageNumber = clampInt(pageNumber, 1, 604, 1);
  const response = await fetch(`/api/page?page=${safePageNumber}`, { cache: "no-store" });
  return parseJsonResponse<PaginatedVersesResponse>(response);
}

export async function fetchTafsir(verseKey: string, settings: AppSettings) {
  const response = await fetch(
    `/api/tafsir?verse_key=${encodeURIComponent(verseKey)}&tafsir_id=${settings.tafsirId}`,
    { cache: "no-store" }
  );
  return parseJsonResponse<TafsirPayload>(response);
}

export async function fetchVerseAudio(verseKey: string, settings: AppSettings) {
  const response = await fetch(
    `/api/verse_audio?verse_key=${encodeURIComponent(verseKey)}&recitation_id=${settings.recitationId}`,
    { cache: "no-store" }
  );
  return parseJsonResponse<VerseAudioResponse>(response);
}

export async function fetchRecitations() {
  const response = await fetch("/api/recitations", { cache: "no-store" });
  return parseJsonResponse<RecitationsPayload>(response);
}

export async function fetchRubRecitation(rubNumber: number, count: number, settings: AppSettings) {
  const response = await fetch(
    `/api/rub_recitation?rub_number=${clampInt(rubNumber, 1, 240, 1)}&count=${clampInt(count, 1, 8, 1)}&recitation_id=${settings.recitationId}`,
    { cache: "no-store" }
  );
  return parseJsonResponse<RubRecitationPayload>(response);
}

export async function fetchPageRecitation(pageNumber: number, settings: AppSettings) {
  const response = await fetch(
    `/api/page_recitation?page_number=${clampInt(pageNumber, 1, 604, 1)}&recitation_id=${settings.recitationId}`,
    { cache: "no-store" }
  );
  return parseJsonResponse<PageRecitationPayload>(response);
}

export async function fetchRubWordTimings(rubNumber: number, count: number, settings: AppSettings) {
  const response = await fetch(
    `/api/rub_word_timings?rub_number=${clampInt(rubNumber, 1, 240, 1)}&count=${clampInt(count, 1, 8, 1)}&recitation_id=${settings.recitationId}`,
    { cache: "no-store" }
  );
  return parseJsonResponse<RubWordTimingsPayload>(response);
}

export async function fetchPageWordTimings(pageNumber: number, settings: AppSettings) {
  const response = await fetch(
    `/api/page_word_timings?page_number=${clampInt(pageNumber, 1, 604, 1)}&recitation_id=${settings.recitationId}`,
    { cache: "no-store" }
  );
  return parseJsonResponse<PageWordTimingsPayload>(response);
}

export async function loadVerseSequence() {
  if (cachedVerseSequence) return cachedVerseSequence;
  const response = await fetch("/api/verse_sequence", { cache: "force-cache" });
  const payload = await parseJsonResponse<VerseSequencePayload>(response);
  cachedVerseSequence = payload.verses ?? [];
  return cachedVerseSequence;
}

export function buildVerseMap(verses: QuranVerse[]) {
  return new Map(verses.map((verse) => [verse.verse_key, verse]));
}
