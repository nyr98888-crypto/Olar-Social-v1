import { OlarApp } from "@/components/olar/OlarApp";
import { StudioLayout } from "@/components/olar/StudioLayout";

/**
 * Studio route — hydrates `one_loop_active_campaign` into the left preview card.
 */
export default function StudioPage() {
  return (
    <StudioLayout>
      <OlarApp initialView="studio" />
    </StudioLayout>
  );
}
