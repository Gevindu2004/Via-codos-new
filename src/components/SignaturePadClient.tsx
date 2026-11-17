"use client";

import React, { useEffect, useRef, useState } from "react";
import { sanitizeRichHtml } from "@/lib/sanitize";
import {
  PenTool,
  Type,
  Upload,
  CheckCircle2,
  Download,
  RotateCcw,
  Move,
  Mail,
  ShieldCheck,
} from "lucide-react";

interface SigReqView {
  id: string;
  token: string;
  documentTitle: string;
  documentVersion: string;
  renderedHtml: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  partyBName: string;
  partyBEmail: string;
  status: string;
  signerFullName: string | null;
  signedDateText: string | null;
  verificationHash: string | null;
  signedPdfPath: string | null;
}

export function SignaturePadClient({ initialRequest }: { initialRequest: SigReqView }) {
  const [reqData, setReqData] = useState<SigReqView>(initialRequest);
  const [mode, setMode] = useState<"DRAW" | "TYPE" | "UPLOAD">("DRAW");
  const [typedName, setTypedName] = useState(initialRequest.clientName || "");
  const [typedFont, setTypedFont] = useState<"Georgia, serif" | "'Brush Script MT', cursive">(
    "'Brush Script MT', cursive"
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  const [signerFullName, setSignerFullName] = useState(initialRequest.clientName || "");
  const [signerTitle, setSignerTitle] = useState("");
  const [signedDateText, setSignedDateText] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [agreed, setAgreed] = useState(false);

  // Interactive mouse/touch placement position inside the signature field box (percentage 0..1)
  const [sigPos, setSigPos] = useState({ xPct: 0.15, yPct: 0.25 });
  const [isDraggingSig, setIsDraggingSig] = useState(false);
  const [hasPlacedOnField, setHasPlacedOnField] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldBoxRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize crisp canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0A192F";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [mode]);

  // Render typed signature to PNG data URL
  useEffect(() => {
    if (mode !== "TYPE") return;
    if (!typedName.trim()) {
      setSignatureDataUrl("");
      return;
    }
    const offscreen = document.createElement("canvas");
    offscreen.width = 520;
    offscreen.height = 160;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.fillStyle = "#0A192F";
    ctx.font = `italic 48px ${typedFont}`;
    ctx.textBaseline = "middle";
    ctx.fillText(typedName.trim(), 24, 82);
    setSignatureDataUrl(offscreen.toDataURL("image/png"));
    setHasPlacedOnField(true);
  }, [mode, typedName, typedFont]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleDrawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    isDrawingRef.current = true;
    const pt = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handleDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pt = getPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handleDrawEnd = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (canvasRef.current) {
      setSignatureDataUrl(canvasRef.current.toDataURL("image/png"));
      setHasPlacedOnField(true);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl("");
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSignatureDataUrl(reader.result);
        setHasPlacedOnField(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const updatePlacementFromPointer = (clientX: number, clientY: number) => {
    const box = fieldBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const xPct = Math.min(Math.max((clientX - rect.left) / rect.width - 0.15, 0), 0.65);
    const yPct = Math.min(Math.max((clientY - rect.top) / rect.height - 0.25, 0), 0.55);
    setSigPos({ xPct, yPct });
    setHasPlacedOnField(true);
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signatureDataUrl) {
      setError("Please draw, type, or upload your signature first.");
      return;
    }
    if (!agreed) {
      setError("Please check 'I agree to sign electronically'.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${reqData.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureMode: mode,
          signatureDataUrl,
          signaturePosition: sigPos,
          signerFullName,
          signerTitle,
          signedDateText,
          agreedToElectronic: agreed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to execute signature.");
      } else {
        setReqData(data.signatureRequest);
      }
    } catch {
      setError("Network error while signing document.");
    } finally {
      setSubmitting(false);
    }
  };

  if (reqData.status === "SIGNED") {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-8 shadow-lg space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Electronically Executed &amp; Stamped
            </span>
            <h2 className="font-heading text-2xl font-extrabold text-[#0A0F1A]">
              {reqData.documentTitle} (v{reqData.documentVersion})
            </h2>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 space-y-2 text-xs text-slate-700">
          <div>
            <strong>Signed By:</strong> {reqData.signerFullName} ({reqData.clientEmail})
          </div>
          <div>
            <strong>Execution Date:</strong> {reqData.signedDateText}
          </div>
          <div className="font-mono break-all">
            <strong>SHA-256 Verification Hash:</strong> {reqData.verificationHash}
          </div>
          <div className="flex items-center gap-2 text-emerald-700 font-semibold pt-1">
            <Mail className="h-4 w-4" />
            Signed PDF dispatched to both {reqData.clientEmail} and {reqData.partyBEmail}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/sign/${reqData.token}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-bold text-white hover:bg-[#1E3A8A] transition"
          >
            <Download className="h-4 w-4" />
            Download Stamped Signed PDF
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Agreement Document & Interactive Signature Field Placement */}
      <div className="lg:col-span-7 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#0A192F] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                Electronic Agreement · v{reqData.documentVersion}
              </div>
              <h2 className="font-heading text-xl font-bold">{reqData.documentTitle}</h2>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              Recipient: {reqData.clientName}
            </span>
          </div>

          <div className="p-6 sm:p-8 max-h-[540px] overflow-y-auto border-b border-slate-200">
            <div
              className="vc-prose text-sm"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(reqData.renderedHtml) }}
            />
          </div>

          {/* Interactive Signature Field Placement Area (Mouse or Touch) */}
          <div className="p-6 bg-[#F8FAFC] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A192F]">
                <Move className="h-4 w-4 text-[#1D4ED8]" />
                Signature Field Placement (Tap or Drag with Mouse / Touch)
              </div>
              {hasPlacedOnField && signatureDataUrl && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  ✓ Placed on field
                </span>
              )}
            </div>

            <div
              ref={fieldBoxRef}
              onPointerDown={(e) => {
                setIsDraggingSig(true);
                e.currentTarget.setPointerCapture(e.pointerId);
                updatePlacementFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!isDraggingSig) return;
                updatePlacementFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={() => setIsDraggingSig(false)}
              className="relative h-44 w-full rounded-xl border-2 border-dashed border-[#0A192F]/35 bg-white touch-none select-none overflow-hidden cursor-crosshair"
            >
              <div className="absolute bottom-4 left-6 right-6 border-b border-slate-300 pointer-events-none" />
              <div className="absolute bottom-1.5 left-6 text-[10px] uppercase tracking-wider text-slate-400 pointer-events-none">
                Authorized Signer Line — {signerFullName || reqData.clientName} · {signedDateText}
              </div>

              {signatureDataUrl ? (
                <div
                  style={{
                    left: `${sigPos.xPct * 100}%`,
                    top: `${sigPos.yPct * 100}%`,
                  }}
                  className="absolute w-44 h-20 rounded-lg border border-[#1D4ED8]/40 bg-white/90 p-1 shadow-sm pointer-events-none flex items-center justify-center"
                >
                  <img
                    src={signatureDataUrl}
                    alt="Placed Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 px-4 text-center pointer-events-none">
                  Create your signature on the right, then tap or drag anywhere in this box to place it on the signature field.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Create Signature + Signer Metadata + Consent */}
      <div className="lg:col-span-5">
        <form
          onSubmit={handleExecute}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 sticky top-24"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-heading text-lg font-bold text-[#0A0F1A]">
              Adopt &amp; Place Signature
            </h3>
            <ShieldCheck className="h-5 w-5 text-[#1D4ED8]" />
          </div>

          {/* Signature Mode Tabs */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
            {[
              { id: "DRAW", label: "Draw", icon: PenTool },
              { id: "TYPE", label: "Type", icon: Type },
              { id: "UPLOAD", label: "Upload", icon: Upload },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id as "DRAW" | "TYPE" | "UPLOAD")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                  mode === id
                    ? "bg-[#0A192F] text-white shadow-sm"
                    : "text-slate-600 hover:text-[#0A0F1A]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Mode UI */}
          {mode === "DRAW" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Sign with mouse or finger</span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center gap-1 text-[#1D4ED8] font-semibold hover:underline"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={460}
                height={150}
                onPointerDown={handleDrawStart}
                onPointerMove={handleDrawMove}
                onPointerUp={handleDrawEnd}
                onPointerCancel={handleDrawEnd}
                className="w-full h-36 rounded-xl border border-slate-300 bg-white touch-none cursor-crosshair"
              />
            </div>
          )}

          {mode === "TYPE" && (
            <div className="space-y-3">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your signature name"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTypedFont("'Brush Script MT', cursive")}
                  className={`rounded-lg border p-2 text-base italic ${
                    typedFont.includes("Brush")
                      ? "border-[#0A192F] bg-[#0A192F]/5"
                      : "border-slate-200"
                  }`}
                  style={{ fontFamily: "'Brush Script MT', cursive" }}
                >
                  {typedName || "Script Style"}
                </button>
                <button
                  type="button"
                  onClick={() => setTypedFont("Georgia, serif")}
                  className={`rounded-lg border p-2 text-sm italic ${
                    typedFont.includes("Georgia")
                      ? "border-[#0A192F] bg-[#0A192F]/5"
                      : "border-slate-200"
                  }`}
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {typedName || "Editorial Serif"}
                </button>
              </div>
            </div>
          )}

          {mode === "UPLOAD" && (
            <div className="space-y-2">
              <label className="block rounded-xl border-2 border-dashed border-slate-300 p-5 text-center cursor-pointer hover:border-[#0A192F] transition">
                <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                <span className="text-xs font-semibold text-[#0A0F1A]">
                  Upload Signature PNG or JPG
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleUploadFile}
                  className="hidden"
                />
              </label>
              {signatureDataUrl && (
                <img
                  src={signatureDataUrl}
                  alt="Uploaded preview"
                  className="h-20 mx-auto object-contain border border-slate-200 rounded-lg p-1"
                />
              )}
            </div>
          )}

          {/* Signer Name, Title, Date */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                Full Legal Name *
              </label>
              <input
                required
                type="text"
                value={signerFullName}
                onChange={(e) => setSignerFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Title / Role
                </label>
                <input
                  type="text"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="e.g. Director"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Signing Date *
                </label>
                <input
                  required
                  type="date"
                  value={signedDateText}
                  onChange={(e) => setSignedDateText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Electronic Consent Checkbox */}
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0A192F]"
            />
            <span>
              <strong>I agree to sign electronically.</strong> I confirm that my placed signature represents my legally binding electronic execution of this agreement.
            </span>
          </label>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#0A192F] py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#1E3A8A] disabled:opacity-50 transition"
          >
            {submitting ? "Stamping PDF & Sending Copies..." : "Complete & Sign Agreement"}
          </button>
        </form>
      </div>
    </div>
  );
}

