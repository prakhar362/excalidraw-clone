import { ShimmerButton } from "@/components/ui/shimmer-button";
// Assuming DottedGlowBackground is in your components folder
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background"; 
import { ArrowRight } from "dicons";

function Cta() {
  return (
    <div className="relative overflow-hidden border-t border-neutral-200 dark:border-neutral-800">
      {/* Background with Grey Dots */}
      <DottedGlowBackground
        className="pointer-events-none mask-radial-to-90% mask-radial-at-center opacity-20 dark:opacity-100"
        opacity={1}
        gap={10}
        radius={4.6}
        colorLightVar="--color-neutral-500"
        glowColorLightVar="--color-neutral-600"
        colorDarkVar="--color-neutral-500"
        glowColorDarkVar="--color-neutral-800"
        backgroundOpacity={20}
        speedMin={0.3}
        speedMax={1.6}
        speedScale={1}
      />

      <div className="relative z-10 flex w-full flex-col items-center justify-between space-y-8 px-8 py-30 text-center md:flex-row md:space-y-0 md:text-left max-w-7xl mx-auto">
        <div>
          <h2 className="text-4xl font-normal tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-400">
            Take control of your Design Journey <br />
            <span className="font-bold text-black dark:text-white">Start Sketching Together — Instantly</span>
          </h2>
          <p className="mt-4 max-w-lg text-base text-neutral-600 dark:text-neutral-300">
            Create a shared whiteboard in seconds and invite others with a single link. No setup, no downloads—just real-time collaboration that works the moment you open it.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row items-center">

          {/* Primary CTA - Shimmer Button */}
          <ShimmerButton className="shadow-2xl h-12">
            <span className="whitespace-pre-wrap text-center text-sm font-semibold leading-none tracking-tight text-white lg:text-base">
              Get Started Now 
            </span>
          </ShimmerButton>
        </div>
      </div>
    </div>
  );
}

export default Cta;