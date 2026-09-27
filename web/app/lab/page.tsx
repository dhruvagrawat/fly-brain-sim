import type { Metadata } from "next";
import Lab from "@/components/lab/Lab";

export const metadata: Metadata = { title: "Lab" };

export default function LabPage() {
  return <Lab />;
}
