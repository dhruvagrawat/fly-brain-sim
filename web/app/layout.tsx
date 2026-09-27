import type { Metadata, Viewport } from "next";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/chivo/400.css";
import "@fontsource/chivo/500.css";
import "@fontsource/chivo/600.css";
import "@fontsource/chivo-mono/400.css";
import "@fontsource/chivo-mono/500.css";
import "./globals.css";
import Nav from "@/components/Nav";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Flybrain · a whole fruit fly brain, simulated", template: "%s · Flybrain" },
  description:
    "Stimulate any neuron in the adult fruit fly brain and watch the signal spread through all 138,639 neurons of the FlyWire connectome. Built by Dhruv Agrawat.",
  authors: [{ name: "Dhruv Agrawat", url: "https://github.com/dhruvagrawat" }],
  openGraph: {
    title: "Flybrain",
    description: "A whole fruit fly brain, simulated neuron by neuron. 138,639 neurons, 15 million connections.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07090e" },
    { media: "(prefers-color-scheme: light)", color: "#f3f5f9" },
  ],
};

// Apply a saved theme choice before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('flybrain.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skip">Skip to content</a>
        <Nav />
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="container footer-in">
            <div>
              <Link href="/" className="brand">fly<b>brain</b></Link>
              <p style={{ marginTop: 12 }}>
                A whole-brain simulator for the adult fruit fly, built by{" "}
                <a href="https://github.com/dhruvagrawat" target="_blank" rel="noopener noreferrer">Dhruv Agrawat</a>.
                Open source on GitHub.
              </p>
            </div>
            <div>
              <h4>Explore</h4>
              <ul>
                <li><Link href="/lab/">Lab</Link></li>
                <li><Link href="/docs/">Documentation</Link></li>
                <li><Link href="/docs/roadmap/">Roadmap</Link></li>
                <li><Link href="/docs/changelog/">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4>Built on</h4>
              <ul>
                <li><a href="https://flywire.ai" target="_blank" rel="noopener noreferrer">FlyWire connectome</a></li>
                <li><a href="https://www.nature.com/articles/s41586-024-07763-9" target="_blank" rel="noopener noreferrer">Shiu et al. 2024 brain model</a></li>
                <li><Link href="/docs/credits/">Full credits &amp; citations</Link></li>
              </ul>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
