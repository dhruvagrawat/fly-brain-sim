import FlappyFly from "@/components/apps/FlappyFly";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("flappy-fly");

export default function Page() {
  return (
    <AppPage slug="flappy-fly" stats={["5,804 looming-circuit neurons", "Every flap is a giant fiber spike", "Play against the fly"]}
      faq={[
        ["Is the brain really pressing the button?", "Yes. In autopilot the only thing that makes the fly flap is a spike from its giant fiber neurons (DNp01) in the simulation. Nothing else is scripted. The game only converts what the fly sees into input on its LPLC2 looming-detector neurons."],
        ["What does the fly see?", "LPLC2 neurons respond to objects on a collision course, and fire harder as impact gets closer. The game computes the time-to-contact of the lower pipe (if the fly is heading into it) and of the ground (while falling), and drives all 210 LPLC2 neurons harder the closer the impact, up to 150 Hz. In the full brain, LPLC2 at 10, 30, 80 and 150 Hz drives the giant fiber at about 25, 105, 175 and 230 Hz."],
        ["How good is the fly?", "In my headless tests (6 runs each) the real brain passed 1 to 13 pipes, about 8 on average, and survived around 19 seconds. With scrambled wiring it passed zero and crashed within a second. Its strategy is one reflex: jump when something looms below. It ignores the top pipe and can't plan, because the escape reflex evolved to dodge swatters, not to thread gaps."],
        ["What happens with scrambled wiring?", "The looming signal never reaches the giant fiber, which stays silent. The fly never flaps and drops straight to the ground. That's how you know it's the wiring doing the work."],
      ]}
      how={<>
        <h2>How Flappy Fly works</h2>
        <p>When something rushes at a fly, like your hand or a swatter, <strong>LPLC2</strong> neurons in its optic lobe detect the collision course, and the pair of <strong>giant fiber</strong> neurons fires. The giant fibers are among the biggest, fastest neurons in the fly. They trigger an escape jump within a few milliseconds.</p>
        <p>Flappy Fly wires that reflex into Flappy Bird. The game runs the <strong>5,804 neurons</strong> of the looming circuit live and plays in simulated time: one game millisecond is one brain millisecond. Obstacles below that are on a collision course, plus the ground rushing up, drive LPLC2. Every giant fiber spike (with a 170 ms wing refractory period) is a flap.</p>
        <h3>Reading the strip</h3>
        <p>The strip at the bottom of the game shows the reflex in action: orange is looming input, pale yellow ticks are giant fiber spikes, and blue marks flaps. Turn off autopilot to play yourself, and compare your best with the fly's.</p>
      </>}>
      <FlappyFly />
    </AppPage>
  );
}
