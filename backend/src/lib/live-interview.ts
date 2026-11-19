// Real-time in-memory room hub for Express backend AI interview live rooms.

export interface LiveSignal {
  id: number;
  from: "candidate" | "client";
  kind: "offer" | "answer" | "ice" | "renegotiate";
  payload: unknown;
  createdAt: number;
}

export interface LiveAudioChunk {
  id: number;
  from: "candidate" | "client";
  dataUrl: string;
  createdAt: number;
}

export interface LiveInterviewState {
  token: string;
  engineerJoinedAt: number | null;
  lastEngineerSeen: number;
  lastClientSeen: number;
  clientCoHostActive: boolean;
  isEngineerVideoActive: boolean;
  isEngineerScreenSharing: boolean;
  isClientVideoActive: boolean;
  isClientScreenSharing: boolean;
  activeQuestionIndex: number;
  liveDraftAnswer: string;
  liveFrameDataUrl: string | null;
  clientScreenFrameDataUrl: string | null;
  clientVideoFrameDataUrl: string | null;
  nextSignalId: number;
  signals: LiveSignal[];
  nextAudioId: number;
  audioChunks: LiveAudioChunk[];
}

const globalForLive = globalThis as unknown as {
  __vcBackendLiveInterviews?: Map<string, LiveInterviewState>;
};

const roomMap = (globalForLive.__vcBackendLiveInterviews ??= new Map<string, LiveInterviewState>());

const PRESENCE_TTL_MS = 8_000;
const SIGNAL_TTL_MS = 60_000;

export function getOrCreateLiveRoom(token: string): LiveInterviewState {
  let room = roomMap.get(token);
  if (!room) {
    room = {
      token,
      engineerJoinedAt: null,
      lastEngineerSeen: 0,
      lastClientSeen: 0,
      clientCoHostActive: false,
      isEngineerVideoActive: false,
      isEngineerScreenSharing: false,
      isClientVideoActive: false,
      isClientScreenSharing: false,
      activeQuestionIndex: 0,
      liveDraftAnswer: "",
      liveFrameDataUrl: null,
      clientScreenFrameDataUrl: null,
      clientVideoFrameDataUrl: null,
      nextSignalId: 1,
      signals: [],
      nextAudioId: 1,
      audioChunks: [],
    };
    roomMap.set(token, room);
  }
  if (typeof room.clientCoHostActive !== "boolean") room.clientCoHostActive = false;
  if (typeof room.isEngineerVideoActive !== "boolean") room.isEngineerVideoActive = false;
  if (typeof room.isEngineerScreenSharing !== "boolean") room.isEngineerScreenSharing = false;
  if (typeof room.isClientVideoActive !== "boolean") room.isClientVideoActive = false;
  if (typeof room.isClientScreenSharing !== "boolean") room.isClientScreenSharing = false;
  if (typeof room.nextSignalId !== "number") room.nextSignalId = 1;
  if (!Array.isArray(room.signals)) room.signals = [];
  if (typeof room.nextAudioId !== "number") room.nextAudioId = 1;
  if (!Array.isArray(room.audioChunks)) room.audioChunks = [];

  const cutoff = Date.now() - SIGNAL_TTL_MS;
  if (room.signals.length > 0) {
    room.signals = room.signals.filter((s) => s.createdAt >= cutoff);
  }
  const audioCutoff = Date.now() - 12_000;
  if (room.audioChunks.length > 0) {
    room.audioChunks = room.audioChunks.filter((a) => a.createdAt >= audioCutoff);
  }
  return room;
}

export function touchEngineerPresence(
  token: string,
  opts?: {
    activeQuestionIndex?: number;
    liveDraftAnswer?: string;
    liveFrameDataUrl?: string | null;
    isScreenSharing?: boolean;
    isVideoActive?: boolean;
  }
): LiveInterviewState {
  const room = getOrCreateLiveRoom(token);
  const now = Date.now();
  if (!room.engineerJoinedAt) room.engineerJoinedAt = now;
  room.lastEngineerSeen = now;
  if (typeof opts?.isScreenSharing === "boolean") {
    room.isEngineerScreenSharing = opts.isScreenSharing;
  }
  if (typeof opts?.isVideoActive === "boolean") {
    room.isEngineerVideoActive = opts.isVideoActive;
    if (!opts.isVideoActive) {
      room.liveFrameDataUrl = null;
    }
  }
  if (typeof opts?.activeQuestionIndex === "number" && opts.activeQuestionIndex >= 0) {
    room.activeQuestionIndex = opts.activeQuestionIndex;
  }
  if (typeof opts?.liveDraftAnswer === "string") {
    room.liveDraftAnswer = opts.liveDraftAnswer.slice(0, 6000);
  }
  if (
    opts?.liveFrameDataUrl &&
    typeof opts.liveFrameDataUrl === "string" &&
    /^data:image\/(webp|jpeg|png);base64,/i.test(opts.liveFrameDataUrl) &&
    opts.liveFrameDataUrl.length <= 260_000
  ) {
    room.liveFrameDataUrl = opts.liveFrameDataUrl;
  }
  return room;
}

