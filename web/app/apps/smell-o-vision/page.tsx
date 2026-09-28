import SmellOVision from "@/components/apps/SmellOVision";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("smell-o-vision");

export default function Page() {
  return (
    <AppPage slug="smell-o-vision" stats={["4,061 smell-circuit neurons", "6 odours, 2 antennae", "Autopilot: brain-steered plume tracking"]}
      faq={[
        ["Does the fly really steer itself?", "Yes. Each sniff sends the smell each antenna feels into the real receptor neurons for that side. The brain simulation runs, and the fly turns toward the side whose projection neurons fired more. In the full brain model, a vinegar sniff on the left drives left projection neurons about 33% harder than right ones. That built-in bias is what the fly follows."],
        ["Why sniffs instead of a continuous smell?", "This connectome model, like the published one it's based on, was tuned for taste. Its smell centre over-excites after about 20 ms and ends up lighting most projection neurons whatever the odour. The first 15–20 ms is odour-specific: mould drives only DA2 neurons, CO₂ only V, pheromone mostly DA1. So the app works in short sniffs and resets between them. Real flies sample odours in short bursts too."],
        ["Which neurons respond to each smell?", "Odours are mapped to receptor neuron types (glomeruli) from published tuning data: vinegar → DM1, DM4, DP1m, VM2, VA2; banana → DM2, DM3, DL1; cVA pheromone → DA1; ammonia → VM1; CO₂ → V; geosmin → DA2. Real odours activate broader, concentration-dependent sets, so treat these as simplified."],
        ["Why does it sometimes get lost?", "One sniff is noisy, the plume flickers, and the antennae are close together, just like a real fly's. When nothing is smelled it makes random casting turns until it hits the plume again."],
      ]}
      how={<>
        <h2>How Smell-o-vision works</h2>
        <p>Flies smell with about 1,300 olfactory receptor neurons per antenna, sorted into ~50 types. Each type sends its axons to one <strong>glomerulus</strong> in the antennal lobe, where <strong>projection neurons</strong> pick up the signal and carry it to the mushroom body (learning) and the lateral horn (instinct). The pattern of active glomeruli is the fly's code for a smell.</p>
        <p>Each sniff here stimulates the receptor neurons for the chosen odour on the left and right antennae, scaled by how much odour each antenna is in. It runs <strong>4,061 real neurons</strong> for 20 ms and reads out the projection neurons. The bar chart is the resulting fingerprint.</p>
        <h3>Autopilot: plume tracking</h3>
        <p>In autopilot the fly lives in an arena with a drifting odour plume. Every 120 ms it takes a sniff with both antennae, compares its own left and right projection-neuron spike counts, and turns toward the bigger one. That's the same bilateral comparison real flies use (Gaudry et al. 2013). When it smells nothing it casts randomly. Nobody tells it where the source is. Switch to <em>Scrambled</em> wiring and the left/right signal becomes noise, so tracking falls apart.</p>
      </>}>
      <SmellOVision />
    </AppPage>
  );
}
