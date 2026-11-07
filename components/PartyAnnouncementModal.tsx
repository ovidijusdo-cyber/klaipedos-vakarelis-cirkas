"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PARTY_ANNOUNCEMENTS } from "../lib/party-announcement";
import { PARTY_LANGUAGE_OPTIONS, type PartyLanguage } from "../lib/party-i18n";

export function PartyAnnouncementModal({
  open,
  language,
  onLanguageChange,
  onClose,
}: {
  open: boolean;
  language: PartyLanguage;
  onLanguageChange: (language: PartyLanguage) => void;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const announcement = PARTY_ANNOUNCEMENTS[language];

  return createPortal((
    <div className="party-announcement-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        aria-describedby="party-announcement-intro"
        aria-labelledby="party-announcement-title"
        aria-modal="true"
        className="party-announcement-dialog"
        lang={language}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key !== "Tab") return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        role="dialog"
      >
        <div className="party-announcement-header">
          <div className="party-announcement-heading">
            <span className="party-announcement-eyebrow" aria-hidden="true">🌍 07 NOV · 16:30</span>
            <h2 id="party-announcement-title">{announcement.title}</h2>
            <p id="party-announcement-intro">{announcement.eventName}</p>
          </div>
          <button
            aria-label={announcement.closeLabel}
            className="party-announcement-close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="party-announcement-scroll">
          <div aria-label={announcement.languageLabel} className="party-announcement-languages" role="group">
            <span>{announcement.languageLabel}</span>
            {PARTY_LANGUAGE_OPTIONS.map((option) => (
              <button
                aria-pressed={language === option.id}
                className={language === option.id ? "active" : ""}
                key={option.id}
                onClick={() => onLanguageChange(option.id)}
                type="button"
              >
                <b>{option.short}</b> {option.label}
              </button>
            ))}
          </div>

          <div className="party-announcement-facts">
            {announcement.facts.map((fact) => (
              <div className="party-announcement-fact" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>

          <div className="party-announcement-intro-copy">
            {announcement.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>

          <section aria-labelledby="party-announcement-recommendations" className="party-announcement-recommendations">
            <h3 id="party-announcement-recommendations">{announcement.recommendationsTitle}</h3>
            <div className="party-announcement-recommendation-grid">
              {announcement.recommendations.map((recommendation, index) => (
                <article className="party-announcement-recommendation" key={recommendation.title}>
                  <div className="party-announcement-recommendation-heading">
                    <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <h4>{recommendation.title}</h4>
                  </div>
                  {recommendation.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </article>
              ))}
            </div>
          </section>

          <section className="party-announcement-closing">
            <h3>❤️ {announcement.closingTitle}</h3>
            {announcement.closing.slice(0, 2).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <strong>{announcement.scripture}</strong>
            <p>{announcement.closing[2]}</p>
          </section>
        </div>

        <div className="party-announcement-footer">
          <button className="party-announcement-continue" onClick={onClose} type="button">
            {announcement.continueLabel}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
