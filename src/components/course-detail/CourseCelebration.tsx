import { useEffect, useRef, useState, useCallback } from "react";
import { EASE_OUT } from "@/lib/constants";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "rect" | "circle";
}

const PARTICLE_COUNT = 80;
const GRAVITY = 0.15;
const FRICTION = 0.99;
const FADE_START = 0.7; // start fading at 70% of lifetime

const COLORS = [
  "#C8F135", // primary lime
  "#5B9CF6", // info blue
  "#FF6B6B", // destructive red
  "#EDEDED", // foreground white
  "#A8E620", // darker lime
  "#7DC4FF", // lighter blue
  "#FFD93D", // gold
];

function createParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 8 + Math.random() * 12;
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      y: height * 0.5,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
      vy: Math.sin(angle) * speed - Math.random() * 4,
      size: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      opacity: 1,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    });
  }
  return particles;
}

interface CourseCelebrationProps {
  show: boolean;
  onDone: () => void;
}

export function CourseCelebration({ show, onDone }: CourseCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [textVisible, setTextVisible] = useState(false);

  const DURATION = 3000; // total animation duration in ms

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const elapsed = Date.now() - startTimeRef.current;
    const progress = Math.min(elapsed / DURATION, 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    let aliveCount = 0;

    for (const p of particles) {
      p.vy += GRAVITY;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (progress > FADE_START) {
        p.opacity = Math.max(0, 1 - (progress - FADE_START) / (1 - FADE_START));
      }

      if (p.opacity <= 0) continue;
      aliveCount++;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    if (progress < 1 && aliveCount > 0) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Animation done, start fade out
      setTimeout(() => {
        setVisible(false);
        setTextVisible(false);
        setTimeout(onDone, 400);
      }, 200);
    }
  }, [onDone]);

  useEffect(() => {
    if (!show) return;

    setVisible(true);
    setTimeout(() => setTextVisible(true), 200);

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesRef.current = createParticles(canvas.width, canvas.height);
    startTimeRef.current = Date.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [show, animate]);

  if (!show && !visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity 400ms ${EASE_OUT}`,
      }}
    >
      <div
        className="absolute inset-0 bg-background/40"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity 500ms ${EASE_OUT}`,
        }}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />

      <div
        className="relative flex flex-col items-center gap-2"
        style={{
          opacity: textVisible ? 1 : 0,
          transform: textVisible ? "scale(1) translateY(0)" : "scale(0.9) translateY(12px)",
          transition: `opacity 500ms ${EASE_OUT}, transform 500ms ${EASE_OUT}`,
        }}
      >
        <h2 className="font-heading text-3xl font-bold text-foreground">
          Course Complete!
        </h2>
        <p className="font-sans text-sm text-muted-foreground">
          Congratulations on finishing the course
        </p>
      </div>
    </div>
  );
}
