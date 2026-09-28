import type { Metadata } from "next";
import Lab from "@/components/lab/Lab";

export const metadata: Metadata = {
  title: "Lab",
  description: "Replay and run whole fruit fly brain experiments: 3D map of 138,639 neurons, command center, brain outputs, charts and run comparison.",
  alternates: { canonical: "/lab/" },
  openGraph: { images: [{ url: "/og/lab.png", width: 1200, height: 630 }] },
};

export default function LabPage() {
  return <Lab />;
}
