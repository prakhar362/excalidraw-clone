"use client";
import { Icons } from "@/components/ui/icons";
import Navbar  from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import Discover from "@/components/landing/features-section-demo-3";
import { Testimonials } from "@/components/landing/Testimonials";
import FAQWithSpiral from "@/components/landing/faq-section";
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
