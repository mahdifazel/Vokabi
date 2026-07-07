"use client";

import { useId } from "react";

/**
 * The Vokabi mark: a speech bubble whose tail sits on the axis of the
 * negative-space V — the bubble "speaks" the letter.
 */
export function VokabiLogo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId(); // unique gradient id so multiple instances don't collide
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Vokabi"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d5ef8" />
          <stop offset="1" stopColor="#4334d4" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="115" fill={`url(#${id})`} />
      <path
        d="M256 88 C366 88 416 138 416 232 C416 318 374 364 292 372 L262 442 Q256 454 250 442 L220 372 C138 364 96 318 96 232 C96 138 146 88 256 88 Z"
        fill="#ffffff"
      />
      <path
        d="M196 176 L256 300 L316 176"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="48"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
