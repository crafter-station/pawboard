"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSwitcherToggle } from "@/components/elements/theme-switcher-toggle";
import { generateSessionId } from "@/lib/nanoid";
import { CrafterStationLogo } from "@/components/logos/crafter-station";
import { MoralejaDesignLogo } from "@/components/logos/moraleja-design";
import { KeboLogo } from "@/components/logos/kebo";
import { SupabaseLogo } from "@/components/logos/supabase";
import { GithubBadge } from "@/components/github-badge";
import { ImageMouseTrail } from "@/components/image-mouse-trail";
import { PawboardHero } from "@/components/pawboard-hero";
import { useCatSound } from "@/hooks/use-cat-sound";
import { ArrowRight } from "lucide-react";

const cursorImages = [
  "/paw-cursor-black.png",
  "/paw-cursor-green.png",
  "/paw-cursor-orange.png",
  "/paw-cursor-purple.png",
  "/paw-cursor-white.png",
  "/paw-cursor-yellow.png",
  "/paw-cursor-black.png",
  "/paw-cursor-green.png",
  "/paw-cursor-orange.png",
  "/paw-cursor-purple.png",
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface CatConfig {
  id: string;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  setter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
}

const getResponsivePositions = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centerX = vw / 2;
  const centerY = vh / 2;
  
  const isMobile = vw < 640;
  const catSize = isMobile ? 70 : 160;
  
  let positions;
  let startPositions;
  
  if (isMobile) {
    // Position cats in corners on mobile to avoid hero overlap
    const padding = 10;
    const topY = padding;
    const bottomY = vh - catSize - padding;
    
    positions = {
      blue: { x: padding, y: topY },
      purple: { x: padding, y: bottomY },
      yellow: { x: vw - catSize - padding, y: topY },
      green: { x: vw - catSize - padding, y: bottomY },
    };
    startPositions = {
      blue: { x: -150, y: topY },
      purple: { x: -150, y: bottomY },
      yellow: { x: vw + 150, y: topY },
      green: { x: vw + 150, y: bottomY },
    };
  } else {
    const baseOffset = Math.min(vw * 0.22, 280);
    const verticalOffset = 180;
    
    positions = {
      blue: { x: centerX - baseOffset - catSize / 2, y: centerY - verticalOffset },
      purple: { x: centerX - baseOffset - catSize / 2, y: centerY + verticalOffset / 2 },
      yellow: { x: centerX + baseOffset - catSize / 2, y: centerY - verticalOffset },
      green: { x: centerX + baseOffset - catSize / 2, y: centerY + verticalOffset / 2 },
    };
    startPositions = {
      blue: { x: -200, y: centerY - verticalOffset },
      purple: { x: -200, y: centerY + verticalOffset / 2 },
      yellow: { x: vw + 200, y: centerY - verticalOffset },
      green: { x: vw + 200, y: centerY + verticalOffset / 2 },
    };
  }
  
  return { positions, startPositions, isMobile, catSize };
};

