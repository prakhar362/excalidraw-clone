"use client";
import { Icons } from "@/components/ui/icons";
import Navbar  from "@/components/Navbar";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";

export default function Home() {
  return (
    <div>
      <Navbar className="top-5" />
      <Hero/>
      <Features/>
     
    </div>
  );
}