export function touchClientPresence(
  token: string,
  coHostActive?: boolean,
  opts?: {
    isScreenSharing?: boolean;
    screenFrameDataUrl?: string | null;
    isVideoActive?: boolean;
    videoFrameDataUrl?: string | null;
  }
): LiveInterviewState {
  const room = getOrCreateLiveRoom(token);
  room.lastClientSeen = Date.now();
  if (typeof coHostActive === "boolean") {
    room.clientCoHostActive = coHostActive;
  }
  if (typeof opts?.isVideoActive === "boolean") {
    room.isClientVideoActive = opts.isVideoActive;
    if (!opts.isVideoActive) {
      room.clientVideoFrameDataUrl = null;
    }
  }
  if (typeof opts?.isScreenSharing === "boolean") {
    room.isClientScreenSharing = opts.isScreenSharing;
    if (!opts.isScreenSharing) {
      room.clientScreenFrameDataUrl = null;
    }
  }
  if (
    opts?.screenFrameDataUrl &&
    typeof opts.screenFrameDataUrl === "string" &&
    /^data:image\/(webp|jpeg|png);base64,/i.test(opts.screenFrameDataUrl) &&
    opts.screenFrameDataUrl.length <= 260_000
  ) {
    room.clientScreenFrameDataUrl = opts.screenFrameDataUrl;
  }
  if (
    opts?.videoFrameDataUrl &&
    typeof opts.videoFrameDataUrl === "string" &&
    /^data:image\/(webp|jpeg|png);base64,/i.test(opts.videoFrameDataUrl) &&
    opts.videoFrameDataUrl.length <= 260_000
  ) {
    room.clientVideoFrameDataUrl = opts.videoFrameDataUrl;
  }
  return room;
}

export function pushLiveSignal(
  token: string,
  from: "candidate" | "client",
  kind: LiveSignal["kind"],
  payload: unknown
): LiveSignal {
  const room = getOrCreateLiveRoom(token);
  const sig: LiveSignal = {
    id: room.nextSignalId++,
    from,
    kind,
    payload,
    createdAt: Date.now(),
  };
  room.signals.push(sig);
  return sig;
}

export function pushLiveAudioChunk(
  token: string,
  from: "candidate" | "client",
  dataUrl: string
): LiveAudioChunk | null {
  if (
    typeof dataUrl !== "string" ||
    !/^data:audio\/[a-z0-9.+-]+(?:;[^,]*)?;base64,/i.test(dataUrl) ||
    dataUrl.length > 180_000
  ) {
    return null;
  }
  const room = getOrCreateLiveRoom(token);
  const chunk: LiveAudioChunk = {
    id: room.nextAudioId++,
    from,
    dataUrl,
    createdAt: Date.now(),
  };
  room.audioChunks.push(chunk);
  if (room.audioChunks.length > 30) {
    room.audioChunks = room.audioChunks.slice(-30);
  }
  return chunk;
}

export function readLiveSnapshot(
  token: string,
  forRole: "candidate" | "client",
  sinceSignalId = 0,
  sinceAudioId = 0
) {
  const room = getOrCreateLiveRoom(token);
  const now = Date.now();
  const isEngineerOnline = now - room.lastEngineerSeen <= PRESENCE_TTL_MS;
  const isClientWatching = now - room.lastClientSeen <= PRESENCE_TTL_MS;
  const signals = room.signals.filter(
    (s) => s.id > sinceSignalId && s.from !== forRole
  );
  const audioChunks = room.audioChunks.filter(
    (a) => a.id > sinceAudioId && a.from !== forRole
  );

  return {
    isEngineerOnline,
    isClientWatching,
    clientCoHostActive: isClientWatching && room.clientCoHostActive,
    isEngineerVideoActive: isEngineerOnline && room.isEngineerVideoActive,
    isEngineerScreenSharing: isEngineerOnline && room.isEngineerScreenSharing,
    isClientVideoActive: isClientWatching && room.isClientVideoActive,
    isClientScreenSharing: isClientWatching && room.isClientScreenSharing,
    activeQuestionIndex: room.activeQuestionIndex,
    liveDraftAnswer: forRole === "client" ? room.liveDraftAnswer : undefined,
    liveFrameDataUrl:
      forRole === "client" && isEngineerOnline && room.isEngineerVideoActive
        ? room.liveFrameDataUrl
        : null,
    clientScreenFrameDataUrl:
      forRole === "candidate" && isClientWatching && room.isClientScreenSharing
        ? room.clientScreenFrameDataUrl
        : null,
    clientVideoFrameDataUrl:
      forRole === "candidate" && isClientWatching && room.isClientVideoActive
        ? room.clientVideoFrameDataUrl
        : null,
    signals,
    audioChunks,
  };
}

