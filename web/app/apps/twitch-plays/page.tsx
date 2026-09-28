import TwitchPlays from "@/components/apps/TwitchPlays";
import { AppPage, appMetadata } from "@/components/apps/AppPage";

export const metadata = appMetadata("twitch-plays");

export default function Page() {
  return (
    <AppPage slug="twitch-plays" stats={["Anonymous Twitch chat, no login", "13 chat commands", "OBS overlay mode"]}
      faq={[
        ["How do I put this on my stream?", "Type your channel name and press Connect chat. Then press ‘Copy OBS overlay URL’ and add that URL in OBS as a Browser Source (1920×1080). The overlay shows the live brain, the fly's status, the commands and the chat feed. Chat is read anonymously, so no login or bot account is needed."],
        ["What can chat do?", "!sugar, !bitter and !salt stimulate taste neurons. !loom, !loomleft and !loomright stimulate looming detectors. !walk, !moonwalk, !jump and !turn drive the command neurons for walking, backing up, escaping and steering. !vinegar, !banana and !pheromone make the fly sniff. Each user has a 2.5-second cooldown."],
        ["What does the fly do when chat is quiet?", "Autopilot takes over after 5 seconds. The brain's own recent output picks the next experience: if its feeding neuron was firing it goes back for sugar, if the giant fiber fired it runs, and if it's walking it stops to sniff. A boredom counter stops it looping forever. Every choice is posted in the feed with the reason."],
        ["Is the status real?", "Yes. It's read straight from the simulation: FEEDING is MN9 above 25 Hz, ESCAPING is the giant fibers above 40 Hz, and WALKING or TURNING come from the balance of left and right descending neurons."],
      ]}
      how={<>
        <h2>How Twitch Plays Fly Brain works</h2>
        <p>Twitch Plays Pokémon had 1.1 million people fighting over one Game Boy. This version gives your chat a fruit fly brain. The page runs a <strong>6,861-neuron</strong> slice of the FlyWire connectome in the viewer's browser, covering taste, looming vision, smell and the descending neurons that command walking and escape.</p>
        <p>Chat commands become firing rates on real sensory or command neurons for a second or two. The brain does the rest. You watch the signal spread across the 3D brain and the fly's status change from IDLE to FEEDING, ESCAPING or TURNING LEFT. When several people spam at once, their stimuli overlap, and sugar-plus-bitter really does shut feeding down.</p>
        <h3>No stream? No problem</h3>
        <p>With demo chat bots on, simulated viewers send commands so the page is always alive. You can also type commands yourself.</p>
      </>}>
      <TwitchPlays />
    </AppPage>
  );
}
