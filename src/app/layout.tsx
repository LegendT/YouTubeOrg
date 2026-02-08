import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { IconProvider } from "@/components/icon-provider";

export const metadata: Metadata = {
  title: "YouTube Playlist Organiser",
  description: "Organise your YouTube playlists with AI-powered categorisation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <IconProvider>
            <Navigation />
            {children}
            <Toaster position="bottom-right" richColors expand visibleToasts={100} closeButton toastOptions={{ duration: 3000 }} />
          </IconProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
