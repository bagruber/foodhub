/**
 * Datenmodell foodhub.
 *
 * Eine Regel zieht sich durch alles: jede Angabe, die veralten kann, traegt
 * ihre Herkunft mit. Preise aendern sich, Restaurants schliessen, Bewertungen
 * wandern. Wer die Daten liest, muss sehen koennen, woher sie stammen und wie
 * alt sie sind, ohne im Repo nachsehen zu muessen.
 */

/** ISO-Datum, `YYYY-MM-DD`. */
export type IsoDate = string;

// ---------------------------------------------------------------------------
// Herkunft
// ---------------------------------------------------------------------------

export type SourceKind =
  | "pdf"          // Speisekarte als PDF, meist von der Restaurant-Website
  | "website"      // direkt aus dem HTML einer Seite gelesen
  | "osm"          // OpenStreetMap, ueber Overpass
  | "google_maps"
  | "tripadvisor"
  | "restaurantguru"
  | "manual";      // vor Ort erfasst, telefonisch, aus einem Aushang

export type Provenance = {
  kind: SourceKind;
  /** Wo es herkam. Bei einem PDF die Seite, die es zum Download anbot. */
  url?: string;
  /** Repo-relativer Pfad zur hinterlegten Datei, falls wir sie aufbewahren. */
  file?: string;
  /** Wann wir es geholt haben. Pflicht, ohne Ausnahme. */
  retrievedAt: IsoDate;
  /**
   * Erstelldatum aus den Metadaten des Dokuments. Sagt, wie alt die Karte
   * selbst ist, unabhaengig davon, wann wir sie gefunden haben. Eine Karte von
   * 2022, heute abgerufen, ist etwas anderes als eine von letzter Woche.
   */
  createdAt?: IsoDate;
  note?: string;
};

// ---------------------------------------------------------------------------
// Restaurant
// ---------------------------------------------------------------------------

export type Address = {
  street: string;
  postalCode: string;
  city: string;
};

export type Coordinates = {
  lat: number;
  lon: number;
  provenance: Provenance;
};

export type OpeningHours = {
  /** Wortlaut der Quelle, unveraendert. Bleibt lesbar, auch wenn osm fehlt. */
  raw: string;
  /** Normalisiert im OSM-Format, z. B. `Mo-Fr 11:00-14:30,17:00-22:30`. */
  osm?: string;
  provenance: Provenance;
};

/**
 * Was ein Bewertungsportal ueber ein Haus fuehrt.
 *
 * Link und Bewertung stehen bewusst in einem Objekt und nicht getrennt. Eine
 * Zahl ohne den Weg zu ihrer Quelle ist wertlos: wer 3,5 von 5 liest, will
 * sehen, worauf sich das stuetzt, und mehrere Anbieter verlangen die
 * Verlinkung ohnehin als Bedingung. `rating` fehlt, solange nur der Link
 * bekannt ist.
 *
 * Diese Bewertungen sind fremde Meinungen. Weder das Repo noch die App macht
 * sie sich zu eigen; die Oberflaeche sagt das an der Stelle, an der sie
 * stehen.
 */
export type Review = {
  source: Extract<SourceKind, "google_maps" | "tripadvisor" | "restaurantguru">;
  url: string;
  rating?: {
    value: number;
    /** Obergrenze der Skala, praktisch immer 5. */
    scale: number;
    count?: number;
  };
  provenance: Provenance;
};

/**
 * Zahlungsarten, Slugs aus `data/vocab/zahlung.json`.
 *
 * Dreiwertig, und das ist der Punkt: `true` heisst angenommen, `false` heisst
 * ausdruecklich nicht, und ein fehlender Schluessel heisst unbekannt. Wer die
 * drei zusammenwirft, schickt jemanden ohne Bargeld in ein Wirtshaus, das nur
 * Bargeld nimmt.
 *
 * Die Herkunft haengt an der einzelnen Angabe, nicht am Haus: die Kartenfelder
 * kommen aus OpenStreetMap, die MoosburgCard von der Liste der
 * Akzeptanzstellen. Beides veraltet unabhaengig voneinander.
 */
export type PaymentClaim = {
  accepted: boolean;
  provenance: Provenance;
};

export type Payment = Record<string, PaymentClaim>;

/**
 * Umriss des Gebaeudes, in dem das Haus liegt.
 *
 * Ergaenzt den Punkt, ersetzt ihn nicht. Die Flaeche ist das Gebaeude und
 * nicht das Lokal: ein Wirtshaus im Erdgeschoss eines Wohnblocks bekommt den
 * ganzen Block. Deshalb zeigt die Karte sie erst, wenn man nah genug ist, um
 * das einordnen zu koennen, und faellt darunter auf den Punkt zurueck.
 */
export type Outline = {
  /** Ringe als `[lon, lat]`, aeusserer Ring zuerst. */
  rings: [number, number][][];
  /** OSM-Wert von `building`, etwa `retail` oder `apartments`. */
  building?: string;
  provenance: Provenance;
};

/** Was ein Haus anbietet, soweit belegt. Fehlt ein Feld, ist es unbekannt. */
export type Services = {
  delivery?: boolean;
  takeaway?: boolean;
  outdoorSeating?: boolean;
  wheelchair?: "yes" | "limited" | "no";
};

/**
 * Ernaehrungsangebot auf Haus-Ebene, aus den OSM-Tags `diet:*`.
 * `only` heisst ausschliesslich, `yes` heisst es gibt etwas, `no` heisst nichts.
 * Das ist etwas anderes als das `diet` am einzelnen Gericht.
 */
