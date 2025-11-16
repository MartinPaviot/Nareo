'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface PointsAnimationProps {
  points: number;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  tx: number;
  ty: number;
  delay: number;
}

export default function PointsAnimation({ points, onComplete }: PointsAnimationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate 10 star particles in a burst pattern
    const newParticles: Particle[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const distance = 120 + Math.random() * 40;
      newParticles.push({
        id: i,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        delay: i * 0.05,
      });
    }
    setParticles(newParticles);

    // Start fade out after 1.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);

    // Call onComplete after fade animation completes
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        animation: !isVisible ? 'celebrationFadeOut 0.5s ease-out forwards' : 'none',
      }}
    >
      {/* Celebration Container */}
      <div className="relative flex items-center justify-center">
        {/* Glowing Green Pulse Background */}
        <div
          className="absolute w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, rgba(34, 197, 94, 0) 70%)',
            animation: 'glowPulse 1.2s ease-out',
            filter: 'blur(20px)',
          }}
        />

        {/* Star Particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute text-yellow-400 text-4xl pointer-events-none"
            style={{
              animation: `starBurst 0.8s ease-out forwards`,
              animationDelay: `${particle.delay}s`,
              // @ts-ignore - CSS custom properties
              '--tx': `${particle.tx}px`,
              '--ty': `${particle.ty}px`,
            }}
          >
            ⭐
          </div>
        ))}

        {/* Main Content Container */}
        <div className="relative flex flex-col items-center gap-4">
          {/* Score Display - Above Mascot */}
          <div
            className="relative z-10"
            style={{
              animation: 'scorePopOut 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s backwards',
            }}
          >
            <div className="bg-gradient-to-br from-green-400 to-green-600 text-white px-8 py-4 rounded-2xl shadow-2xl">
              <div className="text-6xl font-black tracking-tight">
                +{points}
              </div>
              <div className="text-lg font-bold text-green-50 text-center mt-1">
                Points! 🎉
              </div>
            </div>
          </div>

          {/* Happy Mascot - Sliding from Left with Squash & Stretch */}
          <div
            className="relative w-40 h-40"
            style={{
              animation: 'slideInSquash 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            <Image
              src="/chat/Happy.png"
              alt="Aristo Happy"
              fill
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* Additional Sparkle Effects */}
        <div
          className="absolute text-6xl"
          style={{
            top: '-40px',
            left: '-40px',
            animation: 'starBurst 0.8s ease-out forwards',
            animationDelay: '0.1s',
            // @ts-ignore
            '--tx': '-60px',
            '--ty': '-60px',
          }}
        >
          ✨
        </div>
        <div
          className="absolute text-6xl"
          style={{
            top: '-40px',
            right: '-40px',
            animation: 'starBurst 0.8s ease-out forwards',
            animationDelay: '0.15s',
            // @ts-ignore
            '--tx': '60px',
            '--ty': '-60px',
          }}
        >
          💫
        </div>
        <div
          className="absolute text-6xl"
          style={{
            bottom: '-40px',
            left: '-40px',
            animation: 'starBurst 0.8s ease-out forwards',
            animationDelay: '0.2s',
            // @ts-ignore
            '--tx': '-60px',
            '--ty': '60px',
          }}
        >
          🌟
        </div>
        <div
          className="absolute text-6xl"
          style={{
            bottom: '-40px',
            right: '-40px',
            animation: 'starBurst 0.8s ease-out forwards',
            animationDelay: '0.25s',
            // @ts-ignore
            '--tx': '60px',
            '--ty': '60px',
          }}
        >
          ⚡
        </div>
      </div>
    </div>
  );
}
