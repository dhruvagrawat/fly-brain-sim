// Registry of Flybrain apps: drives navigation, the /apps hub, SEO metadata and the sitemap.

export type AppInfo = {
  slug: string;
  name: string;
  tagline: string;
  description: string; // meta description, ~150 chars
  keywords: string[];
  pack: string;
  autopilot: string; // what the brain controls in autopilot
  status?: "new" | "beta";
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://flybrain.vercel.app";
export const SITE_NAME = "Flybrain";

export const APPS: AppInfo[] = [
  {
    slug: "food-critic",
    name: "Fly Food Critic",
    tagline: "A real fruit fly brain tastes your food and decides whether to eat it.",
    description: "Serve jalebi, karela or chai to a simulated fruit fly brain. Its real taste wiring decides whether to extend its proboscis and eat. Watch every neuron fire.",
    keywords: ["fly food critic", "fruit fly taste", "fly brain simulation", "connectome", "sugar bitter taste neurons", "MN9 proboscis", "drosophila taste"],
    pack: "taste",
    autopilot: "The brain tastes each dish and its feeding motor neuron decides how hard to eat.",
  },
  {
    slug: "smell-o-vision",
    name: "Smell-o-vision",
    tagline: "Give a fly brain something to sniff and see which neurons light up. Then watch it follow the smell.",
    description: "Let a simulated fruit fly smell vinegar, banana, CO₂ or mould. See the odour fingerprint in its antennal lobe and watch the brain steer toward the smell by itself.",
    keywords: ["fly smell simulation", "olfaction", "antennal lobe", "odor navigation", "fruit fly brain", "connectome smell", "drosophila olfactory"],
    pack: "smell",
    autopilot: "The fly sniffs with both antennae and steers toward the side whose smell neurons fire more.",
  },
  {
    slug: "brain-surgeon",
    name: "Fly Brain Surgeon",
    tagline: "Silence up to three cell types and try to stop a hungry fly from eating.",
    description: "A lesion puzzle on a real fruit fly connectome. Silence neurons to stop sugar-driven feeding, or let the auto-surgeon search the brain for you.",
    keywords: ["brain surgeon game", "fly brain lesion", "connectome puzzle", "neuroscience game", "silence neurons", "fruit fly brain game"],
    pack: "taste",
    autopilot: "The auto-surgeon lesions cell types one by one, measures the feeding neuron, and keeps the cut that hurts most.",
    status: "new",
  },
  {
    slug: "flappy-fly",
    name: "Flappy Fly",
    tagline: "Flappy Bird, played by a fruit fly’s escape reflex.",
    description: "Obstacles loom at a simulated fruit fly. Its looming detectors fire, the giant fiber escape neuron spikes and the fly jumps. A real connectome playing Flappy Bird.",
    keywords: ["flappy fly", "fly brain plays flappy bird", "giant fiber", "looming escape", "LPLC2", "fruit fly brain game", "connectome game"],
    pack: "loom",
    autopilot: "Looming obstacles drive LPLC2 neurons. Every giant fiber spike makes the fly flap.",
  },
  {
    slug: "twitch-plays",
    name: "Twitch Plays Fly Brain",
    tagline: "Your chat controls a fruit fly brain, live.",
    description: "Connect a Twitch channel and let chat stimulate a simulated fruit fly brain with commands like !sugar and !loom. Stream-ready overlay. When chat goes quiet, the fly runs itself.",
    keywords: ["twitch plays", "fly brain stream", "twitch chat game", "fruit fly brain live", "interactive neuroscience", "stream overlay"],
    pack: "sandbox",
    autopilot: "When chat is quiet the fly picks its own next experience from whichever behaviour its brain is driving.",
  },
  {
    slug: "brain-radio",
    name: "Fly Brain Radio",
    tagline: "Listen to a fruit fly brain. Every spike is a note.",
    description: "Sonify a live fruit fly brain simulation. Each neuron class plays an instrument and every spike becomes sound. In DJ mode the fly’s own outputs pick the next track.",
    keywords: ["brain music", "sonification", "fly brain radio", "neural music", "spikes to sound", "generative music", "connectome"],
    pack: "sandbox",
    autopilot: "The fly DJs itself. Its descending neurons choose the next stimulus, so the music follows its brain.",
  },
  {
    slug: "real-or-fake",
    name: "Is It Really the Fly?",
    tagline: "The control experiment the viral fly-brain demos skipped.",
    description: "Run the same experiment on the real fruit fly connectome and on scrambled wiring. The real brain feeds and escapes. Scramble it and the behaviour disappears.",
    keywords: ["fly brain doom fake", "connectome control experiment", "scrambled connectome", "is the fly brain really playing", "fruit fly brain", "neuroscience"],
    pack: "taste",
    autopilot: "The autopilot runs the whole battery (real vs scrambled, feeding and escape, several seeds) and grades it.",
  },
  {
    slug: "fly-gangs",
    name: "Fly Gangs",
    tagline: "Breed mutant fly brains and send them to battle.",
    description: "Create gangs of mutant fruit flies with different neurons silenced. They compete at feasting, dodging and sniffing on real brain simulations, and the winners breed.",
    keywords: ["fly gangs", "evolution game", "mutant fly brains", "fruit fly battle", "connectome game", "neuroevolution"],
    pack: "taste",
    autopilot: "Tournament mode runs itself: every event is decided by each gang’s simulated brain, and winners pass their mutations on.",
    status: "new",
  },
];

export const appBySlug = (s: string) => APPS.find((a) => a.slug === s)!;
