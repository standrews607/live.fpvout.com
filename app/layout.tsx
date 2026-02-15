import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import "./globals.css";
import Providers from "@/components/providers/Providers";
import DashboardProvider from "@/components/dashboard/DashboardProvider";
import type { NavItem } from "@/components/dashboard/DashboardProvider";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DigiView Web",
  description: "WebUSB FPV goggle viewer",
};

const navigationItems: NavItem[] = [
  {
    text: "Live FPV View",
    icon: <HomeRoundedIcon />,
    href: "/",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <InitColorSchemeScript defaultMode="dark" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <DashboardProvider navigation={navigationItems}>
            {children}
          </DashboardProvider>
        </Providers>
      </body>
    </html>
  );
}
