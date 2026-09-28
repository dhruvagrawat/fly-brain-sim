import BrainSurgeon from "@/components/apps/BrainSurgeon";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("brain-surgeon");

export default function Page() {
  return (
    <AppPage slug="brain-surgeon" stats={["Lesion a real connectome", "2 challenges", "Autopilot: greedy auto-surgeon"]}
      faq={[
        ["What does silencing do?", "It removes every outgoing synapse of the chosen cell type (both hemispheres) in the simulation. The neurons can still fire, but nobody hears them. That's how neuroscientists silence neurons genetically in real flies, for example with tetanus toxin."],
        ["Why is it so hard to stop the fly eating?", "Because the circuit is redundant. In my full-brain tests, silencing any single neuron downstream of the sugar receptors changed MN9 by less than 10%, and the best single cell type (CB0616) cut it by 23%. Many parallel routes carry the ‘eat’ signal, which is presumably a good design for an animal that must not starve."],
        ["How does the auto-surgeon choose?", "Greedy search on the live simulation. It silences each of the 24 most active candidate cell types in turn, measures MN9 for 300 ms of simulated time, keeps the most damaging cut, and repeats for cuts two and three. It's the same kind of screen neuroscientists run in real flies, just about a million times faster."],
        ["Is the patient the whole brain?", "It's the 5,164-neuron taste circuit: every neuron that fires in any taste condition, plus neighbours that receive strong input from them, so lesions can reveal hidden pathways. For every taste condition I tested, it reproduces the full 138,639-neuron brain exactly."],
      ]}
      how={<>
        <h2>How Fly Brain Surgeon works</h2>
        <p>This is how neuroscientists work out which neurons a behaviour needs: switch cells off one type at a time and see what breaks. Here you do it on a simulated brain built from the real FlyWire wiring.</p>
        <p>The patient is tasting food, so its sugar (and in the second challenge, bitter) receptor neurons are firing. Its <strong>MN9</strong> motor neuron, the one that extends the proboscis, is your vital sign. Each cut silences a whole cell type, and after every operation the brain is re-simulated from scratch so you see the true effect.</p>
        <h3>Two challenges</h3>
        <ul>
          <li><strong>Stop the feast.</strong> Sugar drives MN9 to ~120 Hz. Get it as close to zero as you can with three cuts.</li>
          <li><strong>Break the bitter veto.</strong> Add bitter and MN9 goes silent. Somewhere in the brain, inhibitory neurons carry that veto. Find and silence them, and the fly eats through the bitterness.</li>
        </ul>
        <p>Scores are saved in your browser. Switch to <em>Scrambled</em> wiring to see a brain where none of this makes sense.</p>
      </>}>
      <BrainSurgeon />
    </AppPage>
  );
}
