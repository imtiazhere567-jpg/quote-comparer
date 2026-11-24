"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, Send, type LucideIcon } from "lucide-react";

export type ConfirmOptions = {
  title: ReactNode;
  body?: ReactNode;
  /** big number shown in the middle, e.g. the amount */
  amount?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "brand" | "success" | "danger";
  icon?: LucideIcon;
};

const TONE = {
  brand: { btn: "btn-primary", tile: "bg-hero text-hero-num", icon: Send },
  success: { btn: "btn-success", tile: "bg-success-soft text-success ring-1 ring-success-line", icon: CircleCheck },
  danger: { btn: "btn-danger", tile: "bg-danger-soft text-danger ring-1 ring-danger/30", icon: CircleAlert },
} as const;

/**
 * Branded replacement for window.confirm().
 *   const [confirm, dialog] = useConfirm();
 *   if (!(await confirm({ title: "Send quote?" }))) return;
 *   ...render {dialog}
 */
export function useConfirm(): [(o: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const done = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return [confirm, <ConfirmDialog key="confirm" opts={opts} onDone={done} />];
}

function ConfirmDialog({ opts, onDone }: { opts: ConfirmOptions | null; onDone: (v: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (opts && !d.open) d.showModal();
    if (!opts && d.open) d.close();
  }, [opts]);

  const tone = TONE[opts?.tone ?? "brand"];
  const Icon = opts?.icon ?? tone.icon;

  // showModal() puts the dialog in the top layer, so it can live anywhere in the tree
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onDone(false);
      }}
      onClick={(e) => e.target === ref.current && onDone(false)}
      className="m-auto w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-[18px] border border-border bg-surface p-0 text-foreground shadow-pop backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
    >
      {opts && (
        <div className="animate-step-in">
          <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
            <span className={`flex size-12 items-center justify-center rounded-[14px] ${tone.tile}`}>
              <Icon className="size-6" />
            </span>
            <h2 id="confirm-title" className="mt-4 text-lg leading-snug font-semibold">
              {opts.title}
            </h2>
            {opts.amount != null && <p className="num mt-2 text-[32px] leading-none font-bold tracking-tight">{opts.amount}</p>}
            {opts.body && <div className="mt-2.5 text-sm text-muted">{opts.body}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2.5 border-t border-border bg-surface-2 px-5 py-4">
            <button type="button" className="btn-secondary justify-center" onClick={() => onDone(false)}>
              {opts.cancelLabel ?? "Cancel"}
            </button>
            <button type="button" autoFocus className={`${tone.btn} justify-center`} onClick={() => onDone(true)}>
              {opts.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * A submit button for a server-action form that asks first, in the branded dialog.
 * Put it inside the <form>; on "yes" the form is submitted with this button's name/value.
 */
export function ConfirmSubmit({
  children,
  confirm: o,
  className = "btn-primary",
  name,
  value,
}: {
  children: ReactNode;
  confirm: ConfirmOptions;
  className?: string;
  name?: string;
  value?: string;
}) {
  const [confirm, dialog] = useConfirm();
  const btn = useRef<HTMLButtonElement>(null);
  const { pending: busy } = useFormStatus();
  return (
    <>
      <button
        ref={btn}
        type="submit"
        name={name}
        value={value}
        disabled={busy}
        className={className}
        onClick={async (e) => {
          if (btn.current?.dataset.ok === "1") {
            btn.current.dataset.ok = "";
            return; // confirmed: let the form submit
          }
          e.preventDefault();
          const form = btn.current?.form;
          if (form && !form.reportValidity()) return;
          if (await confirm(o)) {
            btn.current!.dataset.ok = "1";
            btn.current!.click();
          }
        }}
      >
        {children}
      </button>
      {dialog}
    </>
  );
}
