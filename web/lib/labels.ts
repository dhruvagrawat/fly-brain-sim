import type { Row } from "./data";

export const CLASS_LABEL: Record<string, string> = {
  optic: "Optic lobe",
  central: "Central brain",
  sensory: "Sensory",
  visual_projection: "Visual projection",
  ascending: "Ascending",
  descending: "Descending",
  sensory_ascending: "Sensory ascending",
  visual_centrifugal: "Visual centrifugal",
  motor: "Motor",
  endocrine: "Endocrine",
  "": "Unlabelled",
  unlabelled: "Unlabelled",
  stimulated: "Stimulated",
  other: "Other",
};

/** Population-chart series: fixed order and fixed colour token per entity (colour follows the entity). */
export const SERIES: [string, string][] = [
  ["stimulated", "--s2"],
  ["sensory", "--s1"],
  ["central", "--s3"],
  ["optic", "--s6"],
  ["visual_projection", "--s4"],
  ["ascending", "--s7"],
  ["descending", "--s5"],
  ["motor", "--s8"],
  ["other", "--s-other"],
];

/** Behaviour readouts for known output neurons, keyed by FlyWire ID or cell type. */
export const KNOWN: Record<string, string> = {
  "720575940660219265": "MN9 · proboscis extension (feeding)",
  DNp01: "Giant fiber · escape jump",
  MDN: "Moonwalker · backward walking",
  DNp09: "Forward walking",
  DNa02: "Steering",
  DNa01: "Steering",
  DNg12_a: "Grooming",
  DNg12_b: "Grooming",
  DNp42: "Backward walking",
  DNg14: "Proboscis / feeding",
  aDN1: "Antennal grooming",
  DNg11: "Grooming",
  DNp10: "Escape / looming",
  DNp02: "Escape / looming",
  DNp04: "Escape / looming",
  DNp11: "Escape / looming",
  DNp06: "Escape / looming",
};

export const nameOf = (r: Row) => r[2] || "…" + r[1].slice(-6);
export const behaviourOf = (r: Row) => KNOWN[r[1]] || KNOWN[r[2]];

export const fmt = new Intl.NumberFormat("en-US");
