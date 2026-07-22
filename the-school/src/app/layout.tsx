import type { Metadata } from "next";
import { Bodoni_Moda, Archivo, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { SiteHeader } from "./SiteHeader";
import "./globals.css";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--ff-display",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-body",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ff-mono",
});

export const metadata: Metadata = { title: "École" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#D9B063",
          colorBackground: "#14110D",
          colorText: "#EDE6D6",
          colorInputBackground: "#1B170F",
          colorInputText: "#EDE6D6",
          fontFamily: "var(--ff-body)",
        },
      }}
    >
      <html lang="en" className={`${bodoniModa.variable} ${archivo.variable} ${ibmPlexMono.variable}`}>
        <body className="font-body">
          <SiteHeader />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