export type HouseDiet = Partial<Record<DietFlag, "only" | "yes" | "no">>;

/** Wo man bestellen oder liefern lassen kann. */
export type Ordering = {
  url: string;
  /** Name des Dienstes, etwa `Lieferando`, oder `eigene Seite`. */
  provider: string;
  provenance: Provenance;
};

export type Restaurant = {
  /** Slug, innerhalb einer Stadt eindeutig. Zugleich der Dateiname. */
  id: string;
  name: string;
  /** Stadt-Slug, entspricht dem Ordner unter `data/`. */
  city: string;
  address: Address;
  location?: Coordinates;
  outline?: Outline;
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  /**
   * Art des Hauses, Slugs aus `data/vocab/kinds.json`. Getrennt von der
   * Kueche, weil beides unabhaengig voneinander gilt: der Staudinger Keller
   * ist Wirtshaus und Biergarten, und ein Cafe kann bayerisch kochen.
   */
  kinds: string[];
  /** Slugs aus `data/vocab/cuisines.json`. Ein Haus kann mehrere fuehren. */
  cuisines: string[];
  services?: Services;
  diet?: HouseDiet;
  payment?: Payment;
  ordering?: Ordering[];
  openingHours?: OpeningHours;
  /** Leer, solange kein Bewertungsportal angebunden ist. */
  reviews: Review[];
  /** Dateinamen der Kartenversionen unter `menus/`, neueste zuerst. */
  menus: string[];
  /** Herkunft der Stammdaten. Einzelne Felder duerfen davon abweichen. */
  provenance: Provenance;
  /** Was offen ist. Erscheint nicht in der App, haelt aber die Luecken fest. */
  open?: string[];
};

// ---------------------------------------------------------------------------
// Speisekarte
// ---------------------------------------------------------------------------

/** Die 14 kennzeichnungspflichtigen Allergene der LMIV. */
export type Allergen =
  | "gluten" | "crustaceans" | "eggs" | "fish" | "peanuts" | "soybeans"
  | "milk" | "nuts" | "celery" | "mustard" | "sesame" | "sulphites"
  | "lupin" | "molluscs";

/** Kennzeichnungspflichtige Zusatzstoffe nach ZZulV. */
export type Additive =
  | "colorant" | "preservative" | "antioxidant" | "flavour_enhancer"
  | "sulphured" | "blackened" | "waxed" | "phosphate" | "sweetener"
  | "phenylalanine" | "caffeine" | "quinine" | "taurine" | "nitrite_salt"
  | "milk_protein" | "acidifier" | "surimi";

export type DietFlag =
  | "vegetarian" | "vegan" | "halal" | "kosher"
  | "gluten_free" | "lactose_free";

/**
 * Woher eine Eigenschaft stammt. Der Unterschied ist nicht kosmetisch: bei
 * Allergien und Ernaehrungsformen haftet eine geratene Angabe anders als eine
 * gedruckte. `declared` steht so auf der Karte, `inferred` haben wir aus der
 * Beschreibung geschlossen. Die App muss beides auseinanderhalten koennen.
 */
export type Basis = "declared" | "inferred";

export type Price = {
  amount: number;
  currency: "EUR";
  /** Was man dafuer bekommt, wenn es mehrere Groessen gibt: `0,5l`, `2cl`. */
  portion?: string;
  /** Etwa `kleine Portion`, wenn die Karte einen Abschlag ausweist. */
  note?: string;
};

export type MenuItem = {
  /** Nummer auf der Karte, wo es eine gibt. Der stabilste Anker beim Neueinlesen. */
  ref?: string;
  name: string;
  description?: string;
  prices: Price[];
  /**
   * Die Marker, wie sie auf der Karte stehen: `["2", "a", "g"]`. Unveraendert,
   * damit die Zuordnung gegen die gedruckte Karte pruefbar bleibt.
   */
  markersRaw: string[];
  allergens: Allergen[];
  additives: Additive[];
  /** Fehlt ein Schluessel, ist es unbekannt, nicht verneint. */
  diet: Partial<Record<DietFlag, Basis>>;
  spice?: { level: 0 | 1 | 2 | 3; basis: Basis };
  image?: { file: string; provenance: Provenance };
};

export type MenuSection = {
  /** Ueberschrift im Wortlaut der Karte, etwa `Grill-Spezialitaeten`. */
  title: string;
  /** Satz unter der Ueberschrift, der fuer alle Gerichte darunter gilt. */
  note?: string;
  items: MenuItem[];
};

/**
 * Eine Kartenversion. Jede neue Karte eines Hauses wird eine eigene Datei, die
 * alte bleibt liegen. So laesst sich spaeter zeigen, wie sich Preise bewegen.
 */
export type Menu = {
  restaurantId: string;
  provenance: Provenance;
  /**
   * Die Zeichenerklaerung der Karte. Jedes Haus zaehlt anders: Drei Tannen
   * `A` fuer Gluten, das indische Haus `1` dafuer und `A` fuer
   * Konservierungsstoff. Ohne diese Tabelle sind `markersRaw` wertlos.
   */
  legend: {
    allergens: Record<string, Allergen>;
    additives: Record<string, Additive>;
  };
  sections: MenuSection[];
};

// ---------------------------------------------------------------------------
// Stadt
// ---------------------------------------------------------------------------

export type City = {
  id: string;
  name: string;
  /** Kartenmittelpunkt beim Start. */
  center: { lat: number; lon: number };
  /** `[west, sued, ost, nord]`, begrenzt auch die Overpass-Abfrage. */
  bbox: [number, number, number, number];
};
