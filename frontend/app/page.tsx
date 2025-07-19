"use client";
import { HeroSection } from "@/components/hero-section";
import { Icons } from "@/components/ui/icons";

export default function Home() {
  return (
    <div>
      <HeroSection
        badge={{
          text: "Now live: Real-time collaboration",
          action: {
            text: "How it works",
            href: "/",
          },
        }}
        title="Build faster with Sketchcalibur"
        description="Sketchcalibur is a real-time collaborative whiteboard. Sketch, brainstorm, and co-create ideas visually with your team. Share links, invite collaborators, and draw together seamlessly in themed rooms."
        actions={[
          {
            text: "Get Started",
            href: "/auth",
            variant: "default",
          },
          {
            text: "GitHub",
            href: "https://github.com/prakhar362",
            variant: "outline",
            icon: <Icons.gitHub className="h-5 w-5" />,
          },
        ]}
        image={{
          light: "https://vibeus-cdn.vibe.pub/img_1-1cBpGvDjcsBgjDYZSvs2Qwgv2Fi0W0.webp", // Replace with your preview image
          dark: "https://vibeus-cdn.vibe.pub/img_1-1cBpGvDjcsBgjDYZSvs2Qwgv2Fi0W0.webp",
          alt: "Sketchcalibur interface preview",
        }}
      />
    </div>
  );
}
