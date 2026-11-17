"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Link2,
  Code,
  Image as ImageIcon,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  minHeight = "220px",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [sourceMode, setSourceMode] = useState(false);

  useEffect(() => {
    if (!sourceMode && editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value, sourceMode]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleLink = () => {
    const url = window.prompt("Enter URL (e.g. https://... or /services):", "https://");
    if (url) exec("createLink", url);
  };

  const handleImage = () => {
    const url = window.prompt("Enter uploaded image URL (e.g. /uploads/...):", "/uploads/");
    if (url) exec("insertImage", url);
  };

  return (
    <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2.5 py-2">
        <button
          type="button"
          onClick={() => exec("formatBlock", "<h2>")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "<h3>")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("bold")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Underline"
        >
          <Underline className="h-4 w-4" />
        </button>
        <span className="h-4 w-px bg-slate-300 mx-1" />
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "<blockquote>")}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleLink}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Insert Link"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleImage}
          className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
          title="Insert Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setSourceMode(!sourceMode)}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold ${
              sourceMode ? "bg-[#0A192F] text-white" : "bg-white border border-slate-300 text-slate-700"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            {sourceMode ? "Visual" : "HTML"}
          </button>
        </div>
      </div>

      {sourceMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight }}
          className="w-full p-3 font-mono text-xs text-slate-800 focus:outline-none"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
          style={{ minHeight }}
          className="vc-prose p-4 text-sm focus:outline-none max-h-[420px] overflow-y-auto"
        />
      )}
    </div>
  );
}

