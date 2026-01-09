"use client";

import React from "react";
import { Carousel, Card } from "@/components/ui/apple-cards-carousel";

export function Features () {
  const cards = data.map((card, index) => (
    <Card key={card.src} card={card} index={index} />
  ));

  return (
    <div id="features" className="w-full h-full py-5">
      <h2 className="w-full self-center align-middle text-center text-xl md:text-5xl font-bold text-neutral-800 dark:text-neutral-200 font-sans">
        Get to know the Features
      </h2>
      <Carousel items={cards} />
    </div>
  );
}


const data = [
  {
    category: "Collaboration",
    title: "Real-time multiplayer sketching.",
    src: "https://images.unsplash.com/photo-1512314889357-e157c22f938d?q=80&w=3542&auto=format&fit=crop",
    
  },
  {
    category: "Design",
    title: "Brainstorm without boundaries.",
    src: "https://images.unsplash.com/photo-1542744094-24638eff58bb?q=80&w=3542&auto=format&fit=crop",
    
  },
  {
    category: "Development",
    title: "Visual architecture mapping.",
    src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=3540&auto=format&fit=crop",
    
  },
  {
    category: "Creative",
    title: "The infinite digital canvas.",
    src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=3464&auto=format&fit=crop",
    
  },
];