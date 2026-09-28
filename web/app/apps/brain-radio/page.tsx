import BrainRadio from "@/components/apps/BrainRadio";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("brain-radio");

export default function Page() {
  return (
    <AppPage slug="brain-radio" stats={["Every spike can be a note", "5 stations", "Autopilot: the fly DJs itself"]}
      faq={[
        ["How do spikes become music?", "Each frame, a handful of the neurons that just spiked play a note. The instrument comes from the neuron's class (sensory, central, descending, motor…). The pitch comes from its real height in the brain (dorsal is high, ventral is low) on a pentatonic scale, and the stereo position from which side of the brain it's on."],
        ["What does DJ mode do?", "The fly's own outputs run the show. Every 4 bars its recent feeding (MN9) and escape (giant fiber) activity picks the next station. Feeding opens the low-pass filter, giant fiber activity adds brightness, and the balance of left vs right descending neurons pans the mix. Each choice is shown on screen with the reason."],
        ["Can I record it?", "Yes. Press Record while playing, then Stop & download to save a .webm audio file of exactly what the brain played."],
        ["Is this the real brain?", "It's the 6,861-neuron sandbox slice of the FlyWire connectome (taste, looming, smell and walking circuits) running live. Stations are rhythmic stimulus patterns, and everything after the stimulus, which neurons fire and when, comes from the simulation."],
      ]}
      how={<>
        <h2>How Fly Brain Radio works</h2>
        <p>A radio station for a brain. Each station is a rhythm of stimuli: sugar on the beat, looming threats on the off-beat, sniffs of vinegar. The simulated brain responds, and its spikes are turned into sound in real time with the Web Audio API.</p>
        <p>Because pitch comes from the real 3D position of each neuron and the instrument from its class, different circuits genuinely sound different. The taste pathway in the lower brain plays low and warm. Optic-lobe neurons chime at the top. Descending neurons, the brain's commands to the body, play the bass.</p>
        <h3>The fly DJ</h3>
        <p>With DJ mode on, the fly's outputs choose the music. After a big feeding response it cools down with <em>Bitter Truth</em>. When it gets scared it backs off into <em>Moonwalk</em>. When it's hungry it goes looking for food in <em>Vinegar Rave</em>. It's a small closed loop between brain and music.</p>
      </>}>
      <BrainRadio />
    </AppPage>
  );
}
