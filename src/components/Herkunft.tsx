import { SOURCE_LABEL, age, formatDate, type Provenance } from "@/lib/data";

/**
 * Woher eine Angabe stammt und wie alt sie ist.
 *
 * Diese Zeile ist der eigentliche Zweck der Anwendung. Eine Speisekarte sagt
 * von sich aus nicht, ob sie noch gilt, und ein Preis ohne Datum behauptet,
 * er sei aktuell. Deshalb steht hier beides: wann wir es geholt haben und,
 * wenn das Dokument es hergibt, von wann die Karte selbst ist. Die Karte von
 * Asia Rose stammt von 2022 und ist heute abgerufen worden.
 */
export function Herkunft({
  provenance,
  className = "",
  kurz = false,
}: {
  provenance: Provenance;
  className?: string;
  /**
   * Eine Zeile statt eines Blocks. Fuer Nebenangaben wie Zahlungsart und
   * Bewertung: dort stehen drei, vier Herkuenfte untereinander, und in voller
   * Laenge erschlagen sie das, worauf sie sich beziehen.
   */
  kurz?: boolean;
}) {
  // Das Alter zählt ab dem Erstelldatum, wo es eines gibt. Wann wir eine vier
  // Jahre alte Karte gefunden haben, sagt über ihre Gültigkeit nichts.
  const relevant = provenance.createdAt ?? provenance.retrievedAt;
  const { label, stale } = age(relevant);

  if (kurz) {
    return (
      <p className={`text-xs text-ink-muted ${className}`}>
        {provenance.url ? (
          <a
            href={provenance.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink-line underline-offset-2 hover:decoration-ink"
          >
            {SOURCE_LABEL[provenance.kind]}
          </a>
        ) : (
          SOURCE_LABEL[provenance.kind]
        )}
        <span className="tabular"> · abgerufen am {formatDate(provenance.retrievedAt)}</span>
        {stale && <span className="text-red-700"> · {label}</span>}
      </p>
    );
  }

  return (
    <div className={`text-xs leading-relaxed text-ink-soft ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="eyebrow">Quelle</span>
        {provenance.url ? (
          <a
            href={provenance.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink-line underline-offset-2 hover:decoration-ink"
          >
            {SOURCE_LABEL[provenance.kind]}
          </a>
        ) : (
          <span>{SOURCE_LABEL[provenance.kind]}</span>
        )}
        <span
          className={`tabular rounded px-1.5 py-0.5 ${
            stale ? "bg-red-100 text-red-700" : "bg-cream-dark text-ink-muted"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="tabular mt-1 text-ink-muted">
        {provenance.createdAt && <>Karte vom {formatDate(provenance.createdAt)}, </>}
        abgerufen am {formatDate(provenance.retrievedAt)}
      </div>
      {provenance.note && <div className="mt-1 text-ink-muted">{provenance.note}</div>}
    </div>
  );
}
