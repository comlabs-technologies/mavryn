"use client";

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * FAQs are published as schema.org FAQPage, which is what makes a post
 * eligible for answer-engine surfaces — so this is a first-class editor
 * panel rather than a generic repeated field.
 */
export function FaqBuilder({
  value,
  onChange,
  readOnly,
}: {
  value: FaqEntry[];
  onChange: (next: FaqEntry[]) => void;
  readOnly?: boolean;
}) {
  const update = (index: number, patch: Partial<FaqEntry>) =>
    onChange(value.map((faq, i) => (i === index ? { ...faq, ...patch } : faq)));

  return (
    <div className="grid gap-3">
      {value.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">
          No questions yet. Two or three specific questions are usually enough.
        </p>
      )}

      {value.map((faq, index) => (
        <div key={index} className="rounded-lg border border-[var(--color-line)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-muted)]">
              Question {index + 1}
            </span>
            {!readOnly && (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            )}
          </div>

          <input
            className="field mb-2"
            readOnly={readOnly}
            placeholder="Why do agents get stuck in loops?"
            value={faq.question}
            onChange={(event) => update(index, { question: event.target.value })}
          />
          <textarea
            className="field"
            rows={3}
            readOnly={readOnly}
            placeholder="Answer it directly in one or two sentences."
            value={faq.answer}
            onChange={(event) => update(index, { answer: event.target.value })}
          />
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          className="btn-secondary w-fit"
          onClick={() => onChange([...value, { question: "", answer: "" }])}
        >
          Add question
        </button>
      )}
    </div>
  );
}
