import React from 'react';
import { cn } from '../../lib/utils';
import { useFloating, offset, shift, flip } from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

interface HUDPanelProps {
  anchor: React.RefObject<HTMLElement>;
  open: boolean;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const HUDPanel: React.FC<HUDPanelProps> = ({
  anchor,
  open,
  onClose,
  children,
  className
}) => {
  const { refs, floatingStyles } = useFloating({
    placement: 'right-start',
    middleware: [offset(12), flip(), shift({ padding: 8 })]
  });

  React.useEffect(() => {
    if (anchor.current) {
      refs.setReference(anchor.current);
    }
  }, [anchor, refs]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={refs.setFloating}
          style={floatingStyles}
          className={cn(
            "w-64 rounded-2xl bg-background/80 shadow-xl backdrop-blur-lg ring-1 ring-ring transform-gpu perspective-normal translate-z-6",
            className
          )}
          initial={{ opacity: 0, scale: 0.9, rotateX: -6 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          exit={{ opacity: 0, scale: 0.95, rotateX: -4 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HUDPanel;