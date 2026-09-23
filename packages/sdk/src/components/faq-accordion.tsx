"use client";

import { useId, useState } from "react";
import { useContent } from "../use-content";
import type { CmsContent } from "../types";

export interface FaqAccordionProps {
  slug?: string;
  type?: string;
  /** Pre-fetched item, or pass `faqs` directly. */
  content?: CmsContent;
  faqs?: { question: string; answer: string }[];
  heading?: string;
  className?: string;
  /** Open the first question on mount. */
  defaultOpen?: number | null;
}

/**
 * Accessible FAQ accordion.
 *
 * Panels animate with a CSS grid row transition rather than max-height, so an
 * answer of any length opens smoothly. Collapsed answers stay in the DOM — the
 * same text is also published as schema.org FAQPage — while `hidden` keeps them
 * out of the tab order and the accessibility tree until expanded.
 */
export function FaqAccordion({
  slug,
  type = "blog",
  content,
  faqs,
  heading = "Frequently asked questions",
  className,
  defaultOpen = null,
}: FaqAccordionProps) {
  const state = useContent(content || faqs ? "" : (slug ?? ""), type);
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const baseId = useId();

  const entries = faqs ?? content?.faqs ?? state.data?.faqs ?? [];
  if (entries.length === 0) return null;

  return (
    <section className={`cms-faq ${className ?? ""}`.trim()}>
      {heading && <h2 className="cms-faq__heading">{heading}</h2>}

      <ul className="cms-faq__list">
        {entries.map((faq, index) => {
          const expanded = open === index;
          const panelId = `${baseId}-panel-${index}`;
          const buttonId = `${baseId}-button-${index}`;

          return (
            <li key={faq.question} className="cms-faq__item" data-expanded={expanded}>
              <h3 className="cms-faq__question">
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="cms-faq__trigger"
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  <span>{faq.question}</span>
                  <span className="cms-faq__icon" aria-hidden>
                    {expanded ? "−" : "+"}
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="cms-faq__panel"
                hidden={!expanded}
              >
                <div className="cms-faq__answer">{faq.answer}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
