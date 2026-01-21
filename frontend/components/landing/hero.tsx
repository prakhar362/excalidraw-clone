"use client";
import { cn } from "@/lib/utils";
// this is a client component
import { useEffect } from "react";
import Link from "next/link";
import { renderCanvas } from "@/components/ui/canvas"
import { DIcons } from "dicons";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

export function Hero() {
  useEffect(() => {
    renderCanvas();
  }, []);

  return (
    <section id="home">
      <div className="animation-delay-8 animate-fadeIn mt-20 flex  flex-col items-center justify-center px-4 text-center md:mt-20">
          <div
        className={cn(
          "absolute inset-0",
          "[background-size:20px_20px]",
          "[background-image:radial-gradient(#d4d4d4_1px,transparent_2px)]",
          "dark:[background-image:radial-gradient(#404040_1px,transparent_2px)]",
        )}
      />
        <div className="z-10 mb-4 mt-10 sm:justify-center md:mb-4 md:mt-20">
          <div className="relative flex items-center whitespace-nowrap rounded-full border bg-popover px-3 py-1 text-xs leading-6  text-primary/60 ">
            <DIcons.Shapes className="h-5 p-1 text-orange-500" />Now live on ProductHunt.com
            <a
              href="https://www.producthunt.com/products/sketchcalibur"
              rel="noreferrer"
              className="hover:text-ali ml-1 flex items-center font-semibold"
            >
              <div className="absolute inset-0 flex" aria-hidden="true" />
              {" "}
              <span aria-hidden="true">
                <DIcons.ArrowRight className="h-4 w-4" />
              </span>
            </a>
          </div>
        </div>

        <div className="mb-2 mt-4  md:mt-6">
          <div className="px-2">
            <div className="border-ali relative mx-auto h-full max-w-7xl border p-6 [mask-image:radial-gradient(800rem_96rem_at_center,white,transparent)] md:px-12 md:py-20">
              <h1 className="flex  select-none flex-col  px-3 py-2 text-center text-5xl font-semibold leading-none tracking-tight md:flex-col md:text-8xl lg:flex-row lg:text-8xl">
                <DIcons.Plus
                  strokeWidth={4}
                  className="text-ali absolute -left-5 -top-5 h-10 w-10"
                />
                <DIcons.Plus
                  strokeWidth={4}
                  className="text-ali absolute -bottom-5 -left-5 h-10 w-10"
                />
                <DIcons.Plus
                  strokeWidth={4}
                  className="text-ali absolute -right-5 -top-5 h-10 w-10"
                />
                <DIcons.Plus
                  strokeWidth={4}
                  className="text-ali absolute -bottom-5 -right-5 h-10 w-10"
                />
                Build faster with Sketchcalibur
              </h1>
              
                
                <div className="flex justify-center gap-2">
            <Link href={"/auth"}>
              <Button variant="default" size="lg">
                Get Started
              </Button>
            </Link>
            <Link href={"https://github.com/prakhar362"} target="_blank">
              <Button variant="outline" size="lg">
                <Icons.gitHub className="h-6 w-6 mr-2 " /> GitHub
              </Button>
            </Link>
          </div>
              
            </div>
          </div>

          <h1 className="mt-8 text-2xl md:text-2xl">
            Sketchcalibur is a real-time collaborative whiteboard.  
            <span className="text-ali font-bold"></span>
          </h1>

          <p className="md:text-md mx-auto mb-16 mt-2 max-w-2xl px-6 text-sm text-primary/60 sm:px-6 md:max-w-4xl md:px-20 lg:text-lg">
           Sketch, brainstorm, and co-create ideas visually with your team. Share links, invite collaborators, and draw together seamlessly in themed rooms.
          </p>
          
        </div>
      </div>
      <canvas
        className="bg-skin-base pointer-events-none absolute inset-0 mx-auto"
        id="canvas"
      ></canvas>
    </section>
  );
};
