import type { Metadata } from "next";
import "./globals.css";
import { NavigationLoader } from "@/components/NavigationLoader";

export const metadata: Metadata = {
  title: "Via Codos (PVT) LTD | Enterprise IT, Staff Augmentation & Codos Console",
  description:
    "International IT solutions, custom software, dedicated engineering & management staff augmentation, and the Codos Console SaaS platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#0A0F1A] antialiased">
        <NavigationLoader />
        {children}
      </body>
    </html>
  );
}
