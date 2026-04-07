"use client";

import { create } from "zustand";

import type { RubRecitationTrack, VerseWordTiming } from "@/lib/types/quran";

export type GlobalRecitationMode = "rub" | "page";

type WordTimingMap = Record<string, VerseWordTiming>;

interface GlobalRecitationSnapshot {
  mode: GlobalRecitationMode | null;
  playlist: RubRecitationTrack[];
  playlistIndex: number;
  isPlaying: boolean;
  activeVerseKey: string;
  activeWordSignature: string;
  sessionId: number;
}

interface GlobalRecitationStore extends GlobalRecitationSnapshot {
  startRecitation: (mode: GlobalRecitationMode, tracks: RubRecitationTrack[]) => Promise<void>;
  stopRecitation: () => void;
  updateWordTimings: (mode: GlobalRecitationMode, timings: WordTimingMap) => void;
}

const interVerseHandoffLeadMs = 90;
const interVerseFallbackTailMs = 120;

let recitationAudio: HTMLAudioElement | null = null;
let listenersBound = false;
let activeSessionId = 0;
let handoffTrackKey = "";
const preloadedTrackMap = new Map<string, HTMLAudioElement>();
const wordTimingsByMode: Record<GlobalRecitationMode, WordTimingMap> = {
  rub: {},
  page: {}
};

function setRecitationSnapshot(partial: Partial<GlobalRecitationSnapshot>) {
  useGlobalRecitationStore.setState(partial);
}

function clearPreloadedTracks() {
  preloadedTrackMap.forEach((audio) => {
    audio.removeAttribute("src");
    audio.load();
  });
  preloadedTrackMap.clear();
}

function preloadTrack(index: number, tracks: RubRecitationTrack[]) {
  if (typeof Audio === "undefined") return;

  const nextTrack = tracks[index];
  if (!nextTrack || preloadedTrackMap.has(nextTrack.url)) return;

  const preloadedAudio = new Audio();
  preloadedAudio.preload = "auto";
  preloadedAudio.src = nextTrack.url;
  preloadedAudio.load();
  preloadedTrackMap.set(nextTrack.url, preloadedAudio);
}

async function playTrack(index: number, sessionId: number) {
  const audio = ensureRecitationAudio();
  if (!audio || sessionId !== activeSessionId) return;

  const state = useGlobalRecitationStore.getState();
  const track = state.playlist[index];
  if (!track) return;

  handoffTrackKey = "";
  setRecitationSnapshot({
    playlistIndex: index,
    activeVerseKey: track.verse_key,
    activeWordSignature: ""
  });

  audio.dataset.playbackRole = state.mode === "page" ? "mushaf-page-recitation" : "rub-recitation";
  audio.src = track.url;
  await audio.play().catch(() => { });

  if (sessionId !== activeSessionId) return;

  setRecitationSnapshot({ isPlaying: !audio.paused });
  preloadTrack(index + 1, state.playlist);
}

function handlePlay() {
  if (!useGlobalRecitationStore.getState().isPlaying) {
    setRecitationSnapshot({ isPlaying: true });
  }
}

function handlePause() {
  if (useGlobalRecitationStore.getState().isPlaying) {
    setRecitationSnapshot({ isPlaying: false });
  }
}

function handleEnded() {
  const state = useGlobalRecitationStore.getState();
  const nextIndex = state.playlistIndex + 1;

  if (nextIndex >= state.playlist.length) {
    stopRecitationPlayback();
    return;
  }

  void playTrack(nextIndex, activeSessionId);
}

