import { OlarApp } from "@/components/olar/OlarApp";
import { StudioLayout } from "@/components/olar/StudioLayout";

/**
 * Root entry — StudioLayout hydrates / persists `one_loop_active_campaign`
 * so home, studio, and "הדף שלי" share the same durable campaign store.
 */
export default function HomePage() {
  return (
    <StudioLayout>
      <OlarApp />
    </StudioLayout>
  );
}
