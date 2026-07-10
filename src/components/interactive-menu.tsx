"use client";

import { useEffect, useRef, type CSSProperties, type ElementType } from "react";
import Link from "next/link";
import { cn } from "./ui";

export interface InteractiveMenuItem {
  href: string;
  label: string;
  icon: ElementType<{ size?: number; strokeWidth?: number }>;
}

/**
 * Animated bottom navigation: inactive tabs show a centered icon, the active
 * tab bounces its icon up and reveals the label with an underline sized to
 * the text (measured into the --lineWidth custom property). Adapted from the
 * "modern mobile menu" community component: route-driven instead of local
 * state, Link navigation, Vokabi theme tokens (styles live in globals.css).
 */
export function InteractiveMenu({
  items,
  activeIndex,
}: {
  items: readonly InteractiveMenuItem[];
  activeIndex: number;
}) {
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const setLineWidth = () => {
      const item = itemRefs.current[activeIndex];
      const text = textRefs.current[activeIndex];
      if (item && text) {
        item.style.setProperty("--lineWidth", `${text.offsetWidth}px`);
      }
    };
    setLineWidth();
    window.addEventListener("resize", setLineWidth);
    return () => window.removeEventListener("resize", setLineWidth);
  }, [activeIndex, items]);

  return (
    <nav className="menu" aria-label="Main navigation">
      {items.map((item, index) => {
        const active = index === activeIndex;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("menu__item", active && "active")}
            style={{ "--lineWidth": "0px" } as CSSProperties}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
          >
            <span className="menu__icon">
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            </span>
            <span className="menu__label">
              <strong
                className={cn("menu__text", active && "active")}
                ref={(el) => {
                  textRefs.current[index] = el;
                }}
              >
                {item.label}
              </strong>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
