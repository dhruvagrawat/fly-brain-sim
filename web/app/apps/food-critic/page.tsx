import FoodCritic from "@/components/apps/FoodCritic";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("food-critic");

export default function Page() {
  return (
    <AppPage slug="food-critic" stats={["5,164 real taste-circuit neurons", "Runs live in your browser", "Autopilot: the brain decides"]}
      faq={[
        ["Is the fly actually deciding, or is this scripted?", "It decides. Each dish becomes a firing rate on the fly's real sugar, bitter and salt taste neurons. The simulation then runs through 530,000 real synapses, and the score is simply how fast MN9, the motor neuron that extends the proboscis, fires. We never tell it what to like."],
        ["Why does bitter food get a zero even with sugar in it?", "Because that's what the wiring does. In the FlyWire connectome, bitter taste neurons inhibit the sugar-to-feeding pathway. In the full brain model, sugar at 200 Hz drives MN9 at about 120 Hz, but sugar plus bitter drops it to zero. Real flies show the same bitter veto."],
        ["Where do the taste profiles come from?", "They're my rough estimates of how sweet, bitter and salty each dish is. Flies also have sour, umami, fat and water sensors, which aren't modelled here. The fly's reactions are real simulations. The dish descriptions are for fun."],
        ["What does 'Scrambled' do?", "It keeps every neuron and synapse but connects each synapse to a random target. The feeding reflex disappears (MN9 goes silent), which shows the behaviour comes from the fly's real wiring, not the simulator."],
      ]}
      how={<>
        <h2>How the Fly Food Critic works</h2>
        <p>A fruit fly tastes with gustatory receptor neurons on its proboscis and legs. Sugar neurons tell the brain “this is food”, bitter neurons say “poison”, and low-salt neurons say “a bit of salt is nice”. The subesophageal zone weighs these signals, and when the answer is yes, the motor neuron <strong>MN9</strong> fires and the fly extends its proboscis to eat.</p>
        <p>This app runs that decision on the real wiring. Each dish is turned into firing rates on 20 sugar, 32 bitter and 9 salt neurons from the FlyWire connectome. A leaky integrate-and-fire simulation of the <strong>5,164 neurons</strong> that respond to taste (every neuron that fires for any taste, plus their strongly driven neighbours) runs in your browser. The proboscis on screen extends exactly as far as MN9 drives it.</p>
        <h3>What the full brain model says</h3>
        <ul>
          <li>Sugar at 50, 100 and 200 Hz drives MN9 at about 15, 82 and 122 Hz: a smooth dose response.</li>
          <li>Bitter alone: MN9 silent. Sugar plus a lot of bitter: MN9 silent. Sugar plus a little bitter: 78 Hz.</li>
          <li>Salt alone barely registers (under 10 Hz), and salt added to sugar doesn't change much.</li>
        </ul>
        <p>This circuit reproduces the full 138,639-neuron brain exactly for every one of these conditions. The check is in the <a href="/docs/notebook/">lab notebook</a>.</p>
      </>}>
      <FoodCritic />
    </AppPage>
  );
}
