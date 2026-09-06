/**
 * Die Zeichen der Oberfläche, als Pfade statt als Schriftart.
 *
 * Ein Icon-Paket wäre bequemer, brächte aber ein weiteres Abhängigkeitspaar
 * und für sechzehn Zeichen ein Vielfaches an Gewicht. Alle sind auf demselben
 * Raster von 16 gezeichnet, mit derselben Strichstärke, und nehmen ihre Farbe
 * vom Text darüber.
 *
 * Blatt und Chili sind gefüllt statt gestrichen: sie stehen in der Liste
 * hinter jedem Gericht und müssen auf drei Millimetern noch erkennbar sein.
 */

type Props = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Svg({ className = "h-4 w-4", children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function Leaf({ className = "h-3 w-3" }: Props) {
  return (
    <Svg className={className}>
      <path d="M13 3c0 5.5-3 8.5-7.5 8.5C4 11.5 3 10.5 3 9c0-4 4-6 10-6Z" fill="currentColor" />
      <path d="M11 5C8 6.5 6 8.5 4.5 13" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </Svg>
  );
}

export function Chilli({ className = "h-3 w-3" }: Props) {
  return (
    <Svg className={className}>
      <path
        d="M11 4c1.8 0 3 1.6 3 3.6C14 11 11 14 7.5 14 5 14 3 12.6 3 10.6 3 8 6 6 9 6c0-1 .6-2 2-2Z"
        fill="currentColor"
      />
      <path d="M11 4c0-1.2.8-2 2-2" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </Svg>
  );
}

export function House({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M2.5 7 8 2.5 13.5 7v6.5h-11Z" {...STROKE} />
      <path d="M6.5 13.5v-4h3v4" {...STROKE} />
    </Svg>
  );
}

export function Cutlery({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M4 2v4.5a1.5 1.5 0 0 0 3 0V2M5.5 6.5V14" {...STROKE} />
      <path d="M11.5 14V9.5m0 0c1.2 0 2-.9 2-2.6C13.5 4.5 12.7 2 11.5 2S9.5 4.5 9.5 6.9c0 1.7.8 2.6 2 2.6Z" {...STROKE} />
    </Svg>
  );
}

export function Sliders({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M2 4.5h5m3 0h4M2 11.5h4m3 0h5" {...STROKE} />
      <circle cx="8.5" cy="4.5" r="1.6" {...STROKE} />
      <circle cx="7.5" cy="11.5" r="1.6" {...STROKE} />
    </Svg>
  );
}

export function Clock({ className }: Props) {
  return (
    <Svg className={className}>
      <circle cx="8" cy="8" r="5.8" {...STROKE} />
      <path d="M8 4.6V8l2.4 1.6" {...STROKE} />
    </Svg>
  );
}

export function Wheat({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M8 14V6" {...STROKE} />
      <path d="M8 6c0-2 1-3.5 2.5-4.5C11 3.5 10 5.5 8 6Zm0 0C8 4 7 2.5 5.5 1.5 5 3.5 6 5.5 8 6Z" {...STROKE} />
      <path d="M8 10c0-1.6 1-2.8 2.5-3.6C11 8 10 9.6 8 10Zm0 0c0-1.6-1-2.8-2.5-3.6C5 8 6 9.6 8 10Z" {...STROKE} />
    </Svg>
  );
}

export function Truck({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M1.5 4h7v6.5h-7Zm7 2H11l2 2.2v2.3H8.5Z" {...STROKE} />
      <circle cx="4.5" cy="12" r="1.4" {...STROKE} />
      <circle cx="11" cy="12" r="1.4" {...STROKE} />
    </Svg>
  );
}

export function Bag({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M3 5h10l-.8 8.5H3.8Z" {...STROKE} />
      <path d="M5.8 5V3.6a2.2 2.2 0 0 1 4.4 0V5" {...STROKE} />
    </Svg>
  );
}

export function Umbrella({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M1.8 8a6.2 6.2 0 0 1 12.4 0Z" {...STROKE} />
      <path d="M8 8v4.4a1.6 1.6 0 0 1-3.2 0" {...STROKE} />
    </Svg>
  );
}

export function Book({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M2.5 2.5h4A2 2 0 0 1 8 3.2a2 2 0 0 1 1.5-.7h4v10h-4a2 2 0 0 0-1.5.7 2 2 0 0 0-1.5-.7h-4Z" {...STROKE} />
      <path d="M8 3.2v9.8" {...STROKE} />
    </Svg>
  );
}

export function Card({ className }: Props) {
  return (
    <Svg className={className}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" {...STROKE} />
      <path d="M1.5 6.5h13M4 10h3" {...STROKE} />
    </Svg>
  );
}

export function Tag({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M2.5 2.5h5l6 6-5 5-6-6Z" {...STROKE} />
      <circle cx="5.3" cy="5.3" r="1" fill="currentColor" />
    </Svg>
  );
}
