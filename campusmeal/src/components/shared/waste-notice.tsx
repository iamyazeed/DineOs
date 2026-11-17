import { Notice } from "@/components/ui/primitives";

/** Food-waste figures are not recorded anywhere in the MVP, so we say so rather than invent them. */
export function WasteNotAvailable() {
  return (
    <Notice tone="warn">
      <strong>Food waste data is not available.</strong> CampusMeal does not record leftover or waste quantities (by design, the chef dashboard has no waste
      workflow). The closest real indicator shown here is <em>avoided preparation</em>: portions not cooked because students cancelled or were reported
      absent before the meal. Measured waste analytics are on the roadmap.
    </Notice>
  );
}
