"use client";
import { Icons } from "@/components/ui/icons";
import Navbar  from "@/components/Navbar";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import Discover from "@/components/features-section-demo-3";
import { Testimonials } from "@/components/Testimonials";
import FAQWithSpiral from "@/components/faq-section";
import Cta  from "@/components/cta";
import { Footerdemo } from "@/components/ui/footer-section";

export default function Home() {
  return (
    <div>
      <Navbar className="top-5" />
      <Hero/>
      <Features/>
      <Discover/>
      <Testimonials/>
      <FAQWithSpiral/>
      <Cta/>
      <Footerdemo/>
    </div>
  );
}
