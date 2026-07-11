"use client";

import { forwardRef, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "accent";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-sm active:opacity-90",
  accent: "bg-accent text-white shadow-sm active:opacity-90 dark:text-[#0c0f1a]",
  secondary: "bg-surface-2 text-foreground active:bg-border",
  ghost: "bg-transparent text-foreground active:bg-surface-2",
  destructive: "bg-destructive/10 text-destructive active:bg-destructive/20",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg" | "icon";
  }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  const sizes = {
    sm: "h-9 px-3 text-sm rounded-xl",
    md: "h-11 px-5 text-[15px] rounded-2xl",
    lg: "h-13 px-6 text-base rounded-2xl",
    icon: "h-11 w-11 rounded-2xl",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 font-bold transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        "active:scale-[0.97]",
        sizes[size],
        buttonStyles[variant],
        className
      )}
      {...props}
    />
  );
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_14px_rgb(0_0_0/0.05)]",
        className
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground",
          "placeholder:text-muted transition-[border-color,box-shadow] duration-150",
          "focus:border-ring focus:ring-4 focus:ring-primary/15 focus:outline-none",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-border bg-surface p-4 text-base text-foreground",
        "placeholder:text-muted transition-[border-color,box-shadow] duration-150",
        "focus:border-ring focus:ring-4 focus:ring-primary/15 focus:outline-none",
        className
      )}
      {...props}
    />
  );
});

// ---------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        checked ? "bg-primary" : "bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200",
          checked && "translate-x-6"
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="flex w-full rounded-2xl bg-surface-2 p-1" role="radiogroup">
      {options.map((opt) => (
        <button
          key={String(opt)}
          role="radio"
          aria-checked={opt === value}
          onClick={() => onChange(opt)}
          className={cn(
            "h-10 flex-1 cursor-pointer rounded-xl text-sm font-bold transition-all duration-150",
            "focus-visible:outline-2 focus-visible:outline-ring",
            opt === value
              ? "bg-surface text-primary shadow-sm"
              : "text-muted active:text-foreground"
          )}
        >
          {format(opt)}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom sheet
// ---------------------------------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="sticky top-0 z-10 bg-surface px-5 pt-3 pb-2">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-surface-2 text-muted active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="px-5 pt-2">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Collapsible card (accordion section)
// ---------------------------------------------------------------------------

export function Collapsible({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={cn("overflow-hidden", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between p-4"
      >
        <p className="text-xs font-extrabold tracking-wide text-muted uppercase">{title}</p>
        <ChevronDown
          size={18}
          className={cn("text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-soft text-primary">
        {icon}
      </div>
      <p className="text-base font-extrabold">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
