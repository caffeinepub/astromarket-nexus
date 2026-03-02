import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useAppStore } from "../store/useAppStore";
import {
  ASPECT_COLORS,
  J2000_UNIX,
  ORBITAL_PERIODS,
  PLANET_COLORS,
  SEMI_MAJOR_AXES,
  computeAspects,
  getPlanetaryPositions,
} from "../utils/astroCalc";

// Planet visual configs (display scale, not realistic)
const PLANET_DISPLAY = {
  Sun: { radius: 2.5, color: "#FFD700", emissive: "#FF8C00", ring: false },
  Mercury: { radius: 0.12, color: "#B5B5B5", emissive: "#444444", ring: false },
  Venus: { radius: 0.28, color: "#E8C070", emissive: "#8B6A30", ring: false },
  Earth: { radius: 0.3, color: "#4A90D9", emissive: "#1A4060", ring: false },
  Mars: { radius: 0.22, color: "#E05A30", emissive: "#702010", ring: false },
  Jupiter: { radius: 0.9, color: "#C88060", emissive: "#503020", ring: false },
  Saturn: { radius: 0.7, color: "#D4AA70", emissive: "#6A5030", ring: true },
  Uranus: { radius: 0.45, color: "#7FCFC0", emissive: "#304040", ring: false },
  Neptune: { radius: 0.4, color: "#5080C8", emissive: "#203060", ring: false },
  Pluto: { radius: 0.1, color: "#9B8060", emissive: "#3A3020", ring: false },
};

// Display scale for orbital radii (not AU)
const DISPLAY_SCALE = 8;

function getDisplayOrbitRadius(body: string): number {
  if (body === "Sun") return 0;
  const sma = SEMI_MAJOR_AXES[body] ?? 1;
  // Compress the scale so all planets fit
  return sma ** 0.5 * DISPLAY_SCALE;
}

