import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { copy } from "@/copy";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface CelebrationOverlayProps {
  /** Millis since epoch when the celebration started. 0 = no celebration. */
  startedAt: number;
  /** Line shown under the ring — the session's own closing message. */
  message?: string;
  onDismiss: () => void;
}

const DURATION_MS = 2000;

/**
 * Brief full-screen celebration shown when a session reaches zero.
 *
 * Auto-dismisses after {@link DURATION_MS}. With `prefers-reduced-motion` it
 * fades instead of pulsing — the moment still lands, without the movement.
 */
export function CelebrationOverlay({
  startedAt,
  message,
  onDismiss,
}: CelebrationOverlayProps) {
  const reduced = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (startedAt > 0) {
      timerRef.current = setTimeout(onDismiss, DURATION_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startedAt, onDismiss]);

  return (
    <AnimatePresence>
      {startedAt > 0 ? (
        <motion.div
          aria-hidden="true"
          className="tk-celebration"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <motion.div
            className="tk-celebration__ring"
            animate={
              reduced
                ? { opacity: 0.5 }
                : {
                    scale: [1, 1.15, 1],
                    opacity: [0.6, 1, 0],
                  }
            }
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
          <motion.span
            className="tk-celebration__text"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            {copy.timer.celebration}
          </motion.span>
          {message ? (
            <span className="tk-celebration__message">{message}</span>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
