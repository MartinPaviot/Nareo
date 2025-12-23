'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiEffectProps {
  active: boolean;
  particleCount?: number;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  rotation: number;
  delay: number;
}

const COLORS = ['#F97316', '#22C55E', '#3B82F6', '#EAB308', '#EC4899', '#8B5CF6'];

export default function ConfettiEffect({ active, particleCount = 50 }: ConfettiEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [active, particleCount]);

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{
                x: `${particle.x}vw`,
                y: -20,
                rotate: particle.rotation,
                opacity: 1,
              }}
              animate={{
                y: '110vh',
                rotate: particle.rotation + 360,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: particle.delay,
                ease: 'linear',
              }}
              className="absolute w-3 h-3 rounded-sm"
              style={{ backgroundColor: particle.color }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
