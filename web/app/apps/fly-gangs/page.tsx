import FlyGangs from "@/components/apps/FlyGangs";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("fly-gangs");

export default function Page() {
  return (
    <AppPage slug="fly-gangs" stats={["6 gangs, 3 events per round", "Every score is a brain simulation", "Autopilot: evolution runs itself"]}
      faq={[
        ["What is a gang?", "A fly brain with a mutation: one to three cell types silenced. The Wild Types have an untouched brain. Everyone else is a mutant."],
        ["How are events decided?", "Each event is a real simulation of that gang's brain. Feast: sugar taste neurons at 200 Hz, and the score is how fast MN9 (feeding) fires. Poison: sugar plus bitter. A healthy fly refuses, so MN9 firing here costs points. Dodge: looming detectors at 60 Hz, and the score is how fast the giant fiber escape neurons fire."],
        ["Can a mutant beat the wild type?", "Sometimes. In my full-brain tests, silencing certain neurons (like DNge031) made the fly eat more. A mutation like that wins the feast, but if it also breaks the bitter veto, the poison event punishes it. Evolution here is a trade-off between appetite, caution and reflexes."],
        ["How does evolution work?", "After each round the lowest-scoring gang is eliminated. It's replaced by a child of the winner that inherits the winner's cuts plus one random change: a new cut, a restored cell type, or a swap. Your gangs are saved in your browser."],
      ]}
      how={<>
        <h2>How Fly Gangs works</h2>
        <p>Silencing neurons is how neuroscientists find out what they do. Fly Gangs turns it into a tournament. Every gang is a fruit fly brain with some cell types switched off, and each round every brain is simulated live on three events drawn from real fly survival: <strong>eat</strong> when there's sugar, <strong>don't eat</strong> when it's bitter, and <strong>jump</strong> when something looms.</p>
        <p>The feast and poison events run the 5,164-neuron taste circuit. The dodge event runs the 5,804-neuron looming circuit. The brain panel shows the current contestant's brain, with its silenced neurons crossed out.</p>
        <h3>Survival of the fliest</h3>
        <p>With autopilot on, rounds run continuously. The worst gang is eliminated and a mutant child of the winner takes its place, so over many rounds you're watching a tiny evolutionary search over the fly's connectome. Start your own gang with up to three cuts and see if it survives.</p>
      </>}>
      <FlyGangs />
    </AppPage>
  );
}
