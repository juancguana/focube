import { copy } from "@/copy";

interface OnboardingOverlayProps {
  onStartTimer: () => void;
}

/**
 * First-visit overlay that shows a hint about the cube controls
 * and a "Probá 25 min" CTA button.
 *
 * Renders nothing after the first interaction — visibility is controlled
 * by the parent based on `hasSeenOnboarding`.
 */
export function OnboardingOverlay({ onStartTimer }: OnboardingOverlayProps) {
  return (
    <div className="tk-onboarding">
      <p className="tk-onboarding__hint">{copy.onboarding.hint}</p>
      <button
        className="tk-onboarding__cta"
        onClick={onStartTimer}
        type="button"
      >
        {copy.onboarding.cta}
      </button>
    </div>
  );
}
