"use client";

import { useState } from "react";
import { ArrowLeft, CircleCheck, MessageSquareText, ThumbsDown } from "lucide-react";
import { respondToQuote } from "@/lib/actions/jobs";
import { ConfirmSubmit } from "@/components/confirm-dialog";

type Mode = "choose" | "changes" | "reject";

const CHANGE_CHIPS = ["Lower the price", "Change the start date", "Remove some work", "Add some work", "Different finishes"];
const REJECT_CHIPS = ["Too expensive", "Over my budget", "Found another builder", "Project on hold", "Timing doesn't work"];

/** Homeowner's answer to a quote: accept, or say what to change / why it's rejected. */
export function QuoteResponse({ quoteId, total, company }: { quoteId: string; total: string; company: string }) {
  const [mode, setMode] = useState<Mode>("choose");
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  const toggle = (c: string) => setChips((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const response = [chips.join(", "), text.trim()].filter(Boolean).join(". ");
  const reset = () => {
    setMode("choose");
    setChips([]);
    setText("");
  };

  if (mode === "choose")
    return (
      <form action={respondToQuote} className="space-y-2.5 p-4">
        <input type="hidden" name="quote_id" value={quoteId} />
        <ConfirmSubmit
          name="status"
          value="accepted"
          className="btn-success h-12 w-full justify-center rounded-2xl text-[15px]"
          confirm={{
            title: "Accept this quote?",
            amount: total,
            body: `${company} will book the work and you can follow progress here.`,
            confirmLabel: "Accept quote",
            tone: "success",
          }}
        >
          <CircleCheck /> Accept quote
        </ConfirmSubmit>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("changes")} className="btn-secondary h-11 justify-center rounded-2xl">
            <MessageSquareText /> Ask for changes
          </button>
          <button type="button" onClick={() => setMode("reject")} className="btn-secondary h-11 justify-center rounded-2xl text-danger">
            <ThumbsDown /> Reject
          </button>
        </div>
      </form>
    );

  const changes = mode === "changes";
  const list = changes ? CHANGE_CHIPS : REJECT_CHIPS;
  return (
    <form action={respondToQuote} className="animate-step-in space-y-3 p-4">
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="response" value={response} />
      <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <ArrowLeft className="size-4" /> Back
      </button>
      <div>
        <p className="text-[17px] font-semibold">{changes ? "What would you like changed?" : "Why are you rejecting it?"}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          {changes
            ? `${company} will update the quote and send you a new version.`
            : `Your feedback helps ${company}. You can still talk to them afterwards.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => {
          const on = chips.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                on ? "border-select bg-select-bg text-foreground shadow-[0_0_0_3px_var(--select-ring)]" : "border-border-strong bg-surface text-muted"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        required={chips.length === 0}
        placeholder={changes ? "e.g. Can we use laminate instead of hardwood upstairs, and start in March?" : "e.g. The price is more than we planned to spend."}
        className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[15px] outline-none focus:border-select"
      />
      <ConfirmSubmit
        name="status"
        value={changes ? "changes_requested" : "rejected"}
        className={`${changes ? "btn-primary" : "btn-danger"} h-12 w-full justify-center rounded-2xl text-[15px]`}
        confirm={
          changes
            ? { title: "Send your changes?", body: response || undefined, confirmLabel: "Send", icon: MessageSquareText }
            : { title: "Reject this quote?", body: response || undefined, confirmLabel: "Reject quote", tone: "danger", icon: ThumbsDown }
        }
      >
        {changes ? `Send changes to ${company}` : "Reject quote"}
      </ConfirmSubmit>
    </form>
  );
}
