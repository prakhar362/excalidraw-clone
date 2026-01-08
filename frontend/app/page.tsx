"use client";
import { Icons } from "@/components/ui/icons";
import Navbar  from "@/components/Navbar";
import { Hero } from "@/components/hero";

export default function Home() {
  return (
    <div>
      <Navbar className="top-10" />
      <Hero/>
     
    </div>
  );
}
