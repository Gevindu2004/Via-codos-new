"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Bot,
  CheckCircle2,
  ArrowRight,
  Play,
  Volume2,
  Square,
  Radio,
  Eye,
  Send,
  UserCheck,
  MessageSquarePlus,
  MonitorUp,
  MonitorOff,
  Maximize2,
  Minimize2,
  Clock,
} from "lucide-react";

const QUESTION_TIME_LIMIT_SEC = 60;

interface TranscriptEntry {
  question: string;
  answer: string;
  timestamp: string;
  aiEvaluation?: string;
}

interface InterviewRoomProps {
  token: string;
  profileCode: string;
  roleTitle: string;
  companyName: string;
  questions: string[];
  existingStatus: string;
  existingSummary?: string | null;
  existingScore?: number | null;
  existingRecordingUrl?: string | null;
  existingTranscript?: TranscriptEntry[];
  viewerRole?: "candidate" | "client";
}

interface SignalMsg {
  id: number;
  from: "candidate" | "client";
  kind: "offer" | "answer" | "ice" | "renegotiate";
  payload: unknown;
}

interface SpeechRecLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: process.env.NEXT_PUBLIC_WEBRTC_STUN_URL || "stun:stun.l.google.com:19302" },
  ],
};

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  const targetRate = 16000;
  if (inputSampleRate <= targetRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = inputSampleRate / targetRate;
  const newLength = Math.max(1, Math.floor(input.length / ratio));
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i += 1) {
      accum += input[i];
      count += 1;
    }
    const avg = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, avg));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function encodeWavDataUrl(samples: Float32Array, inputSampleRate: number): string {
  const pcm = downsampleTo16k(samples, inputSampleRate);
  const sampleRate = Math.min(16000, inputSampleRate);
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i += 1) {
    view.setInt16(offset, pcm[i], true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function decodeBase64AudioDataUrl(dataUrl: string): ArrayBuffer | null {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;
  const binStr = atob(dataUrl.slice(commaIdx + 1));
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i += 1) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes.buffer;
}

export function AiInterviewerRoom({
  token,
  profileCode,
  roleTitle,
  companyName,
  questions: initialQuestions,
  existingStatus,
  existingSummary,
  existingScore,
  existingRecordingUrl,
  existingTranscript = [],
  viewerRole = "candidate",
}: InterviewRoomProps) {
  const [status, setStatus] = useState(existingStatus);
  const [questions, setQuestions] = useState<string[]>(initialQuestions);
  const [started, setStarted] = useState(existingStatus === "IN_PROGRESS");
  const [currentIdx, setCurrentIdx] = useState(existingTranscript.length);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(QUESTION_TIME_LIMIT_SEC);
  const [answerText, setAnswerText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(existingTranscript);
  const [mediaActive, setMediaActive] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedInfo, setCompletedInfo] = useState<{
    summary: string;
    score: number;
    recordingUrl?: string | null;
  } | null>(
    existingStatus === "COMPLETED" && existingSummary
      ? {
          summary: existingSummary,
          score: existingScore ?? 88,
          recordingUrl: existingRecordingUrl ?? null,
        }
      : null
  );

  // Shared live telemetry states
  const [isEngineerOnline, setIsEngineerOnline] = useState(false);
  const [isClientWatching, setIsClientWatching] = useState(false);
  const [clientCoHostActive, setClientCoHostActive] = useState(false);
  const [isEngineerVideoActive, setIsEngineerVideoActive] = useState(false);
  const [isEngineerScreenSharing, setIsEngineerScreenSharing] = useState(false);
  const [isClientVideoActive, setIsClientVideoActive] = useState(false);
  const [isClientScreenSharing, setIsClientScreenSharing] = useState(false);
  const [isLocalScreenSharing, setIsLocalScreenSharing] = useState(false);
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [remoteVoiceActive, setRemoteVoiceActive] = useState(false);
  const [speakerBlocked, setSpeakerBlocked] = useState(false);
  const [liveDraftAnswer, setLiveDraftAnswer] = useState("");
  const [liveQuestionIndex, setLiveQuestionIndex] = useState(0);
  const [liveFrameDataUrl, setLiveFrameDataUrl] = useState<string | null>(null);
  const [clientScreenFrameDataUrl, setClientScreenFrameDataUrl] = useState<string | null>(null);
  const [clientVideoFrameDataUrl, setClientVideoFrameDataUrl] = useState<string | null>(null);

  // Hiring Client & local media controls
  const [liveQuestionInput, setLiveQuestionInput] = useState("");
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [clientQuestionFeedback, setClientQuestionFeedback] = useState<string | null>(null);
  const [camEnabled, setCamEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const coHostEnabled = camEnabled || micEnabled;
  const [newQuestionToast, setNewQuestionToast] = useState<string | null>(null);
  const [isTheaterFullscreen, setIsTheaterFullscreen] = useState(false);

  const stageContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const clientScreenPreviewRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const makingOfferRef = useRef<boolean>(false);
  const ignoreOfferRef = useRef<boolean>(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const lastSignalIdRef = useRef<number>(0);
  const lastAudioIdRef = useRef<number>(0);
  const webrtcConnectedRef = useRef<boolean>(false);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const audioPlayChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastOfferedToClientRef = useRef<boolean>(false);
  const answerTextRef = useRef<string>("");
  const currentIdxRef = useRef<number>(0);
  const autoAdvancedIdxRef = useRef<number | null>(null);
  const handleNextOrFinishRef = useRef<() => Promise<void> | void>(() => {});
  const questionsCountRef = useRef<number>(initialQuestions.length);
  const localScreenSharingRef = useRef<boolean>(false);
  const camEnabledRef = useRef<boolean>(false);
  const speechRecRef = useRef<SpeechRecLike | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clientCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    answerTextRef.current = answerText;
  }, [answerText]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  useEffect(() => {
    questionsCountRef.current = questions.length;
  }, [questions.length]);

  useEffect(() => {
    localScreenSharingRef.current = isLocalScreenSharing;
  }, [isLocalScreenSharing]);

  useEffect(() => {
    camEnabledRef.current = camEnabled;
  }, [camEnabled]);

  useEffect(() => {
    if (isLocalScreenSharing && screenStreamRef.current) {
      if (viewerRole === "candidate" && localVideoRef.current) {
        localVideoRef.current.srcObject = screenStreamRef.current;
      } else if (viewerRole === "client" && clientScreenPreviewRef.current) {
        clientScreenPreviewRef.current.srcObject = screenStreamRef.current;
      }
    } else if ((coHostEnabled || camEnabled) && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      void localVideoRef.current.play().catch(() => {});
    }
  }, [camEnabled, coHostEnabled, isLocalScreenSharing, viewerRole]);

  const speakQuestion = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.98;
      window.speechSynthesis.speak(utter);
    }
  }, []);

  const postLive = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/interview/${token}/live`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: viewerRole, ...payload }),
        });
        return res;
      } catch {
        return null;
      }
    },
    [token, viewerRole]
  );

  const getPlaybackContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      const Win = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx = Win.AudioContext || Win.webkitAudioContext;
      if (Ctx) {
        playbackCtxRef.current = new Ctx();
      }
    }
    const ctx = playbackCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      void ctx
        .resume()
        .then(() => setSpeakerBlocked(false))
        .catch(() => setSpeakerBlocked(true));
    }
    return ctx;
  }, []);

  const playRelayedWavChunk = useCallback(
    (dataUrl: string) => {
      audioPlayChainRef.current = audioPlayChainRef.current
        .then(async () => {
          const ctx = getPlaybackContext();
          if (!ctx) return;
          if (ctx.state === "suspended") {
            try {
              await ctx.resume();
            } catch {
              setSpeakerBlocked(true);
              return;
            }
            if (ctx.state === "suspended") {
              setSpeakerBlocked(true);
              return;
            }
          }
          const ab = decodeBase64AudioDataUrl(dataUrl);
          if (!ab) return;
          try {
            const decoded = await ctx.decodeAudioData(ab.slice(0));
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.connect(ctx.destination);
            if (
              nextPlayTimeRef.current < ctx.currentTime ||
              nextPlayTimeRef.current - ctx.currentTime > 2.5
            ) {
              nextPlayTimeRef.current = ctx.currentTime + 0.04;
            }
            const startAt = nextPlayTimeRef.current;
            nextPlayTimeRef.current = startAt + decoded.duration;
            src.start(startAt);
            setRemoteVoiceActive(true);
            setSpeakerBlocked(false);
          } catch {
            const fallbackAudio = new Audio(dataUrl);
            await fallbackAudio
              .play()
              .then(() => {
                setRemoteVoiceActive(true);
                setSpeakerBlocked(false);
              })
              .catch(() => setSpeakerBlocked(true));
          }
        })
        .catch(() => {
          // Keep audio playback chain alive across individual chunk errors
        });
    },
    [getPlaybackContext]
  );

  const unlockRemoteAudioPlayback = useCallback(() => {
    const ctx = getPlaybackContext();
    if (ctx && ctx.state === "suspended") {
      void ctx
        .resume()
        .then(() => setSpeakerBlocked(false))
        .catch(() => setSpeakerBlocked(true));
    } else if (ctx) {
      setSpeakerBlocked(false);
    }

    const vidEl = remoteVideoRef.current;
    if (vidEl && remoteVideoStreamRef.current && vidEl.srcObject !== remoteVideoStreamRef.current) {
      vidEl.srcObject = remoteVideoStreamRef.current;
      void vidEl.play().catch(() => {});
    }
  }, [getPlaybackContext]);

  useEffect(() => {
    const autoUnlock = () => {
      if (playbackCtxRef.current?.state === "suspended" || speakerBlocked) {
        unlockRemoteAudioPlayback();
      }
    };
    window.addEventListener("pointerdown", autoUnlock);
    window.addEventListener("keydown", autoUnlock);
    return () => {
      window.removeEventListener("pointerdown", autoUnlock);
      window.removeEventListener("keydown", autoUnlock);
    };
  }, [speakerBlocked, unlockRemoteAudioPlayback]);

  const ensurePeerConnection = useCallback(() => {
    if (
      pcRef.current &&
      pcRef.current.signalingState !== "closed" &&
      pcRef.current.connectionState !== "closed" &&
      pcRef.current.connectionState !== "failed"
    ) {
      return pcRef.current;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // Ignore
      }
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
    const videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
    audioSenderRef.current = audioTransceiver.sender;
    videoSenderRef.current = videoTransceiver.sender;

    const currentMicTrack = localStreamRef.current?.getAudioTracks()[0] ?? null;
    if (currentMicTrack) {
      void audioSenderRef.current.replaceTrack(currentMicTrack).catch(() => {});
    }
    const currentVideoTrack =
      screenStreamRef.current?.getVideoTracks()[0] ||
      localStreamRef.current?.getVideoTracks()[0] ||
      null;
    if (currentVideoTrack) {
      void videoSenderRef.current.replaceTrack(currentVideoTrack).catch(() => {});
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        void postLive({
          action: "WEBRTC_SIGNAL",
          kind: "ice",
          payload: ev.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (ev) => {
      if (ev.track.kind === "audio") {
        // Voice audio is carried reliably over the 16kHz PCM/WAV channel; keep WebRTC <audio> muted to avoid echo.
        const audioStream = new MediaStream([ev.track]);
        remoteAudioStreamRef.current = audioStream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.muted = true;
          remoteAudioRef.current.srcObject = audioStream;
        }
      } else {
        const videoStream = new MediaStream([ev.track]);
        remoteVideoStreamRef.current = videoStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = videoStream;
          void remoteVideoRef.current.play().catch(() => {});
        }
        setRemoteStreamActive(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        setRemoteStreamActive(false);
        webrtcConnectedRef.current = false;
      } else if (pc.connectionState === "connected") {
        setRemoteStreamActive(true);
        webrtcConnectedRef.current = true;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setRemoteStreamActive(true);
        webrtcConnectedRef.current = true;
      } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "closed") {
        webrtcConnectedRef.current = false;
      }
    };

    pcRef.current = pc;
    return pc;
  }, [postLive]);

  const createAndSendOffer = useCallback(async () => {
    try {
      const pc = ensurePeerConnection();
      if (pc.signalingState !== "stable") return;
      makingOfferRef.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await postLive({
        action: "WEBRTC_SIGNAL",
        kind: "offer",
        payload: pc.localDescription,
      });
    } catch {
      // Fallback live frame + transcript stream remains active
    } finally {
      makingOfferRef.current = false;
    }
  }, [ensurePeerConnection, postLive]);

  const processSignals = useCallback(
    async (signals: SignalMsg[]) => {
      const polite = viewerRole === "client";
      for (const sig of signals) {
        if (sig.id > lastSignalIdRef.current) {
          lastSignalIdRef.current = sig.id;
        }
        try {
          if (sig.kind === "offer") {
            const pc = ensurePeerConnection();
            const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
            ignoreOfferRef.current = !polite && offerCollision;
            if (ignoreOfferRef.current) continue;

            await pc.setRemoteDescription(
              new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit)
            );
            while (pendingIceRef.current.length > 0) {
              const cand = pendingIceRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await postLive({
              action: "WEBRTC_SIGNAL",
              kind: "answer",
              payload: pc.localDescription,
            });
          } else if (sig.kind === "answer" && pcRef.current) {
            if (pcRef.current.signalingState === "have-local-offer") {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit)
              );
              while (pendingIceRef.current.length > 0) {
                const cand = pendingIceRef.current.shift();
                if (cand) {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                }
              }
            }
          } else if (sig.kind === "ice" && sig.payload) {
            const pc = ensurePeerConnection();
            const cand = sig.payload as RTCIceCandidateInit;
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            } else {
              pendingIceRef.current.push(cand);
            }
          } else if (sig.kind === "renegotiate") {
            await createAndSendOffer();
          }
        } catch {
          // Ignore transient out-of-order WebRTC negotiation states
        }
      }
    },
    [createAndSendOffer, ensurePeerConnection, postLive, viewerRole]
  );

  // Capture lightweight frame snapshot from active local stage (camera or higher-res screen share)
  const captureFrameSnapshot = useCallback((): string | null => {
    const vid = localVideoRef.current;
    if (!vid || vid.readyState < 2 || !vid.videoWidth) return null;
    const isScreen = localScreenSharingRef.current;
    const width = isScreen ? 640 : 320;
    const height = isScreen ? 360 : 180;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(vid, 0, 0, width, height);
    return canvasRef.current.toDataURL("image/webp", isScreen ? 0.62 : 0.45);
  }, []);

  const captureClientScreenSnapshot = useCallback((): string | null => {
    const vid = clientScreenPreviewRef.current;
    if (!vid || vid.readyState < 2 || !vid.videoWidth) return null;
    if (!clientCanvasRef.current) {
      clientCanvasRef.current = document.createElement("canvas");
      clientCanvasRef.current.width = 640;
      clientCanvasRef.current.height = 360;
    }
    const ctx = clientCanvasRef.current.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(vid, 0, 0, 640, 360);
    return clientCanvasRef.current.toDataURL("image/webp", 0.62);
  }, []);

  // Poll live status, signals, new client-injected questions, and live engineer answers
  useEffect(() => {
    if (status === "COMPLETED") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/interview/${token}/live?viewer=${viewerRole}&coHost=${coHostEnabled ? "1" : "0"}&since=${lastSignalIdRef.current}&sinceAudio=${lastAudioIdRef.current}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.status && data.status !== status) {
          setStatus(data.status);
          if (data.status === "COMPLETED" && data.aiSummary) {
            setCompletedInfo({
              summary: data.aiSummary,
              score: data.overallScore ?? 88,
              recordingUrl: data.recordingUrl ?? null,
            });
            return;
          }
        }

        if (Array.isArray(data.questions)) {
          if (viewerRole === "candidate" && data.questions.length > questionsCountRef.current) {
            const addedQ = data.questions[data.questions.length - 1];
            setNewQuestionToast(`Live question added by ${companyName}: "${addedQ}"`);
            setTimeout(() => setNewQuestionToast(null), 6000);
          }
          setQuestions(data.questions);
        }

        if (Array.isArray(data.transcript) && viewerRole === "client") {
          setTranscript(data.transcript);
        }

        const live = data.live || {};
        setIsEngineerOnline(Boolean(live.isEngineerOnline));
        setIsClientWatching(Boolean(live.isClientWatching));
        setClientCoHostActive(Boolean(live.clientCoHostActive));
        setIsEngineerVideoActive(Boolean(live.isEngineerVideoActive));
        setIsEngineerScreenSharing(Boolean(live.isEngineerScreenSharing));
        setIsClientVideoActive(Boolean(live.isClientVideoActive));
        setIsClientScreenSharing(Boolean(live.isClientScreenSharing));

        if (viewerRole === "client") {
          if (typeof live.activeQuestionIndex === "number") {
            setLiveQuestionIndex(live.activeQuestionIndex);
          }
          if (typeof live.liveDraftAnswer === "string") {
            setLiveDraftAnswer(live.liveDraftAnswer);
          }
          setLiveFrameDataUrl(
            live.isEngineerVideoActive && live.liveFrameDataUrl ? live.liveFrameDataUrl : null
          );
        } else {
          setClientScreenFrameDataUrl(
            live.isClientScreenSharing && live.clientScreenFrameDataUrl
              ? live.clientScreenFrameDataUrl
              : null
          );
          setClientVideoFrameDataUrl(
            live.isClientVideoActive && live.clientVideoFrameDataUrl
              ? live.clientVideoFrameDataUrl
              : null
          );
          if (started && live.isClientWatching && !lastOfferedToClientRef.current) {
            lastOfferedToClientRef.current = true;
            await createAndSendOffer();
          } else if (!live.isClientWatching) {
            lastOfferedToClientRef.current = false;
          }
        }

        if (Array.isArray(live.signals) && live.signals.length > 0) {
          await processSignals(live.signals);
        }

        if (Array.isArray(live.audioChunks) && live.audioChunks.length > 0) {
          for (const chunk of live.audioChunks as Array<{ id: number; dataUrl: string }>) {
            if (chunk.id > lastAudioIdRef.current) {
              lastAudioIdRef.current = chunk.id;
              playRelayedWavChunk(chunk.dataUrl);
            }
          }
        }
      } catch {
        // Retry next interval
      }
    };

    if (viewerRole === "client") {
      void postLive({
        action: "WEBRTC_SIGNAL",
        kind: "renegotiate",
        payload: { mounted: Date.now() },
      });
    }

    void poll();
    const interval = setInterval(() => void poll(), 450);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    coHostEnabled,
    companyName,
    createAndSendOffer,
    playRelayedWavChunk,
    postLive,
    processSignals,
    started,
    status,
    token,
    viewerRole,
  ]);

  // Candidate: continuously sync live draft text + periodic camera/screen frame to server
  useEffect(() => {
    if (viewerRole !== "candidate" || !started || status === "COMPLETED") return;

    const timer = setInterval(() => {
      const hasVideo = camEnabledRef.current || localScreenSharingRef.current;
      const frame = hasVideo ? captureFrameSnapshot() : null;
      void postLive({
        action: "SYNC_STATE",
        activeQuestionIndex: currentIdxRef.current,
        liveDraftAnswer: answerTextRef.current,
        liveFrameDataUrl: frame,
        isScreenSharing: localScreenSharingRef.current,
        isVideoActive: hasVideo,
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [captureFrameSnapshot, postLive, started, status, viewerRole]);

  // Hiring Client: stream camera and/or screen-share snapshot fallback for guaranteed live delivery
  useEffect(() => {
    if (viewerRole !== "client" || (!isLocalScreenSharing && !camEnabled) || status === "COMPLETED") {
      return;
    }

    const timer = setInterval(() => {
      const screenFrame = isLocalScreenSharing ? captureClientScreenSnapshot() : null;
      const camFrame = camEnabled ? captureFrameSnapshot() : null;
      void postLive({
        action: "SYNC_CLIENT_MEDIA",
        isScreenSharing: isLocalScreenSharing,
        screenFrameDataUrl: screenFrame,
        isVideoActive: camEnabled,
        videoFrameDataUrl: camFrame,
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [
    camEnabled,
    captureClientScreenSnapshot,
    captureFrameSnapshot,
    isLocalScreenSharing,
    postLive,
    status,
    viewerRole,
  ]);

  // Live PCM->WAV audio capture & RMS mic level meter (reuses unlocked playback AudioContext cleanly)
  useEffect(() => {
    if (!micEnabled || status === "COMPLETED") {
      setMicLevel(0);
      return;
    }
    if (viewerRole === "candidate" && !started) {
      setMicLevel(0);
      return;
    }

    const micTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!micTrack) return;

    const captureCtx = getPlaybackContext();
    if (!captureCtx) return;

    let cancelled = false;
    const micStream = new MediaStream([micTrack]);
    const source = captureCtx.createMediaStreamSource(micStream);
    const processor = captureCtx.createScriptProcessor(4096, 1, 1);
    const silentGain = captureCtx.createGain();
    silentGain.gain.value = 0;

    const collected: Float32Array[] = [];
    let collectedSamples = 0;
    const targetSamplesPerPacket = Math.floor(captureCtx.sampleRate * 0.4); // ~400ms slices

    processor.onaudioprocess = (ev) => {
      if (cancelled) return;
      const channel = ev.inputBuffer.getChannelData(0);

      let sum = 0;
      for (let i = 0; i < channel.length; i += 1) {
        sum += channel[i] * channel[i];
      }
      const rms = Math.sqrt(sum / channel.length);
      setMicLevel(Math.min(100, Math.round(rms * 420)));

      collected.push(new Float32Array(channel));
      collectedSamples += channel.length;

      if (collectedSamples >= targetSamplesPerPacket) {
        const merged = new Float32Array(collectedSamples);
        let offset = 0;
        for (const buf of collected) {
          merged.set(buf, offset);
          offset += buf.length;
        }
        collected.length = 0;
        collectedSamples = 0;

        const wavDataUrl = encodeWavDataUrl(merged, captureCtx.sampleRate);
        void postLive({ action: "AUDIO_CHUNK", audioDataUrl: wavDataUrl }).then(async (res) => {
          if (cancelled) return;
          if (res?.ok) {
            setMediaNotice((prev) =>
              prev && prev.startsWith("Voice upload") ? null : prev
            );
          } else {
            let detail = "";
            if (res) {
              try {
                const body = (await res.json()) as { error?: string };
                if (body?.error) detail = `: ${body.error}`;
              } catch {
                // Ignore parse failure
              }
            }
            setMediaNotice(
              res
                ? `Voice upload returned HTTP ${res.status}${detail}.`
                : "Voice upload failed — check connection."
            );
          }
        });
      }
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(captureCtx.destination);

    return () => {
      cancelled = true;
      setMicLevel(0);
      try {
        processor.disconnect();
        source.disconnect();
        silentGain.disconnect();
      } catch {
        // Ignore
      }
    };
  }, [getPlaybackContext, micEnabled, postLive, started, status, viewerRole]);

  // Cleanup all streams & WebRTC on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      audioSenderRef.current = null;
      videoSenderRef.current = null;
      remoteVideoStreamRef.current = null;
      remoteAudioStreamRef.current = null;
      lastOfferedToClientRef.current = false;
      webrtcConnectedRef.current = false;
      try {
        void playbackCtxRef.current?.close();
      } catch {
        // Ignore
      }
      playbackCtxRef.current = null;
      try {
        speechRecRef.current?.stop();
      } catch {
        // Ignore
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleVoiceDictation = () => {
    if (dictating && speechRecRef.current) {
      speechRecRef.current.stop();
      setDictating(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecLike;
      webkitSpeechRecognition?: new () => SpeechRecLike;
    };
    const Rec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Rec) {
      setMediaNotice("Live voice-to-text dictation is not supported in this browser; please type below.");
      return;
    }

    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    const baseText = answerTextRef.current ? `${answerTextRef.current} ` : "";
    rec.onresult = (ev) => {
      let combined = "";
      for (let i = 0; i < ev.results.length; i += 1) {
        combined += ev.results[i][0].transcript;
      }
      setAnswerText(`${baseText}${combined}`.trim());
    };
    rec.onerror = () => setDictating(false);
    rec.start();
    speechRecRef.current = rec;
    setDictating(true);
  };

  const startSession = async () => {
    unlockRemoteAudioPlayback();
    setStarted(true);
    setStatus("IN_PROGRESS");

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        // Fallback to audio-only if camera is already held by another tab or absent
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          setMediaNotice("Camera unavailable or busy — microphone voice and live transcript started.");
        } catch {
          setMediaNotice(
            "Camera/Microphone permission unavailable — streaming live in Secure Text & Transcript Interview Mode."
          );
        }
      }

      if (stream) {
        localStreamRef.current = stream;
        if (localVideoRef.current && stream.getVideoTracks().length > 0) {
          localVideoRef.current.srcObject = stream;
          void localVideoRef.current.play().catch(() => {});
        }
        try {
          const recorder = new MediaRecorder(stream);
          chunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          recorder.start(1000);
          recorderRef.current = recorder;
        } catch {
          // Ignore recorder failure while keeping live audio/video active
        }
        const hasCam = stream.getVideoTracks().length > 0;
        const hasMic = stream.getAudioTracks().length > 0;
        setMediaActive(hasCam || hasMic);
        setCamEnabled(hasCam);
        camEnabledRef.current = hasCam;
        setMicEnabled(hasMic);
        ensurePeerConnection();
      }
    } else {
      setMediaNotice("Streaming live in Secure Text & Transcript Interview Mode.");
    }

    await postLive({
      action: "ENGINEER_START",
      activeQuestionIndex: 0,
      liveDraftAnswer: "",
      isVideoActive: camEnabledRef.current || localScreenSharingRef.current,
    });

    if (isClientWatching) {
      lastOfferedToClientRef.current = true;
      await createAndSendOffer();
    }

    if (questions[0]) {
      speakQuestion(`Question 1: ${questions[0]}`);
    }
  };

  const handleNextOrFinish = async () => {
    if (submitting || currentIdx >= questions.length) return;
    autoAdvancedIdxRef.current = currentIdx;
    const entry: TranscriptEntry = {
      question: questions[currentIdx],
      answer: answerText.trim() || "(Candidate provided verbal/recorded response)",
      timestamp: new Date().toISOString(),
    };
    const updatedTranscript = [...transcript, entry];
    setTranscript(updatedTranscript);
    setAnswerText("");

    if (currentIdx + 1 < questions.length) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setQuestionSecondsLeft(QUESTION_TIME_LIMIT_SEC);
      await postLive({
        action: "SYNC_STATE",
        activeQuestionIndex: nextIdx,
        liveDraftAnswer: "",
        completedTranscript: updatedTranscript,
      });
      speakQuestion(`Question ${nextIdx + 1}: ${questions[nextIdx]}`);
      return;
    }

    setSubmitting(true);
    try {
      try {
        speechRecRef.current?.stop();
      } catch {
        // Ignore
      }
      setDictating(false);

      let recordingBlob: Blob | null = null;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorderRef.current!.onstop = () => resolve();
          recorderRef.current!.stop();
        });
        if (chunksRef.current.length > 0) {
          recordingBlob = new Blob(chunksRef.current, { type: "video/webm" });
        }
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();

      const fd = new FormData();
      fd.append("transcriptJson", JSON.stringify(updatedTranscript));
      if (recordingBlob) {
        fd.append("recording", recordingBlob, `interview-${token}.webm`);
      }

      const res = await fetch(`/api/interview/${token}`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setStatus("COMPLETED");
        setCompletedInfo({
          summary: data.interview.aiSummary,
          score: data.interview.overallScore,
          recordingUrl: data.interview.recordingUrl,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  handleNextOrFinishRef.current = handleNextOrFinish;

  // 1-minute per-question countdown timer on engineer view; auto-advances when time reaches 0
  useEffect(() => {
    if (viewerRole !== "candidate" || !started || status === "COMPLETED") {
      return;
    }
    if (currentIdx >= questions.length) return;

    autoAdvancedIdxRef.current = null;
    setQuestionSecondsLeft(QUESTION_TIME_LIMIT_SEC);

    const interval = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          if (autoAdvancedIdxRef.current !== currentIdx) {
            autoAdvancedIdxRef.current = currentIdx;
            setTimeout(() => {
              void handleNextOrFinishRef.current();
            }, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIdx, questions.length, started, status, viewerRole]);

  // Shared Screen Share Controller for both Hiring Client and Engineer
  const stopLocalScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    localScreenSharingRef.current = false;
    setIsLocalScreenSharing(false);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    if (videoSenderRef.current) {
      await videoSenderRef.current.replaceTrack(cameraTrack).catch(() => {});
    }

    if (viewerRole === "candidate" && localVideoRef.current) {
      localVideoRef.current.srcObject = cameraTrack && localStreamRef.current ? localStreamRef.current : null;
    }

    if (viewerRole === "client") {
      await postLive({
        action: "SYNC_SCREEN",
        isScreenSharing: false,
        screenFrameDataUrl: null,
      });
      await createAndSendOffer();
    } else {
      await postLive({
        action: "SYNC_STATE",
        isScreenSharing: false,
        isVideoActive: camEnabledRef.current,
      });
      await createAndSendOffer();
    }
  }, [createAndSendOffer, postLive, viewerRole]);

  const toggleScreenShare = async () => {
    if (isLocalScreenSharing || screenStreamRef.current) {
      await stopLocalScreenShare();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setMediaNotice("Screen sharing is not supported in this browser.");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = screenStream;
      localScreenSharingRef.current = true;
      setIsLocalScreenSharing(true);

      screenTrack.onended = () => {
        void stopLocalScreenShare();
      };

      ensurePeerConnection();
      if (videoSenderRef.current) {
        await videoSenderRef.current.replaceTrack(screenTrack);
      }

      unlockRemoteAudioPlayback();

      if (viewerRole === "candidate") {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
          void localVideoRef.current.play().catch(() => {});
        }
        await postLive({
          action: "SYNC_STATE",
          isScreenSharing: true,
          isVideoActive: true,
        });
        await createAndSendOffer();
      } else {
        if (clientScreenPreviewRef.current) {
          clientScreenPreviewRef.current.srcObject = screenStream;
          void clientScreenPreviewRef.current.play().catch(() => {});
        }
        await postLive({
          action: "SYNC_SCREEN",
          isScreenSharing: true,
        });
        await createAndSendOffer();
      }
    } catch {
      setMediaNotice("Screen share permission cancelled or unavailable.");
    }
  };

  const toggleStageFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsTheaterFullscreen(false);
        return;
      }
      if (stageContainerRef.current?.requestFullscreen) {
        await stageContainerRef.current.requestFullscreen();
        setIsTheaterFullscreen(true);
        return;
      }
    } catch {
      // Fall back to CSS viewport fullscreen overlay
    }
    setIsTheaterFullscreen((prev) => !prev);
  };

  // Independent Camera & Voice toggles for both Hiring Client and Engineer
  const toggleCamera = async () => {
    unlockRemoteAudioPlayback();
    const nextCam = !camEnabled;
    if (!nextCam) {
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      if (videoSenderRef.current && !localScreenSharingRef.current) {
        await videoSenderRef.current.replaceTrack(null).catch(() => {});
      }
      if (localVideoRef.current && !localScreenSharingRef.current) {
        localVideoRef.current.srcObject = null;
      }
      camEnabledRef.current = false;
      setCamEnabled(false);
      if (viewerRole === "candidate") {
        setMediaActive(micEnabled);
        await postLive({
          action: "SYNC_STATE",
          isVideoActive: localScreenSharingRef.current,
        });
      } else {
        await postLive({
          action: "SYNC_CLIENT_MEDIA",
          coHostActive: micEnabled,
          isVideoActive: false,
          videoFrameDataUrl: null,
        });
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaNotice("Camera API is unavailable. Open the page over https:// or http://localhost.");
      return;
    }

    let camStream: MediaStream;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err) {
      const domErr = err as { name?: string; message?: string } | undefined;
      const errName = domErr?.name || "Error";
      if (errName === "NotReadableError" || errName === "AbortError" || errName === "TrackStartError") {
        setMediaNotice(
          "Camera is already in use by another tab or app on this device (if testing both Client & Engineer tabs on the same PC, turn Camera Off in the other tab first)."
        );
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setMediaNotice("No camera device was found on this computer.");
      } else if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setMediaNotice(
          "Camera permission is blocked. Click the site settings icon in Chrome's address bar and set Camera to Allow."
        );
      } else {
        setMediaNotice(`Could not access camera (${errName}${domErr?.message ? `: ${domErr.message}` : ""}).`);
      }
      return;
    }

    try {
      setMediaNotice(null);
      const camTrack = camStream.getVideoTracks()[0];
      if (!camTrack) return;

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      localStreamRef.current.addTrack(camTrack);

      if (localVideoRef.current && !localScreenSharingRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        void localVideoRef.current.play().catch(() => {});
      }

      ensurePeerConnection();
      if (!localScreenSharingRef.current && videoSenderRef.current) {
        await videoSenderRef.current.replaceTrack(camTrack);
      }

      camEnabledRef.current = true;
      setCamEnabled(true);
      if (viewerRole === "candidate") {
        setMediaActive(true);
        await postLive({
          action: "SYNC_STATE",
          isVideoActive: true,
        });
      } else {
        await postLive({
          action: "SYNC_CLIENT_MEDIA",
          coHostActive: true,
          isVideoActive: true,
        });
      }
      await createAndSendOffer();
    } catch {
      // Camera captured locally even if peer signaling is still connecting
    }
  };

  const toggleVoice = async () => {
    unlockRemoteAudioPlayback();
    const nextMic = !micEnabled;
    if (!nextMic) {
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      if (audioSenderRef.current) {
        await audioSenderRef.current.replaceTrack(null).catch(() => {});
      }
      setMicEnabled(false);
      if (viewerRole === "candidate") {
        setMediaActive(camEnabled);
      } else {
        await postLive({
          action: "SYNC_CLIENT_MEDIA",
          coHostActive: camEnabled,
        });
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaNotice("Microphone is not available in this browser.");
      return;
    }

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (err) {
      const domErr = err as { name?: string; message?: string } | undefined;
      const errName = domErr?.name || "Error";
      if (errName === "NotReadableError" || errName === "AbortError" || errName === "TrackStartError") {
        setMediaNotice("Microphone is in use by another tab or application on this device.");
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setMediaNotice("No microphone device was found on this computer.");
      } else if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setMediaNotice("Microphone permission is blocked. Allow Microphone in your browser site settings.");
      } else {
        setMediaNotice(`Could not access microphone (${errName}).`);
      }
      return;
    }

    try {
      setMediaNotice(null);
      const micTrack = micStream.getAudioTracks()[0];
      if (!micTrack) return;

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      localStreamRef.current.addTrack(micTrack);

      ensurePeerConnection();
      if (audioSenderRef.current) {
        await audioSenderRef.current.replaceTrack(micTrack);
      }

      setMicEnabled(true);
      if (viewerRole === "candidate") {
        setMediaActive(true);
      } else {
        await postLive({
          action: "SYNC_CLIENT_MEDIA",
          coHostActive: true,
        });
      }
      await createAndSendOffer();
    } catch {
      // Microphone captured locally even if peer signaling is still connecting
    }
  };

  // Hiring Client: Send live follow-up question right into the active interview
  const handleAskLiveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = liveQuestionInput.trim();
    if (!q) return;
    setSendingQuestion(true);
    setClientQuestionFeedback(null);
    try {
      const res = await postLive({
        action: "ASK_LIVE_QUESTION",
        question: q,
      });
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions)) {
          setQuestions(data.questions);
        }
        setLiveQuestionInput("");
        setClientQuestionFeedback("Live question queued for the engineer & AI prompt.");
        setTimeout(() => setClientQuestionFeedback(null), 4000);
      } else {
        setClientQuestionFeedback("Failed to send live question.");
      }
    } finally {
      setSendingQuestion(false);
    }
  };

  // Completed State View (shared nicely for both Client and Engineer)
  if (status === "COMPLETED" && completedInfo) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-8 shadow-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <span className="inline-block rounded-full bg-[#0A192F] px-3.5 py-1 text-xs font-bold text-sky-300">
            AI Interview Score: {completedInfo.score}/100
          </span>
          <h2 className="font-heading text-2xl font-extrabold text-[#0A0F1A]">
            Interview Completed &amp; Archived
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">{completedInfo.summary}</p>
        </div>

        {viewerRole === "client" && completedInfo.recordingUrl && (
          <video
            controls
            src={completedInfo.recordingUrl}
            className="w-full rounded-xl border border-slate-200 bg-black"
          />
        )}

        {transcript.length > 0 && (
          <div className="space-y-2.5 text-left border-t border-slate-100 pt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recorded Q&amp;A Transcript ({transcript.length})
            </div>
            {transcript.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 text-xs space-y-1">
                <div className="font-bold text-[#0A192F]">
                  Q{i + 1}: {item.question}
                </div>
                <div className="text-slate-700">{item.answer}</div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex justify-center">
          <Link
            href="/portal"
            className="rounded-full bg-[#0A192F] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A]"
          >
            Return to Client Portal Pipeline →
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================================
  // HIRING CLIENT VIEW: WATCH LIVE + CO-INTERVIEW + ASK LIVE QUESTIONS
  // ============================================================================
  if (viewerRole === "client") {
    const activeQuestionText =
      questions[liveQuestionIndex] || questions[questions.length - 1] || "Waiting for question...";

    return (
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Left: Live Broadcast Feed from Engineer */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-[#0A0F1A] text-white overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-semibold text-sky-300">
                <Eye className="h-4 w-4" />
                Live Broadcast — {profileCode}
              </span>
              <div className="flex items-center gap-2">
                {isEngineerScreenSharing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                    <MonitorUp className="h-3 w-3" /> SCREEN SHARE
                  </span>
                )}
                {isEngineerOnline ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[11px] font-bold text-rose-300">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    ENGINEER LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    WAITING FOR ENGINEER
                  </span>
                )}
              </div>
            </div>

            <div
              ref={stageContainerRef}
              className={`bg-[#0A192F] relative flex items-center justify-center ${
                isTheaterFullscreen ? "fixed inset-0 z-50 w-screen h-screen" : "aspect-video"
              }`}
            >
              <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />
              <video
                ref={remoteVideoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full ${
                  isEngineerScreenSharing || isTheaterFullscreen ? "object-contain bg-black" : "object-cover"
                } ${remoteStreamActive && isEngineerVideoActive ? "block" : "hidden"}`}
              />
              {!remoteStreamActive && isEngineerVideoActive && liveFrameDataUrl && isEngineerOnline && (
                <img
                  src={liveFrameDataUrl}
                  alt="Live candidate feed"
                  className={`h-full w-full ${
                    isEngineerScreenSharing || isTheaterFullscreen ? "object-contain bg-black" : "object-cover"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => void toggleStageFullscreen()}
                title={isTheaterFullscreen ? "Exit full screen" : "Full screen"}
                className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-lg bg-black/65 hover:bg-black/85 px-2.5 py-1.5 text-[11px] font-semibold text-white transition"
              >
                {isTheaterFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" /> Exit
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" /> Full Screen
                  </>
                )}
              </button>
              {(!isEngineerVideoActive || (!remoteStreamActive && !liveFrameDataUrl) || !isEngineerOnline) && (
                <div className="text-center p-6 space-y-2.5">
                  <div className="mx-auto h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
                    <Video className="h-7 w-7 text-sky-300" />
                  </div>
                  <div className="text-xs font-medium text-slate-200">
                    {isEngineerOnline
                      ? "Transcript Capture Active"
                      : "Waiting for the engineer to start their interview session..."}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Live camera, screen share, audio, and real-time responses will appear here automatically.
                  </div>
                </div>
              )}

              {speakerBlocked && (
                <button
                  type="button"
                  onClick={unlockRemoteAudioPlayback}
                  className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow transition"
                >
                  <Volume2 className="h-3.5 w-3.5" /> Enable Speaker Audio
                </button>
              )}

              {/* Local Client Camera PiP when camera enabled */}
              <div
                className={`absolute bottom-3 right-3 w-32 aspect-video rounded-lg overflow-hidden border-2 border-sky-400 bg-black shadow-lg ${
                  camEnabled ? "block" : "hidden"
                }`}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Local Client Shared Screen Preview PiP when sharing */}
              <div
                className={`absolute bottom-3 left-3 w-36 aspect-video rounded-lg overflow-hidden border-2 border-emerald-400 bg-black shadow-lg ${
                  isLocalScreenSharing ? "block" : "hidden"
                }`}
              >
                <video
                  ref={clientScreenPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-contain"
                />
                <span className="absolute top-1 left-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  YOUR SCREEN
                </span>
              </div>
            </div>

            <div className="p-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 text-xs">
              <div>
                <div className="font-semibold text-white">
                  {profileCode} — {roleTitle}
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                  <span>Status: {status === "IN_PROGRESS" ? "Interview In Progress" : status}</span>
                  {remoteVoiceActive && (
                    <span className="text-emerald-300 font-semibold">· Receiving Audio</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleScreenShare()}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                    isLocalScreenSharing
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {isLocalScreenSharing ? (
                    <>
                      <MonitorOff className="h-3.5 w-3.5" /> Stop Screen Share
                    </>
                  ) : (
                    <>
                      <MonitorUp className="h-3.5 w-3.5" /> Share Screen
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleCamera()}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                    camEnabled
                      ? "bg-[#1D4ED8] text-white hover:bg-sky-600"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {camEnabled ? (
                    <>
                      <Video className="h-3.5 w-3.5" /> Camera On
                    </>
                  ) : (
                    <>
                      <VideoOff className="h-3.5 w-3.5" /> Open Camera
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleVoice()}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                    micEnabled
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {micEnabled ? (
                    <>
                      <Mic className="h-3.5 w-3.5" /> Voice On
                      <span
                        className="inline-block h-2 rounded-full bg-white transition-all"
                        style={{ width: `${Math.max(4, Math.min(20, Math.round(micLevel / 5)))}px` }}
                      />
                    </>
                  ) : (
                    <>
                      <MicOff className="h-3.5 w-3.5" /> Open Voice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {mediaNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {mediaNotice}
            </div>
          )}

          {/* Ask Live Follow-Up Question Card */}
          <form
            onSubmit={handleAskLiveQuestion}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#0A192F]">
              <MessageSquarePlus className="h-4 w-4 text-[#1D4ED8]" />
              Ask a Live Question During This Interview
            </div>
            <p className="text-[11px] text-slate-500">
              Send a custom question directly into the engineer&apos;s active session. The AI Interviewer will queue and read it aloud to the engineer.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={liveQuestionInput}
                onChange={(e) => setLiveQuestionInput(e.target.value)}
                placeholder="e.g. How did you handle database failover in your last production release?"
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendingQuestion || !liveQuestionInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A192F] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {sendingQuestion ? "Sending..." : "Ask Live"}
              </button>
            </div>
            {clientQuestionFeedback && (
              <div className="text-[11px] font-semibold text-emerald-700">
                {clientQuestionFeedback}
              </div>
            )}
          </form>
        </div>

        {/* Right: Live Active Response + Question Queue & Transcript */}
        <div className="lg:col-span-6 space-y-5">
          {/* Currently Active Question & Live Draft Stream */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-[#1D4ED8]">
                Active Question ({Math.min(liveQuestionIndex + 1, questions.length)} of {questions.length})
              </span>
              <span className="text-slate-500">
                {isEngineerOnline ? "Live typing & speech synced" : "Awaiting engineer answer"}
              </span>
            </div>

            <div className="rounded-xl bg-[#0A192F] p-4 text-white text-sm font-semibold leading-snug">
              {activeQuestionText}
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 min-h-[110px] space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Engineer&apos;s Live Response Stream
              </div>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {liveDraftAnswer
                  ? liveDraftAnswer
                  : isEngineerOnline
                  ? "Engineer is speaking or composing response..."
                  : "No live response yet."}
              </p>
            </div>
          </div>

          {/* Questions & Submitted Answers Feed */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Interview Questions &amp; Live Answers ({transcript.length}/{questions.length})
              </h3>
            </div>
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const answered = transcript[idx];
                const isCurrent = isEngineerOnline && idx === liveQuestionIndex;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
                      isCurrent
                        ? "border-[#1D4ED8] bg-sky-50/40"
                        : answered
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#0A192F]">Question {idx + 1}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          answered
                            ? "bg-emerald-100 text-emerald-800"
                            : isCurrent
                            ? "bg-sky-100 text-[#1D4ED8]"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {answered ? "Answered" : isCurrent ? "Live Now" : "Queued"}
                      </span>
                    </div>
                    <div className="font-medium text-slate-800">{q}</div>
                    {answered && (
                      <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-slate-700">
                        {answered.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ENGINEER / CANDIDATE INTERVIEW ROOM VIEW
  // ============================================================================
  const showClientPrimary =
    (remoteStreamActive && (isClientVideoActive || isClientScreenSharing)) ||
    (isClientScreenSharing && Boolean(clientScreenFrameDataUrl)) ||
    (isClientVideoActive && Boolean(clientVideoFrameDataUrl));

  return (
    <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Video/AI Stage (Hiring Client fills stage when live/sharing; Full-Screen capable) */}
      <div className="lg:col-span-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-[#0A0F1A] text-white overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
              <Bot className="h-4 w-4" />
              {showClientPrimary
                ? isClientScreenSharing
                  ? `${companyName} — Live Shared Screen`
                  : `${companyName} — Live Interviewer`
                : "Via Codos AI Interviewer"}
            </span>
            <div className="flex items-center gap-2">
              {isClientWatching && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <Eye className="h-3 w-3" /> Client Live
                </span>
              )}
              {mediaActive && (
                <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> REC
                </span>
              )}
            </div>
          </div>

          <div
            ref={stageContainerRef}
            className={`bg-[#0A192F] relative flex items-center justify-center ${
              isTheaterFullscreen ? "fixed inset-0 z-50 w-screen h-screen" : "aspect-video"
            }`}
          >
            <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />
            {/* Hiring Client Primary Full Stage (WebRTC live feed or live screen/camera fallback) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full ${
                isClientScreenSharing ? "object-contain bg-black" : "object-cover bg-black"
              } ${remoteStreamActive && (isClientVideoActive || isClientScreenSharing) ? "block" : "hidden"}`}
            />
            {!(remoteStreamActive && (isClientVideoActive || isClientScreenSharing)) &&
              isClientScreenSharing &&
              clientScreenFrameDataUrl && (
                <img
                  src={clientScreenFrameDataUrl}
                  alt="Hiring client live screen share"
                  className="h-full w-full object-contain bg-black"
                />
              )}
            {!(remoteStreamActive && (isClientVideoActive || isClientScreenSharing)) &&
              !isClientScreenSharing &&
              isClientVideoActive &&
              clientVideoFrameDataUrl && (
                <img
                  src={clientVideoFrameDataUrl}
                  alt="Hiring client live camera"
                  className="h-full w-full object-cover bg-black"
                />
              )}
            {speakerBlocked && (
              <button
                type="button"
                onClick={unlockRemoteAudioPlayback}
                className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow transition"
              >
                <Volume2 className="h-3.5 w-3.5" /> Enable Speaker Audio
              </button>
            )}

            {/* Engineer Local Feed: full stage when client isn't presenting video/screen, OR corner PiP when client IS live */}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={
                showClientPrimary
                  ? `absolute bottom-3 right-3 w-28 aspect-video rounded-lg border-2 border-sky-400 bg-black object-cover shadow-lg z-10 ${
                      camEnabled || isLocalScreenSharing ? "block" : "hidden"
                    }`
                  : `h-full w-full ${
                      isLocalScreenSharing ? "object-contain bg-black" : "object-cover"
                    } ${camEnabled || isLocalScreenSharing ? "block" : "hidden"}`
              }
            />

            {!showClientPrimary && !camEnabled && !isLocalScreenSharing && (
              <div className="text-center p-6 space-y-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
                  <Video className="h-7 w-7 text-sky-300" />
                </div>
                <div className="text-xs text-slate-300">
                  {started
                    ? "Transcript Capture Active"
                    : "Camera & Microphone will initialize when you start"}
                </div>
              </div>
            )}

            {/* Full Screen Expand Button */}
            {(showClientPrimary || camEnabled || isLocalScreenSharing) && (
              <button
                type="button"
                onClick={() => void toggleStageFullscreen()}
                title={isTheaterFullscreen ? "Exit full screen" : "Full screen client feed"}
                className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-lg bg-black/70 hover:bg-black/90 px-2.5 py-1.5 text-[11px] font-semibold text-white transition"
              >
                {isTheaterFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" /> Exit Full Screen
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" /> Full Screen
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-4 text-xs text-slate-300 space-y-2.5">
            <div className="space-y-1">
              <div>
                <strong>Profile:</strong> {profileCode} — {roleTitle}
              </div>
              <div>
                <strong>Hiring Client:</strong> {companyName}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isClientWatching && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-emerald-300 font-medium">
                  <UserCheck className="h-3.5 w-3.5" />
                  {clientCoHostActive
                    ? "Hiring Client on live mic/cam"
                    : "Hiring Client watching live"}
                </span>
              )}
              {started && (
                <>
                  <button
                    type="button"
                    onClick={() => void toggleCamera()}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                      camEnabled
                        ? "bg-[#1D4ED8] text-white hover:bg-sky-600"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    {camEnabled ? (
                      <>
                        <Video className="h-3.5 w-3.5" /> Camera On
                      </>
                    ) : (
                      <>
                        <VideoOff className="h-3.5 w-3.5" /> Open Camera
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleVoice()}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                      micEnabled
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    {micEnabled ? (
                      <>
                        <Mic className="h-3.5 w-3.5" /> Voice On
                        <span
                          className="inline-block h-2 rounded-full bg-white transition-all"
                          style={{ width: `${Math.max(4, Math.min(20, Math.round(micLevel / 5)))}px` }}
                        />
                      </>
                    ) : (
                      <>
                        <MicOff className="h-3.5 w-3.5" /> Open Voice
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleScreenShare()}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                      isLocalScreenSharing
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    {isLocalScreenSharing ? (
                      <>
                        <MonitorOff className="h-3.5 w-3.5" /> Stop Sharing Screen
                      </>
                    ) : (
                      <>
                        <MonitorUp className="h-3.5 w-3.5" /> Share My Screen
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {mediaNotice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {mediaNotice}
          </div>
        )}

        {newQuestionToast && (
          <div className="rounded-xl border border-sky-300 bg-sky-50 p-3.5 text-xs font-semibold text-[#0A192F] shadow-sm">
            {newQuestionToast}
          </div>
        )}
      </div>

      {/* Right: Interactive AI Questions & Response Capture */}
      <div className="lg:col-span-6">
        {!started ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">
            <h2 className="font-heading text-2xl font-bold text-[#0A0F1A]">
              Ready for Your AI &amp; Live Client Interview?
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              The hiring client has prepared <strong>{questions.length}</strong> question(s) and can observe live or ask follow-up questions in real time. Your video/audio and Q&amp;A transcript will be securely shared with the client.
            </p>
            <div className="rounded-xl bg-[#F8FAFC] border border-slate-200 p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Initial Interview Topics
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={startSession}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-bold text-white hover:bg-[#1E3A8A]"
            >
              <Play className="h-4 w-4" />
              Start Live Interview Session
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#1D4ED8]">
              <div className="flex items-center gap-2.5">
                <span>
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums transition ${
                    questionSecondsLeft <= 15
                      ? "bg-rose-100 text-rose-700 animate-pulse"
                      : "bg-sky-50 text-[#0A192F] border border-sky-200"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {String(Math.floor(questionSecondsLeft / 60)).padStart(2, "0")}:
                  {String(questionSecondsLeft % 60).padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleVoiceDictation}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                    dictating
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Mic className="h-3 w-3" />
                  {dictating ? "Stop Voice-to-Text" : "Dictate Answer"}
                </button>
                <button
                  type="button"
                  onClick={() => speakQuestion(questions[currentIdx])}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Volume2 className="h-3.5 w-3.5" /> Replay Voice Prompt
                </button>
              </div>
            </div>

            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  questionSecondsLeft <= 15 ? "bg-rose-500" : "bg-[#1D4ED8]"
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, (questionSecondsLeft / QUESTION_TIME_LIMIT_SEC) * 100))}%`,
                }}
              />
            </div>

            <div className="rounded-xl bg-[#0A192F] p-5 text-white">
              <p className="font-heading text-lg font-bold leading-snug">
                {questions[currentIdx]}
              </p>
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-[#0A0F1A] mb-1.5">
                <span>Your Response Transcript (Live Streamed to Client)</span>
                <span className="inline-flex items-center gap-1 text-slate-500 font-normal">
                  <Mic className="h-3 w-3" /> Speak or type your structured answer
                </span>
              </label>
              <textarea
                rows={5}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type or dictate your detailed technical / operational answer here..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                {transcript.length} question(s) answered
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={handleNextOrFinish}
                className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
              >
                {currentIdx + 1 < questions.length ? (
                  <>
                    Save &amp; Next Question <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    {submitting ? "Archiving Recording & Transcript..." : "Finish & Submit Interview"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
