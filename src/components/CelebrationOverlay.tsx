import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CelebrationOverlayProps {
  /** Millis since epoch when the celebration started. 0 = no celebration. */
  startedAt: number;
  onDismiss: () => void;
}

const DURATION_MS = 2000;

/**
 * Full-screen celebration overlay shown briefly when a timer completes.
 *
 * Auto-dismisses after {@link DURATION_MS}. Respects `prefers-reduced-motion`
 * by skipping the scale/pulse animation and showing only a static message.
 */
export function CelebrationOverlay({
  startedAt,
  onDismiss,
}: CelebrationOverlayProps) {
  const [reduced, setReduced] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
                ? {}
                : {
                    scale: [1, 1.15, 1],
                    opacity: [0.6, 1, 0],
                  }
            }
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
          <motion.span
            className="tk-celebration__text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            ¡Listo!
          </motion.span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
