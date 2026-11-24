"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

const VARIANT = {
  primary: "btn-primary",
  ghost: "btn-secondary",
  danger: "btn-danger",
  success: "btn-success",
  quiet: "btn-quiet",
} as const;

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  name,
  value,
  formAction,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof VARIANT;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending, data } = useFormStatus();
  // When a form has several submit buttons, only spin the one that was pressed.
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      disabled={pending}
      className={`${VARIANT[variant]} ${className}`}
    >
      {mine ? (
        <>
          <LoaderCircle className="animate-spin" />
          {pendingText ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
