"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RubRecitationTrack, VerseWordTiming } from "@/lib/types/quran";

type WordTimingMap = Record<string, VerseWordTiming>;
type GaplessSequencerSnapshot = {
  isPlaying: boolean;
  hasSequence: boolean;
  activeVerseKey: string;
  activeWordSignature: string;
};

type GaplessSequencerConfig = {
  onPlayingChange: (playing: boolean) => void;
  onActiveVerseChange: (verseKey: string) => void;
  onActiveWordChange: (signature: string) => void;
  onEnded: () => void;
  onHasSequenceChange?: (hasSequence: boolean) => void;
};

const PRELOAD_AHEAD_COUNT = 3;
const INTER_VERSE_FALLBACK_TAIL_SEC = 0.12;
const MIN_AUDIO_SLICE_SEC = 0.02;

let ctx: AudioContext | null = null;
const buffersCache = new Map<string, AudioBuffer>();

let sources: AudioBufferSourceNode[] = [];
let trackOffsets: number[] = [];
let trackDurations: number[] = [];
let tracks: RubRecitationTrack[] = [];
let timings: WordTimingMap = {};

let raf = 0;
let isStopped = true;
let isPaused = false;
let isScheduling = false;

let activeTrackIndex = -1;
let scheduledCount = 0;
let handoffTarget = 0;

let isPlaying = false;
let hasSequence = false;
let activeVerseKey = "";
let activeWordSignature = "";

const listeners = new Set<GaplessSequencerConfig>();

function getSnapshot(): GaplessSequencerSnapshot {
  return {
    isPlaying,
    hasSequence,
    activeVerseKey,
    activeWordSignature
  };
}

function notifyPlayingChange() {
  listeners.forEach((listener) => listener.onPlayingChange(isPlaying));
}

function notifySequenceChange() {
  listeners.forEach((listener) => listener.onHasSequenceChange?.(hasSequence));
}

function notifyActiveVerseChange() {
  listeners.forEach((listener) => listener.onActiveVerseChange(activeVerseKey));
}

function notifyActiveWordChange() {
  listeners.forEach((listener) => listener.onActiveWordChange(activeWordSignature));
}

function notifyEnded() {
  listeners.forEach((listener) => listener.onEnded());
}

function syncListener(listener: GaplessSequencerConfig) {
  const snapshot = getSnapshot();
  listener.onPlayingChange(snapshot.isPlaying);
  listener.onHasSequenceChange?.(snapshot.hasSequence);
  listener.onActiveVerseChange(snapshot.activeVerseKey);
  listener.onActiveWordChange(snapshot.activeWordSignature);
}

function setPlaying(next: boolean) {
  if (isPlaying === next) return;
  isPlaying = next;
  notifyPlayingChange();
}

function setHasSequence(next: boolean) {
  if (hasSequence === next) return;
  hasSequence = next;
  notifySequenceChange();
}

function setActiveVerseKey(next: string) {
  if (activeVerseKey === next) return;
  activeVerseKey = next;
  notifyActiveVerseChange();
}

function setActiveWordSignature(next: string) {
  if (activeWordSignature === next) return;
  activeWordSignature = next;
  notifyActiveWordChange();
}

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return ctx;
}

async function fetchAndDecode(url: string, audioContext: AudioContext) {
  if (buffersCache.has(url)) return buffersCache.get(url)!;
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(buffer);

    if (buffersCache.size > 50) buffersCache.clear();
    buffersCache.set(url, decoded);
    return decoded;
  } catch (error) {
    console.error("Audio decode failed", error);
    return null;
  }
}

async function ensureBuffer() {
  if (isScheduling || isStopped) return;
  const audioContext = getCtx();
  if (!audioContext) return;

  isScheduling = true;
  try {
    while (!isStopped && scheduledCount < tracks.length && scheduledCount <= Math.max(0, activeTrackIndex) + PRELOAD_AHEAD_COUNT) {
      const index = scheduledCount;
      const track = tracks[index];
      const verseTiming = timings[track.verse_key];
      const segments = verseTiming?.segments ?? [];

      const buffer = await fetchAndDecode(track.url, audioContext);
      if (isStopped) break;

      let firstSec = 0;
      let durationSec = MIN_AUDIO_SLICE_SEC;

      if (buffer) {
        let lastSec = buffer.duration;

        if (segments.length > 0) {
          firstSec = segments[0].start_ms / 1000;

          const timingEndSec = segments[segments.length - 1].end_ms / 1000;
          const durationEndSec = buffer.duration - INTER_VERSE_FALLBACK_TAIL_SEC;
          lastSec = Math.max(timingEndSec, durationEndSec);
        }

        if (!Number.isFinite(firstSec)) firstSec = 0;
        if (!Number.isFinite(lastSec)) lastSec = buffer.duration;

        const maxOffsetSec = Math.max(0, buffer.duration - MIN_AUDIO_SLICE_SEC);
        firstSec = Math.min(Math.max(0, firstSec), maxOffsetSec);

        const minEndSec = Math.min(buffer.duration, firstSec + MIN_AUDIO_SLICE_SEC);
        lastSec = Math.min(buffer.duration, Math.max(minEndSec, lastSec));

        durationSec = Math.max(MIN_AUDIO_SLICE_SEC, lastSec - firstSec);
      } else {
        if (segments.length > 0) {
          firstSec = Math.max(0, segments[0].start_ms / 1000);
          const timingEndSec = segments[segments.length - 1].end_ms / 1000;
          durationSec = Math.max(MIN_AUDIO_SLICE_SEC, timingEndSec - firstSec);
        } else {
          const verseSpanSec = verseTiming ? Math.max(0, (verseTiming.verse_end_ms - verseTiming.verse_start_ms) / 1000) : 0;
          durationSec = Math.max(MIN_AUDIO_SLICE_SEC, verseSpanSec || 1);
        }

        if (!Number.isFinite(firstSec)) firstSec = 0;
        if (!Number.isFinite(durationSec)) durationSec = 1;
      }

      let scheduleTime = handoffTarget;
      const now = audioContext.currentTime;

      if (scheduleTime < now) {
        scheduleTime = now + 0.05;
      }

      trackOffsets[index] = scheduleTime - firstSec;
      trackDurations[index] = durationSec;

      if (buffer) {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(scheduleTime, firstSec, durationSec);
        sources[index] = source;
      }

      handoffTarget = scheduleTime + durationSec;
      scheduledCount++;
    }
  } finally {
    isScheduling = false;
  }
}

