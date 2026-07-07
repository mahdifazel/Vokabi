"use client";

import { motion, useReducedMotion } from "framer-motion";
import { VokabiLogo } from "./logo";

/** Signature easing — fast attack, long elegant settle (Apple-style) */
const EASE = [0.16, 1, 0.3, 1] as const;

/** Deterministic particle field (no Math.random → SSR-safe, no hydration drift) */
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${((i * 61) % 93) + 3}%`,
  top: `${((i * 37) % 82) + 8}%`,
  size: 3 + (i % 3) * 2,
  delay: (i % 8) * 0.45,
  duration: 6 + (i % 5) * 1.4,
  drift: i % 2 === 0 ? 14 : -18,
}));

export function Splash() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      key="vokabi-splash"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "var(--background)" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.65, ease: "easeInOut" }}
      aria-label="Vokabi is starting"
      role="status"
    >
      {/* soft ambient gradient wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 20%, var(--primary-soft) 0%, transparent 55%)",
          opacity: 0.9,
        }}
      />

      {/* drifting aurora blobs — transform-only, GPU-friendly */}
      {!reduce && (
        <>
          <motion.div
            className="pointer-events-none absolute -top-28 -left-28 h-[26rem] w-[26rem] rounded-full blur-3xl"
            style={{ background: "rgba(109, 94, 248, 0.20)" }}
            animate={{ x: [0, 36, 0], y: [0, 22, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="pointer-events-none absolute -right-24 -bottom-24 h-[22rem] w-[22rem] rounded-full blur-3xl"
            style={{ background: "rgba(52, 211, 153, 0.13)" }}
            animate={{ x: [0, -30, 0], y: [0, -18, 0], scale: [1.08, 1, 1.08] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* floating particles */}
      {!reduce &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: "var(--primary)",
              filter: "blur(1px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.45, 0], y: [0, -34], x: [0, p.drift] }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* glow behind the logo */}
      <motion.div
        className="pointer-events-none absolute h-64 w-64 rounded-full"
        style={{ background: "var(--primary)", filter: "blur(80px)" }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.32, 0.22], scale: 1 }}
        transition={{ duration: 1.8, delay: 0.25, ease: EASE }}
      />

      {/* logo reveal: scale + fade + de-blur, then a glass shine sweep */}
      <motion.div
        className="relative"
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.8, y: 14, filter: "blur(10px)" }
        }
        animate={
          reduce
            ? { opacity: 1 }
            : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{ duration: 1.1, delay: 0.35, ease: EASE }}
      >
        <div className="overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgb(67_52_212/0.35)]">
          <VokabiLogo size={104} />
          {!reduce && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.38) 50%, transparent 62%)",
              }}
              initial={{ x: "-130%" }}
              animate={{ x: "130%" }}
              transition={{ duration: 1.0, delay: 1.35, ease: "easeInOut" }}
            />
          )}
        </div>
      </motion.div>

      {/* wordmark + tagline settle in */}
      <motion.h1
        className="mt-6 text-3xl font-black tracking-tight"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, delay: 0.85, ease: EASE }}
      >
        Vokabi
      </motion.h1>
      <motion.p
        className="mt-1 text-sm font-semibold text-muted"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.15, ease: EASE }}
      >
        German, word by word.
      </motion.p>
    </motion.div>
  );
}