function getDisplayPosition(
  body: string,
  timestamp: number,
): [number, number, number] {
  if (body === "Sun") return [0, 0, 0];

  const period = ORBITAL_PERIODS[body];
  const daysSinceJ2000 = (timestamp - J2000_UNIX) / 86400;
  const positions = getPlanetaryPositions(timestamp);
  const lonDeg = positions[body]?.longitude ?? 0;
  const lat = positions[body]?.latitude ?? 0;

  const r = getDisplayOrbitRadius(body);
  const lonRad = (lonDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  // Special case: Moon orbits Earth
  if (body === "Moon") {
    const earthPos = getDisplayPosition("Earth", timestamp);
    const moonR = 0.8;
    return [
      earthPos[0] + moonR * Math.cos(lonRad),
      moonR * Math.sin(latRad) * 0.3,
      earthPos[2] + moonR * Math.sin(lonRad),
    ];
  }

  // Unused variable cleanup
  void period;
  void daysSinceJ2000;

  return [
    r * Math.cos(lonRad),
    r * Math.sin(latRad) * 0.1,
    r * Math.sin(lonRad),
  ];
}

interface PlanetMeshProps {
  body: string;
  timestamp: number;
  showLabel: boolean;
}

function PlanetMesh({ body, timestamp, showLabel }: PlanetMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const config = PLANET_DISPLAY[body as keyof typeof PLANET_DISPLAY];

  const pos = getDisplayPosition(body, timestamp);
  const isRetrograde = false; // simplified

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.001;
    }
  });

  if (!config) return null;

  return (
    <group position={pos}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[config.radius, 32, 32]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.emissive}
          emissiveIntensity={body === "Sun" ? 0.8 : 0.2}
          roughness={0.7}
          metalness={body === "Mercury" || body === "Moon" ? 0.3 : 0.1}
        />
      </mesh>

      {/* Saturn rings */}
      {config.ring && (
        <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry
            args={[config.radius * 1.8, config.radius * 0.3, 2, 64]}
          />
          <meshStandardMaterial
            color="#C8A87A"
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Sun glow */}
      {body === "Sun" && (
        <>
          <pointLight
            color="#FFF4D0"
            intensity={100}
            distance={200}
            decay={2}
          />
          <mesh>
            <sphereGeometry args={[config.radius * 1.3, 16, 16]} />
            <meshStandardMaterial
              color="#FFD700"
              transparent
              opacity={0.15}
              emissive="#FF8000"
              emissiveIntensity={0.5}
            />
          </mesh>
        </>
      )}

      {/* Label */}
      {showLabel && body !== "Sun" && (
        <Html
          distanceFactor={15}
          position={[0, config.radius + 0.3, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "9px",
              color: PLANET_COLORS[body] ?? "#aaa",
              whiteSpace: "nowrap",
              textShadow: `0 0 6px ${PLANET_COLORS[body] ?? "#aaa"}`,
              background: "rgba(10,12,20,0.6)",
              padding: "1px 4px",
              borderRadius: "3px",
              border: `1px solid ${PLANET_COLORS[body] ?? "#aaa"}30`,
            }}
          >
            {body}
            {isRetrograde && (
              <span style={{ color: "#F87171", marginLeft: "2px" }}>℞</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

interface OrbitLineProps {
  body: string;
}

function OrbitLine({ body }: OrbitLineProps) {
  const r = getDisplayOrbitRadius(body);

  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      pts.push([r * Math.cos(angle), 0, r * Math.sin(angle)]);
    }
    return pts;
  }, [r]);

  if (r === 0) return null;

  return (
    <Line
      points={points}
      color={body === "Moon" ? "#555566" : "#2A3050"}
      lineWidth={0.5}
      transparent
      opacity={0.4}
    />
  );
}

interface AspectLinesProps {
  timestamp: number;
  showAspects: boolean;
}

function AspectLines({ timestamp, showAspects }: AspectLinesProps) {
  if (!showAspects) return null;
  const aspects = computeAspects(timestamp);

  return (
    <>
      {aspects.slice(0, 12).map((aspect, i) => {
        const pos1 = getDisplayPosition(aspect.body1, timestamp);
        const pos2 = getDisplayPosition(aspect.body2, timestamp);
        const color = ASPECT_COLORS[aspect.aspectType] ?? "#888";

        return (
          <Line
            key={`${aspect.body1}-${aspect.body2}-${i}`}
            points={[pos1, pos2]}
            color={color}
            lineWidth={0.8}
            transparent
            opacity={0.35}
          />
        );
      })}
    </>
  );
}

interface SceneProps {
  timestamp: number;
  showOrbitLines: boolean;
  showLabels: boolean;
  showAspects: boolean;
}

function Scene({
  timestamp,
  showOrbitLines,
  showLabels,
  showAspects,
}: SceneProps) {
  const planets = [
    "Sun",
    "Mercury",
    "Venus",
    "Earth",
    "Moon",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
  ];

  return (
    <>
      <ambientLight intensity={0.05} />
      <Stars
        radius={200}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      {/* Orbit lines */}
      {showOrbitLines &&
        planets.map(
          (body) =>
            body !== "Sun" &&
            body !== "Moon" && <OrbitLine key={body} body={body} />,
        )}

      {/* Planets */}
      {planets.map((body) => (
        <PlanetMesh
          key={body}
          body={body}
          timestamp={timestamp}
          showLabel={showLabels}
        />
      ))}

      {/* Aspect lines */}
      <AspectLines timestamp={timestamp} showAspects={showAspects} />

      {/* Earth axial tilt indicator */}
      {(() => {
        const earthPos = getDisplayPosition("Earth", timestamp);
        const tiltRad = (23.5 * Math.PI) / 180;
        const lineEnd: [number, number, number] = [
          earthPos[0] + Math.sin(tiltRad) * 0.6,
          earthPos[1] + Math.cos(tiltRad) * 0.6,
          earthPos[2],
        ];
        return (
          <Line
            points={[earthPos, lineEnd]}
            color="#60A5FA"
            lineWidth={1}
            transparent
            opacity={0.5}
          />
        );
      })()}
    </>
  );
}

function ControlsRef({ resetFn }: { resetFn: (fn: () => void) => void }) {
  const ref = useRef<any>(null);
  resetFn(() => {
    if (ref.current) {
      ref.current.reset();
    }
  });
  return <OrbitControls ref={ref} enableDamping dampingFactor={0.08} />;
}

export function SolarSystem3D() {
  const { selectedTimestamp } = useAppStore();
  const [showOrbitLines, setShowOrbitLines] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showAspects, setShowAspects] = useState(false);
  const [resetFn, setResetFn] = useState<(() => void) | null>(null);

  const registerReset = (fn: () => void) => {
    setResetFn(() => fn);
  };

  return (
    <div className="relative h-full w-full">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 25, 35], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene
          timestamp={selectedTimestamp}
          showOrbitLines={showOrbitLines}
          showLabels={showLabels}
          showAspects={showAspects}
        />
        <ControlsRef resetFn={registerReset} />
      </Canvas>

      {/* Controls overlay */}
      <div
        className="absolute top-4 right-4 glass rounded-xl p-4 border border-border/40 
          space-y-3 min-w-[180px]"
      >
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Display
        </h3>

        <div className="flex items-center gap-2">
          <Switch
            id="orbit-lines"
            checked={showOrbitLines}
            onCheckedChange={setShowOrbitLines}
            data-ocid="solar.orbit_lines.toggle"
            className="scale-75"
          />
          <Label
            htmlFor="orbit-lines"
            className="font-mono text-xs text-foreground cursor-pointer"
          >
            Orbit Lines
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="labels"
            checked={showLabels}
            onCheckedChange={setShowLabels}
            data-ocid="solar.labels.toggle"
            className="scale-75"
          />
          <Label
            htmlFor="labels"
            className="font-mono text-xs text-foreground cursor-pointer"
          >
            Labels
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="aspects"
            checked={showAspects}
            onCheckedChange={setShowAspects}
            data-ocid="solar.aspects.toggle"
            className="scale-75"
          />
          <Label
            htmlFor="aspects"
            className="font-mono text-xs text-foreground cursor-pointer"
          >
            Aspect Lines
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => resetFn?.()}
          className="w-full font-mono text-xs border-border/50 hover:border-neon-blue hover:text-neon-blue"
          data-ocid="solar.reset_camera.button"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset Camera
        </Button>
      </div>

      {/* Planet key */}
      <div className="absolute bottom-4 left-4 glass rounded-xl p-3 border border-border/40">
        <h3 className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">
          Planets
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(PLANET_COLORS)
            .filter(([b]) => b !== "Earth")
            .map(([body, color]) => (
              <div key={body} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-mono text-[9px] text-muted-foreground">
                  {body}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
