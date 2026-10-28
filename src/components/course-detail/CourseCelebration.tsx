import { useEffect, useRef, useState, useCallback } from "react";
import { EASE_OUT, SPRING_BOUNCY } from "@/lib/constants";
import { courseColor } from "@/lib/color";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  /** Spin around the axis facing the viewer */
  rotation: number;
  spin: number;
  /** Phase of the flip around the particle's long axis — paper tumbling, not a spinning coin */
  flip: number;
  flipSpeed: number;
  shape: "rect" | "circle";
}

// Physics in CSS px and seconds, integrated against real elapsed time — so the
// fall is identical on a 60Hz panel and a 120Hz ProMotion one.
const PARTICLE_COUNT = 90;
const GRAVITY = 1400; // px/s²
const DRAG = 2.2; // 1/s — paper is mostly air resistance; this is what makes it float
const DURATION = 2800; // ms
const FADE_START = 0.7;

const BRAND_LIME = "#CDF426";
const PAPER_WHITE = "#F5F5F7";

/** The course's own color, the brand lime and white — the course is the hero here. */
function palette(accentColor?: string): string[] {
  const accent = accentColor ? courseColor(accentColor) : "#64B5FF";
  return [accent, accent, BRAND_LIME, BRAND_LIME, PAPER_WHITE];
}

function createParticles(width: number, height: number, colors: string[]): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.7;
    const speed = 700 + Math.random() * 650;
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * width * 0.25,
      y: height * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 8,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 6 + Math.random() * 10,
      shape: Math.random() > 0.35 ? "rect" : "circle",
    });
  }
  return particles;
}

interface CourseCelebrationProps {
  show: boolean;
  onDone: () => void;
  title?: string;
  accentColor?: string;
}

export function CourseCelebration({ show, onDone, title, accentColor }: CourseCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const startRef = useRef(0);
  const lastRef = useRef(0);
  const [visible, setVisible] = useState(false);

  const finish = useCallback(() => {
    setVisible(false);
    setTimeout(onDone, 400);
  }, [onDone]);

  const animate = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      // Clamp dt so a backgrounded tab doesn't teleport everything on return
      const dt = Math.min((now - lastRef.current) / 1000, 1 / 30);
      lastRef.current = now;
      const progress = Math.min((now - startRef.current) / DURATION, 1);
      const fade = progress > FADE_START ? 1 - (progress - FADE_START) / (1 - FADE_START) : 1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        // Linear drag: v' = g - k·v. Terminal velocity ≈ g/k, about 640px/s
        p.vx += -DRAG * p.vx * dt;
        p.vy += (GRAVITY - DRAG * p.vy) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        p.flip += p.flipSpeed * dt;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          // Foreshortening as the strip tumbles: it thins to an edge and widens again
          ctx.scale(1, Math.cos(p.flip));
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        finish();
      }
    },
    [finish],
  );

  useEffect(() => {
    if (!show) return;
    setVisible(true);

    // Reduced motion: the words stay, the flying paper doesn't
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(finish, 2200);
      return () => clearTimeout(id);
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Draw at device resolution so confetti edges stay crisp on Retina
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    particlesRef.current = createParticles(window.innerWidth, window.innerHeight, palette(accentColor));
    startRef.current = lastRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [show, animate, finish, accentColor]);

  if (!show && !visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={{ opacity: visible ? 1 : 0, transition: `opacity 400ms ${EASE_OUT}` }}
    >
      <div className="absolute inset-0 bg-background/70" />

      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />

      <div
        className="relative flex max-w-md flex-col items-center gap-2 px-6 text-center"
        role="status"
        aria-live="polite"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "none" : "scale(0.92) translateY(12px)",
          transition: `opacity 400ms ${EASE_OUT} 150ms, transform ${SPRING_BOUNCY} 150ms`,
        }}
      >
        <p className="font-sans text-sm font-medium text-primary">Course complete</p>
        <h2 className="line-clamp-2 font-heading text-3xl font-semibold text-foreground">
          {title ?? "You finished it"}
        </h2>
        <p className="font-sans text-sm text-muted-foreground">
          Every lesson, start to finish. That one's yours now.
        </p>
      </div>
    </div>
  );
}
