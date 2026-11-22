
import type { Metadata } from "next";
import { Sometype_Mono } from "next/font/google";
import "./globals.css";

const sometypeMono = Sometype_Mono({
  variable: "--font-sometype-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://go-wrap.com"),
  title: "GO-WRAP",
  description:
    "Go-Wrap helps you wrap any open-source AI model, making it feature-complete with long-term memory, function calling, self-refinement, and more.",
  keywords: [
    "AI wrapper",
    "open-source AI",
    "AI infrastructure",
    "function calling",
    "memory",
    "model refinement",
    "chat API",
  ],
  openGraph: {
    title: "Go-Wrap – Wrap Any Open-Source AI Model",
    description:
      "Enhance your AI models with function calling, long-term memory, and more.",
    url: "https://go-wrap.com",
    type: "website",
    images: [
      {
        url: "/go-wrap.png",
        alt: "Go-Wrap – Wrap Any Open-Source AI Model",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Go-Wrap – Wrap Any OS Model",
    description:
      "Make any open-source model feature complete with Go-Wrap.",
    images: ["/go-wrap.png"],
    site: "@tay2win",
    creator: "@tay2win",
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html lang="en" className={sometypeMono.variable}>
      <body>{children}</body>
    </html>
  );
}