function stopPlayback() {
  isStopped = true;
  isPaused = false;
  setPlaying(false);

  sources.forEach((source) => {
    try {
      source?.stop();
      source?.disconnect();
    } catch {
      // Ignore source cleanup issues.
    }
  });

  sources = [];
  trackOffsets = [];
  trackDurations = [];
  tracks = [];
  timings = {};
  activeTrackIndex = -1;
  scheduledCount = 0;
  handoffTarget = 0;

  setHasSequence(false);
  setActiveVerseKey("");
  setActiveWordSignature("");

  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function syncLoop() {
  if (isStopped || isPaused) return;
  if (!ctx) return;

  const globalTime = ctx.currentTime;
  let currentActiveIndex = -1;
  let activeRelativeMs = 0;

  for (let index = trackOffsets.length - 1; index >= 0; index--) {
    const physicalStart = trackOffsets[index];
    if (physicalStart === undefined) continue;

    const relativeSec = globalTime - physicalStart;
    const duration = trackDurations[index] ?? 0;

    if (relativeSec >= 0 && relativeSec <= duration) {
      currentActiveIndex = index;
      activeRelativeMs = relativeSec * 1000;
      break;
    }
  }

  if (currentActiveIndex === -1) {
    if (trackOffsets.length > 0 && trackOffsets.length === tracks.length) {
      const lastIndex = tracks.length - 1;
      const endTime = trackOffsets[lastIndex] + (trackDurations[lastIndex] ?? 0);
      if (globalTime > endTime) {
        stopPlayback();
        notifyEnded();
      }
    }
  } else {
    if (activeTrackIndex !== currentActiveIndex) {
      activeTrackIndex = currentActiveIndex;
      void ensureBuffer();
    }

    const activeTrack = tracks[currentActiveIndex];
    setActiveVerseKey(activeTrack.verse_key);

    const verseTiming = timings[activeTrack.verse_key];
    const segments = verseTiming?.segments ?? [];
    const activeSegment = segments.find(
      (segment) => activeRelativeMs >= segment.start_ms && activeRelativeMs <= segment.end_ms
    );

    setActiveWordSignature(activeSegment ? `${activeTrack.verse_key}:${activeSegment.position}` : "");
  }

  raf = requestAnimationFrame(syncLoop);
}

async function playStreamingSequenceGlobal(nextTracks: RubRecitationTrack[], nextTimings: WordTimingMap) {
  stopPlayback();

  if (!nextTracks.length) return;

  const audioContext = getCtx();
  if (!audioContext) return;

  isStopped = false;
  isPaused = false;
  tracks = nextTracks;
  timings = nextTimings;

  activeTrackIndex = -1;
  scheduledCount = 0;
  handoffTarget = audioContext.currentTime;

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  setHasSequence(true);
  setPlaying(true);
  setActiveVerseKey(nextTracks[0]?.verse_key || "");

  const firstTrackKey = nextTracks[0]?.verse_key;
  const firstSegment = firstTrackKey ? nextTimings[firstTrackKey]?.segments?.[0] : undefined;
  setActiveWordSignature(firstTrackKey && firstSegment ? `${firstTrackKey}:${firstSegment.position}` : "");

  await ensureBuffer();

  if (!raf) {
    raf = requestAnimationFrame(syncLoop);
  }
}

function pauseGlobal() {
  if (isStopped) return;
  isPaused = true;
  setPlaying(false);
  void ctx?.suspend();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function resumeGlobal() {
  if (isStopped || !hasSequence) return;
  isPaused = false;
  setPlaying(true);
  void ctx?.resume();
  void ensureBuffer();
  if (!raf) {
    raf = requestAnimationFrame(syncLoop);
  }
}

function toggleGlobal() {
  if (isPaused) {
    resumeGlobal();
    return;
  }
  pauseGlobal();
}

function stopGlobal() {
  stopPlayback();
}

export function useGaplessSequencer(config: {
  onPlayingChange: (playing: boolean) => void;
  onActiveVerseChange: (verseKey: string) => void;
  onActiveWordChange: (signature: string) => void;
  onEnded: () => void;
  onHasSequenceChange?: (hasSequence: boolean) => void;
}) {
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const listener: GaplessSequencerConfig = {
      onPlayingChange: (playing) => configRef.current.onPlayingChange(playing),
      onActiveVerseChange: (verseKey) => configRef.current.onActiveVerseChange(verseKey),
      onActiveWordChange: (signature) => configRef.current.onActiveWordChange(signature),
      onEnded: () => configRef.current.onEnded(),
      onHasSequenceChange: (value) => configRef.current.onHasSequenceChange?.(value)
    };

    listeners.add(listener);
    syncListener(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return useMemo(
    () => ({
      playStreamingSequence: playStreamingSequenceGlobal,
      pause: pauseGlobal,
      resume: resumeGlobal,
      toggle: toggleGlobal,
      stop: stopGlobal,
      getSnapshot
    }),
    []
  );
}