export default function Home() {
  const router = useRouter();
  const playSound = useCatSound();
  const [sessionId, setSessionId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const [animationPhase, setAnimationPhase] = useState<'animating' | 'complete'>('animating');
  const animationPhaseRef = useRef<'animating' | 'complete'>('animating');
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [showCursor, setShowCursor] = useState(true);
  const [activeCat, setActiveCat] = useState(-1);
  const [isMobile, setIsMobile] = useState(false);
  
  const [catBluePos, setCatBluePos] = useState({ x: -200, y: -200 });
  const [catPurplePos, setCatPurplePos] = useState({ x: -200, y: -200 });
  const [catYellowPos, setCatYellowPos] = useState({ x: -200, y: -200 });
  const [catGreenPos, setCatGreenPos] = useState({ x: -200, y: -200 });
  
  const finalPositionsRef = useRef<{ blue: { x: number; y: number }; purple: { x: number; y: number }; yellow: { x: number; y: number }; green: { x: number; y: number } }>({
    blue: { x: 0, y: 0 },
    purple: { x: 0, y: 0 },
    yellow: { x: 0, y: 0 },
    green: { x: 0, y: 0 },
  });

  useEffect(() => {
    animationPhaseRef.current = animationPhase;
  }, [animationPhase]);
  
  useEffect(() => {
    const { positions, startPositions, isMobile: mobile } = getResponsivePositions();
    setIsMobile(mobile);
    
    finalPositionsRef.current = positions;
    
    const cats: CatConfig[] = [
      { id: 'blue', startPos: startPositions.blue, endPos: positions.blue, setter: setCatBluePos },
      { id: 'purple', startPos: startPositions.purple, endPos: positions.purple, setter: setCatPurplePos },
      { id: 'yellow', startPos: startPositions.yellow, endPos: positions.yellow, setter: setCatYellowPos },
      { id: 'green', startPos: startPositions.green, endPos: positions.green, setter: setCatGreenPos },
    ];
    
    const animateCat = (cat: CatConfig, duration: number): Promise<void> => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        const { startPos, endPos, setter } = cat;
        const currentMobile = window.innerWidth < 640;
        const cursorOffset = currentMobile ? 30 : 60;
        
        setter(startPos);
        setCursorPos({ x: startPos.x + cursorOffset, y: startPos.y + cursorOffset });
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutCubic(progress);
          
          const newX = startPos.x + (endPos.x - startPos.x) * easedProgress;
          const newY = startPos.y + (endPos.y - startPos.y) * easedProgress;
          
          setter({ x: newX, y: newY });
          setCursorPos({ x: newX + cursorOffset, y: newY + cursorOffset });
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        };
        
        requestAnimationFrame(animate);
      });
    };
    
    const runAnimation = async () => {
      await new Promise(r => setTimeout(r, 300));
      
      for (let i = 0; i < cats.length; i++) {
        setActiveCat(i);
        await animateCat(cats[i], 600);
        await new Promise(r => setTimeout(r, 100));
      }
      
      setShowCursor(false);
      setAnimationPhase('complete');
      setActiveCat(-1);
    };
    
    runAnimation();
    
    const handleResize = () => {
      if (animationPhaseRef.current === 'complete') {
        const { positions, isMobile: mobile } = getResponsivePositions();
        setIsMobile(mobile);
        setCatBluePos(positions.blue);
        setCatPurplePos(positions.purple);
        setCatYellowPos(positions.yellow);
        setCatGreenPos(positions.green);
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  const catBlueRef = useRef<HTMLDivElement>(null);
  const catPurpleRef = useRef<HTMLDivElement>(null);
  const catYellowRef = useRef<HTMLDivElement>(null);
  const catGreenRef = useRef<HTMLDivElement>(null);
  
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleCreateSession = async () => {
    playSound();
    setIsCreating(true);
    const id = generateSessionId();
    router.push(`/${id}`);
  };

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionId.trim()) {
      playSound();
      router.push(`/${sessionId.trim()}`);
    }
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    catId: string
  ) => {
    if (animationPhase !== 'complete') return;
    e.preventDefault();
    setDragging(catId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;

    const updatePosition = (
      setter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
      ref: React.RefObject<HTMLDivElement | null>
    ) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const x = e.clientX - dragOffsetRef.current.x;
        const y = e.clientY - dragOffsetRef.current.y;
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        setter({
          x: Math.max(0, Math.min(x, maxX)),
          y: Math.max(0, Math.min(y, maxY)),
        });
      }
    };

    if (dragging === "blue") {
      updatePosition(setCatBluePos, catBlueRef);
    } else if (dragging === "purple") {
      updatePosition(setCatPurplePos, catPurpleRef);
    } else if (dragging === "yellow") {
      updatePosition(setCatYellowPos, catYellowRef);
    } else if (dragging === "green") {
      updatePosition(setCatGreenPos, catGreenRef);
    }
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <ImageMouseTrail
      items={cursorImages}
      maxNumberOfImages={6}
      distance={25}
      imgClass="w-8 h-8"
      fadeAnimation
      className="cursor-[url('/paw-cursor-white.png'),_auto]"
    >
      {showCursor && (
        <div
          className="fixed pointer-events-none z-50 transition-opacity duration-300"
          style={{
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
            opacity: cursorPos.x < 0 ? 0 : 1,
          }}
        >
          <Image
            src="/paw-cursor-white.png"
            alt=""
            width={32}
            height={32}
            className="drop-shadow-lg"
          />
        </div>
      )}
      
      <div
        ref={catBlueRef}
        onMouseDown={(e) => handleMouseDown(e, "blue")}
        className={`fixed z-[60] select-none ${
          animationPhase === 'complete' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${activeCat >= 0 || animationPhase === 'complete' ? 'opacity-100' : 'opacity-0'}`}
        style={{
          left: `${catBluePos.x}px`,
          top: `${catBluePos.y}px`,
        }}
      >
        <Image
          src="/cat-blue.svg"
          alt=""
          width={isMobile ? 70 : 160}
          height={isMobile ? 70 : 160}
          className="pointer-events-none"
          draggable={false}
        />
      </div>
      <div
        ref={catPurpleRef}
        onMouseDown={(e) => handleMouseDown(e, "purple")}
        className={`fixed z-[60] select-none ${
          animationPhase === 'complete' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${activeCat >= 1 || animationPhase === 'complete' ? 'opacity-100' : 'opacity-0'}`}
        style={{
          left: `${catPurplePos.x}px`,
          top: `${catPurplePos.y}px`,
        }}
      >
        <Image
          src="/cat-purple.svg"
          alt=""
          width={isMobile ? 70 : 140}
          height={isMobile ? 70 : 140}
          className="pointer-events-none"
          draggable={false}
        />
      </div>
      <div
        ref={catYellowRef}
        onMouseDown={(e) => handleMouseDown(e, "yellow")}
        className={`fixed z-[60] select-none ${
          animationPhase === 'complete' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${activeCat >= 2 || animationPhase === 'complete' ? 'opacity-100' : 'opacity-0'}`}
        style={{
          left: `${catYellowPos.x}px`,
          top: `${catYellowPos.y}px`,
        }}
      >
        <Image
          src="/cat-yellow.svg"
          alt=""
          width={isMobile ? 70 : 150}
          height={isMobile ? 70 : 150}
          className="pointer-events-none"
          draggable={false}
        />
      </div>
      <div
        ref={catGreenRef}
        onMouseDown={(e) => handleMouseDown(e, "green")}
        className={`fixed z-[60] select-none ${
          animationPhase === 'complete' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${activeCat >= 3 || animationPhase === 'complete' ? 'opacity-100' : 'opacity-0'}`}
        style={{
          left: `${catGreenPos.x}px`,
          top: `${catGreenPos.y}px`,
        }}
      >
        <Image
          src="/cat-green.svg"
          alt=""
          width={isMobile ? 70 : 145}
          height={isMobile ? 70 : 145}
          className="pointer-events-none"
          draggable={false}
        />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-50 px-6">
        <div className="flex items-center justify-center gap-3">
          <GithubBadge />
          <div className="bg-card/60 backdrop-blur-sm px-2 py-1 rounded-lg border border-border/50">
            <ThemeSwitcherToggle />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <PawboardHero className="w-full max-w-[320px] sm:max-w-[400px] h-auto" />
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all"
          >
            {isCreating ? (
              "Creating..."
            ) : (
              <>
                Start new session
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          <form onSubmit={handleJoinSession} className="flex gap-2">
            <Input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Session ID"
              className="h-12 rounded-xl bg-card/60 border-border/50 placeholder:text-muted-foreground/50"
            />
            <Button
              type="submit"
              variant="outline"
              className="h-12 px-5 rounded-xl border-border/50 hover:bg-card/80"
            >
              Join
            </Button>
          </form>
        </div>

        <div className="pt-4 flex flex-col items-center gap-3">
          <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">
            Powered by
          </span>
          <div className="flex items-center justify-center gap-6">
            <a
              href="https://crafterstation.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={playSound}
              className="text-muted-foreground/30 hover:text-foreground/50 transition-colors"
            >
              <CrafterStationLogo className="h-4 w-auto" />
            </a>
            <a
              href="https://moraleja.co"
              target="_blank"
              rel="noopener noreferrer"
              onClick={playSound}
              className="text-muted-foreground/30 hover:text-foreground/50 transition-colors"
            >
              <MoralejaDesignLogo className="h-5 w-auto" />
            </a>
            <a
              href="https://kebo.app"
              target="_blank"
              rel="noopener noreferrer"
              onClick={playSound}
              className="text-muted-foreground/30 hover:text-foreground/50 transition-colors"
            >
              <KeboLogo className="h-5 w-auto" />
            </a>
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={playSound}
              className="text-muted-foreground/30 hover:text-foreground/50 transition-colors"
            >
              <SupabaseLogo className="h-5 w-auto" />
            </a>
          </div>
        </div>
      </div>
    </ImageMouseTrail>
  );
}
