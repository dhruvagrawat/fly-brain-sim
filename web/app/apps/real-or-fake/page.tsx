import RealOrFake from "@/components/apps/RealOrFake";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("real-or-fake");

export default function Page() {
  return (
    <AppPage slug="real-or-fake" stats={["Real wiring vs 2 controls", "3 behaviours × 3 seeds", "Autopilot: runs and grades the battery"]}
      faq={[
        ["What's wrong with the viral fly-brain demos?", "Many of them train a readout layer on top of the connectome, or feed it game frames and map whatever comes out to buttons. When people ran controls, a shuffled connectome or even an ordinary neural network scored the same at Doom, and an untrained version behaved like a script that walks forward and shoots. Those demos show that a big recurrent network can be trained, not that the fly's wiring does anything."],
        ["What are the two controls?", "Scrambled targets keeps every neuron and every synapse (same senders, same strengths) but connects each synapse to a random neuron. Shuffled strengths keeps exactly who connects to whom but shuffles synapse strengths and signs across the whole circuit. If behaviour survives either one, it isn't coming from the real wiring."],
        ["Is anything trained here?", "No. Nothing in Flybrain is trained. The only parameters are the published model constants (Shiu et al. 2024) and the synapse counts measured by FlyWire. Behaviour either comes out of the wiring or it doesn't."],
        ["What does the result mean?", "In my tests, sugar drives the feeding neuron at ~115 Hz only with the real wiring (both controls: 0 Hz). Looming drives the escape neuron at ~170 Hz with real wiring, 0 Hz with scrambled targets, and 47–73 Hz with shuffled strengths, so the exact synapse counts matter. Bitter-veto silence is expected from any broken brain, so that test mainly checks the real brain gets it right."],
      ]}
      how={<>
        <h2>The control experiment the viral demos skipped</h2>
        <p>When the fly connectome went viral, it was hooked up to Doom, Mario, Beat Saber and trading bots. Then people ran controls. The <a href="https://github.com/gabrycina/doom-fly-control">doom-fly-control</a> project found that real wiring, scrambled wiring and an ordinary neural network all scored about 19 kills per game. <a href="https://www.neuroai.science/p/are-flies-playing-beat-saber">Patrick Mineault showed</a> that a worm's connectome could fly a fly body just as well. The conclusion: the fly brain wasn't playing Doom.</p>
        <p>This page runs that control on Flybrain. The same stimulus goes into the real FlyWire wiring and into a control, side by side, live in your browser. Only the real wiring should produce the behaviour.</p>
        <h3>What I found</h3>
        <ul>
          <li><strong>Sugar → feeding:</strong> real wiring drives MN9 at ~120 Hz. Scrambled targets: 0 Hz.</li>
          <li><strong>Looming → escape:</strong> real wiring drives the giant fibers at ~170 Hz. Scrambled targets: 0 Hz. Shuffled strengths: 47–73 Hz. The escape pathway is so direct that the bare connection map carries part of the signal, but only at about a third of the strength of the real synapse weights.</li>
          <li><strong>Bitter veto:</strong> the real brain gets it right (feeding neuron silent). The controls are silent too, because they're silent for everything.</li>
        </ul>
        <p>That's why every Flybrain app has a <em>Scrambled</em> switch: the behaviours you see come from the fly's actual connections.</p>
      </>}>
      <RealOrFake />
    </AppPage>
  );
}
