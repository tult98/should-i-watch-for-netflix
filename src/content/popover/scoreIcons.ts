import type { ScoreSource } from "../../shared/types";

const SVG_NS = "http://www.w3.org/2000/svg";
const HEIGHT = 16;

type Attrs = Record<string, string | number>;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  for (const child of children) node.appendChild(child);
  return node;
}

function root(width: number, ...children: SVGElement[]): SVGSVGElement {
  return el(
    "svg",
    {
      "aria-hidden": "true",
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
      class: "score-icon",
    },
    ...children,
  );
}

function text(
  content: string,
  x: number,
  size: number,
  fill: string,
  anchor = "middle",
): SVGTextElement {
  const node = el("text", {
    x,
    y: 12,
    "text-anchor": anchor,
    "font-family": "Arial, Helvetica, sans-serif",
    "font-weight": 900,
    "font-size": size,
    fill,
  });
  node.textContent = content;
  return node;
}

function badge(
  width: number,
  background: string,
  label: string,
  color: string,
  size: number,
): SVGSVGElement {
  return root(
    width,
    el("rect", { width, height: HEIGHT, rx: 3, fill: background }),
    text(label, width / 2, size, color),
  );
}

export function imdbIcon(): SVGSVGElement {
  return badge(32, "#f5c518", "IMDb", "#000000", 10);
}

export function tmdbIcon(): SVGSVGElement {
  return badge(34, "#01b4e4", "TMDB", "#0d253f", 9.5);
}

export function malIcon(): SVGSVGElement {
  return badge(30, "#2e51a2", "MAL", "#ffffff", 10);
}

export const RT_FRESH_MIN = 60;

export function rtIcon(score: number): SVGSVGElement {
  if (score >= RT_FRESH_MIN) {
    return root(
      HEIGHT,
      el("circle", { cx: 8, cy: 9.2, r: 6.3, fill: "#fa320a" }),
      el("path", {
        d: "M8 4.2C6.6 2.8 4.8 3 3.6 3.8c1.4.1 2.2.7 2.6 1.6zM8 4.2C9.4 2.8 11.2 3 12.4 3.8c-1.4.1-2.2.7-2.6 1.6z",
        fill: "#4aa52e",
      }),
      el("rect", {
        x: 7.2,
        y: 1.2,
        width: 1.6,
        height: 3.6,
        rx: 0.8,
        fill: "#4aa52e",
      }),
    );
  }
  return root(
    HEIGHT,
    el("path", {
      d: "M8 1.5c1.3 0 1.6 1.6 2.8 2 1.3.4 2.9-.7 3.7.5.8 1.2-.6 2.2-.4 3.4.2 1.2 1.9 1.7 1.2 3-.7 1.2-2.2.4-3.2 1.2-.9.8-.5 2.6-2 3-1.4.4-2.1-1-3.3-1.5-1.3-.5-3 .2-3.5-1.1-.5-1.3 1.2-2 1.2-3.2S2.4 6.7 3.3 5.5c.9-1.1 2.5-.2 3.5-1C7.7 3.8 6.7 1.5 8 1.5z",
      fill: "#6bb533",
    }),
  );
}

export const METACRITIC_GREEN_MIN = 61;
export const METACRITIC_YELLOW_MIN = 40;

export function metacriticColor(score: number): string {
  if (score >= METACRITIC_GREEN_MIN) return "#66cc33";
  if (score >= METACRITIC_YELLOW_MIN) return "#ffcc33";
  return "#ff0000";
}

export function metacriticIcon(score: number): SVGSVGElement {
  const background = metacriticColor(score);
  return badge(
    HEIGHT,
    background,
    "M",
    background === "#ffcc33" ? "#000000" : "#ffffff",
    12,
  );
}

export function scoreIcon(source: ScoreSource, score: number): SVGSVGElement {
  switch (source) {
    case "imdb":
      return imdbIcon();
    case "rt":
      return rtIcon(score);
    case "metacritic":
      return metacriticIcon(score);
    case "tmdb":
      return tmdbIcon();
    case "mal":
      return malIcon();
  }
}
