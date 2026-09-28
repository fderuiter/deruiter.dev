import React from "react";
import { MobileNavbar } from "@/components/MobileNavbar";
import { Footer } from "@/components/Footer";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileNavbar />
      {children}
      <Footer />
    </>
  );
}
