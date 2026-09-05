import type { Dish } from "@/lib/data";

/**
 * Die Merkmale eines Gerichts als Zeichen statt als Wortkette.
 *
 * In einer Liste aus 445 Zeilen liest niemand "vegetarisch" dreihundertmal.
 * Ein Zeichen mit fester Farbe wird nach der dritten Zeile nicht mehr gelesen,
 * sondern erkannt.
 *
 * Der Unterschied zwischen gedruckt und geschlossen bleibt sichtbar: was auf
 * der Karte steht, ist gefüllt, was wir aus der Beschreibung geschlossen
 * haben, ist nur umrandet und trägt ein Fragezeichen. Bei Ernährungsformen
 * haftet eine geratene Angabe anders als eine gedruckte, und wer sich darauf
 * verlässt, muss sehen können, worauf.
 */

function Leaf() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
      <path
        d="M13 3c0 5.5-3 8.5-7.5 8.5C4 11.5 3 10.5 3 9c0-4 4-6 10-6Z"
        fill="currentColor"
      />
      <path d="M11 5C8 6.5 6 8.5 4.5 13" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function Chilli() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
      <path
        d="M11 4c1.8 0 3 1.6 3 3.6C14 11 11 14 7.5 14 5 14 3 12.6 3 10.6 3 8 6 6 9 6c0-1 .6-2 2-2Z"
        fill="currentColor"
      />
      <path d="M11 4c0-1.2.8-2 2-2" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

const SPICE_LABEL = ["", "leicht scharf", "scharf", "sehr scharf"];

function Mark({
  tone,
  declared,
  title,
  children,
}: {
  tone: "vegan" | "vegetarian" | "spicy";
  declared: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const colour = {
    vegan: "text-diet-vegan",
    vegetarian: "text-diet-vegetarian",
    spicy: "text-spice",
  }[tone];
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[0.65rem] font-medium ${colour} ${
        declared ? "bg-current/12" : "border border-current/40 border-dashed"
      }`}
    >
      {children}
      {!declared && <span aria-hidden="true">?</span>}
      <span className="sr-only">{title}</span>
    </span>
  );
}

export function Marks({ dish }: { dish: Dish }) {
  const marks = [];

  if (dish.diet.vegan) {
    const declared = dish.diet.vegan === "declared";
    marks.push(
      <Mark
        key="vegan"
        tone="vegan"
        declared={declared}
        title={declared ? "vegan, laut Karte" : "vermutlich vegan, aus der Beschreibung geschlossen"}
      >
        <Leaf />
        vegan
      </Mark>,
    );
  } else if (dish.diet.vegetarian) {
    const declared = dish.diet.vegetarian === "declared";
    marks.push(
      <Mark
        key="veg"
        tone="vegetarian"
        declared={declared}
        title={
          declared
            ? "vegetarisch, laut Karte"
            : "vermutlich vegetarisch, aus der Beschreibung geschlossen"
        }
      >
        <Leaf />
        veg
      </Mark>,
    );
  }

  if (dish.spice) {
    const declared = dish.spice.basis === "declared";
    marks.push(
      <Mark
        key="spice"
        tone="spicy"
        declared={declared}
        title={`${SPICE_LABEL[dish.spice.level] || "scharf"}${declared ? ", laut Karte" : ", geschlossen"}`}
      >
        {Array.from({ length: Math.max(1, dish.spice.level) }, (_, i) => (
          <Chilli key={i} />
        ))}
      </Mark>,
    );
  }

  return marks.length ? <span className="inline-flex flex-wrap gap-1">{marks}</span> : null;
}
