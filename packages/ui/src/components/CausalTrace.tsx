/** "Why did this change" — DESIGN §7. Every value can open the tick-log entries
 *  that produced it, with the constant id and its confidence.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store";
import { t } from "../lib/strings";
import { fmtSigned } from "../lib/format";

export function Traceable(props: { path: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`cursor-pointer border-b border-dashed border-transparent hover:border-line1 ${props.className ?? ""}`}
        onClick={() => {
          const r = anchor.current?.getBoundingClientRect();
          if (r) setPos({ x: Math.min(r.left, window.innerWidth - 380), y: r.bottom + 6 });
          setOpen((o) => !o);
        }}
      >
        {props.children}
      </button>
      {open && pos !== null && <TracePopover path={props.path} pos={pos} onClose={() => setOpen(false)} />}
    </>
  );
}

function TracePopover(props: { path: string; pos: { x: number; y: number }; onClose: () => void }) {
  const log = useStore((s) => s.log);
  const meta = useStore((s) => s.meta);
  const lang = useStore((s) => s.lang);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [props]);

  const entries = log.filter((e) => e.target === props.path || e.target.startsWith(`${props.path}.`));
  const placeholders = new Set(meta?.placeholder_ids ?? []);

  return createPortal(
    <div
      ref={ref}
      className="overlay fixed z-50 max-h-80 w-[370px] overflow-y-auto rounded-[6px] border border-line1 bg-bg2 p-2"
      style={{ left: props.pos.x, top: Math.min(props.pos.y, window.innerHeight - 320) }}
      dir={lang === "he" ? "rtl" : "ltr"}
    >
      <div className="mb-1 flex items-baseline justify-between border-b border-line0 pb-1">
        <span className="text-[13px] font-medium">{t("causalTrace", lang)}</span>
        <span className="num text-[11px] text-fg2">{props.path}</span>
      </div>
      {entries.length === 0 ? (
        <div className="py-2 text-[12px] text-fg2">— {lang === "he" ? "ללא שינוי ברבעון האחרון" : "no change last quarter"}</div>
      ) : (
        <table className="w-full text-[12px] leading-[16px]">
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-line0/50 last:border-0">
                <td className="num py-1 pe-2 text-fg2">{e.step}</td>
                <td className="py-1 pe-2 text-fg1">{e.fn}</td>
                <td className={`num py-1 pe-2 ${e.delta >= 0 ? "text-good-bright" : "text-bad-bright"}`}>{fmtSigned(e.delta, 2)}</td>
                <td className="num py-1 text-[11px] text-fg2">
                  {e.constant_id !== null && (
                    <span className={placeholders.has(e.constant_id) ? "assumption" : ""} title={placeholders.has(e.constant_id) ? t("assumption", lang) : undefined}>
                      {e.constant_id}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>,
    document.body,
  );
}