function handleTimeUpdate() {
  if (!recitationAudio) return;

  const state = useGlobalRecitationStore.getState();
  if (!state.mode || !state.playlist.length) return;

  const currentTrack = state.playlist[state.playlistIndex];
  if (!currentTrack) return;

  if (state.activeVerseKey !== currentTrack.verse_key) {
    setRecitationSnapshot({ activeVerseKey: currentTrack.verse_key });
  }

  const verseTiming = wordTimingsByMode[state.mode]?.[currentTrack.verse_key];
  const segments = verseTiming?.segments ?? [];
  const currentMs = Math.max(0, Math.round(recitationAudio.currentTime * 1000));
  const handoffFromSegmentsMs = segments.reduce((maxValue, segment) => Math.max(maxValue, segment.end_ms), 0);
  const handoffFromSegmentsTargetMs =
    handoffFromSegmentsMs > 0 ? Math.max(0, handoffFromSegmentsMs - interVerseHandoffLeadMs) : 0;
  const audioDurationMs = Number.isFinite(recitationAudio.duration)
    ? Math.max(0, Math.round(recitationAudio.duration * 1000))
    : 0;
  const handoffFromDurationTargetMs = audioDurationMs > 0 ? Math.max(0, audioDurationMs - interVerseFallbackTailMs) : 0;
  // Prefer the later target to avoid cutting a verse when word-timings end before the real audio tail.
  const handoffTargetMs =
    handoffFromSegmentsTargetMs > 0 && handoffFromDurationTargetMs > 0
      ? Math.max(handoffFromSegmentsTargetMs, handoffFromDurationTargetMs)
      : handoffFromSegmentsTargetMs || handoffFromDurationTargetMs;

  const hasUpcomingTrack = state.playlistIndex + 1 < state.playlist.length;
  const nextHandoffKey = `${currentTrack.verse_key}:${state.playlistIndex}`;

  if (hasUpcomingTrack && handoffTargetMs > 0 && currentMs >= handoffTargetMs && handoffTrackKey !== nextHandoffKey) {
    handoffTrackKey = nextHandoffKey;
    void playTrack(state.playlistIndex + 1, activeSessionId);
    return;
  }

  const activeSegment = segments.find((segment) => currentMs >= segment.start_ms && currentMs <= segment.end_ms);
  const nextSignature = activeSegment ? `${currentTrack.verse_key}:${activeSegment.position}` : "";

  if (state.activeWordSignature !== nextSignature) {
    setRecitationSnapshot({ activeWordSignature: nextSignature });
  }
}

function ensureRecitationAudio() {
  if (typeof window === "undefined") return null;

  if (!recitationAudio) {
    recitationAudio = new Audio();
    recitationAudio.preload = "auto";
    recitationAudio.dataset.playbackRole = "rub-recitation";
  }

  if (!listenersBound) {
    recitationAudio.addEventListener("play", handlePlay);
    recitationAudio.addEventListener("pause", handlePause);
    recitationAudio.addEventListener("ended", handleEnded);
    recitationAudio.addEventListener("timeupdate", handleTimeUpdate);
    listenersBound = true;
  }

  return recitationAudio;
}

function stopRecitationPlayback() {
  activeSessionId += 1;
  const audio = ensureRecitationAudio();

  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  clearPreloadedTracks();
  handoffTrackKey = "";

  setRecitationSnapshot({
    mode: null,
    playlist: [],
    playlistIndex: 0,
    isPlaying: false,
    activeVerseKey: "",
    activeWordSignature: "",
    sessionId: activeSessionId
  });
}

async function startRecitationPlayback(mode: GlobalRecitationMode, tracks: RubRecitationTrack[]) {
  const audio = ensureRecitationAudio();
  if (!audio) return;

  activeSessionId += 1;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();

  clearPreloadedTracks();
  handoffTrackKey = "";

  setRecitationSnapshot({
    mode,
    playlist: tracks,
    playlistIndex: 0,
    isPlaying: false,
    activeVerseKey: "",
    activeWordSignature: "",
    sessionId: activeSessionId
  });

  if (!tracks.length) return;

  preloadTrack(0, tracks);
  await playTrack(0, activeSessionId);
}

export const useGlobalRecitationStore = create<GlobalRecitationStore>(() => ({
  mode: null,
  playlist: [],
  playlistIndex: 0,
  isPlaying: false,
  activeVerseKey: "",
  activeWordSignature: "",
  sessionId: 0,
  startRecitation: async (mode, tracks) => {
    await startRecitationPlayback(mode, tracks);
  },
  stopRecitation: () => {
    stopRecitationPlayback();
  },
  updateWordTimings: (mode, timings) => {
    wordTimingsByMode[mode] = timings;
  }
}));
