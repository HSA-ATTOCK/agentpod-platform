import { Features } from "@/components/marketing/features";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Trust } from "@/components/marketing/trust";
import { UseCases } from "@/components/marketing/use-cases";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <UseCases />
      <HowItWorks />
      <Trust />
      <FinalCta />
    </>
  );
}
