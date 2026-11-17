"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/types/domain";
import { cn } from "@/lib/utils";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * Form bound to a server action. Shows pending state and the action's
 * success/error message inline. Resets inputs after success when `resetOnSuccess`.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  confirm,
  inline,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={cn(inline ? "inline-flex flex-wrap items-center gap-2" : "flex flex-col gap-3", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && (
        <p role="status" className={cn("text-[12.5px] font-semibold", state.ok ? "text-good" : "text-bad")}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "teal" | "danger";
  size?: "sm";
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={cn("btn", `btn-${variant}`, size === "sm" && "btn-sm")}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
