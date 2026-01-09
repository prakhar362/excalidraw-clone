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

const DummyContent = () => {
  return (
    <>
      {[...new Array(3).fill(1)].map((_, index) => {
        return (
          <div
            key={"dummy-content" + index}
            className="bg-[#F5F5F7] dark:bg-neutral-800 p-8 md:p-14 rounded-3xl mb-4"
          >
            <p className="text-neutral-600 dark:text-neutral-400 text-base md:text-2xl font-sans max-w-3xl mx-auto">
              <span className="font-bold text-neutral-700 dark:text-neutral-200">
                The first rule of Apple club is that you boast about Apple club.
              </span>{" "}
              Keep a journal, quickly jot down a grocery list, and take amazing
              class notes. Want to convert those notes to text? No problem.
              Langotiya jeetu ka mara hua yaar is ready to capture every
              thought.
            </p>
            <img
              src="https://assets.aceternity.com/macbook.png"
              alt="Macbook mockup from Aceternity UI"
              height="500"
              width="500"
              className="md:w-1/2 md:h-1/2 h-full w-full mx-auto object-contain"
            />
          </div>
        );
      })}
    </>
  );
};
const data = [
  {
    category: "Collaboration",
    title: "Real-time multiplayer sketching.",
    src: "https://images.unsplash.com/photo-1512314889357-e157c22f938d?q=80&w=3542&auto=format&fit=crop",
    content: <DummyContent />,
  },
  {
    category: "Design",
    title: "Brainstorm without boundaries.",
    src: "https://images.unsplash.com/photo-1542744094-24638eff58bb?q=80&w=3542&auto=format&fit=crop",
    content: <DummyContent />,
  },
  {
    category: "Development",
    title: "Visual architecture mapping.",
    src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=3540&auto=format&fit=crop",
    content: <DummyContent />,
  },
  {
    category: "Creative",
    title: "The infinite digital canvas.",
    src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=3464&auto=format&fit=crop",
    content: <DummyContent />,
  },
];