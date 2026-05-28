/**
 * MERIDIAN — MBank Corporate CLM
 * Geometric logo mark: globe with meridian arc
 */

interface MeridianLogoMarkProps {
  size?: number;
  /** Color of strokes. Defaults to MBank gold */
  color?: string;
}

export function MeridianLogoMark({
  size = 32,
  color = "#C6903A",
}: MeridianLogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MERIDIAN logo"
    >
      {/* Outer circle — the globe */}
      <circle cx="16" cy="16" r="12.5" stroke={color} strokeWidth="1.6" />

      {/* Vertical meridian arc (prime meridian) */}
      <ellipse
        cx="16"
        cy="16"
        rx="5.5"
        ry="12.5"
        stroke={color}
        strokeWidth="1.2"
      />

      {/* Equator line */}
      <line
        x1="3.5"
        y1="16"
        x2="28.5"
        y2="16"
        stroke={color}
        strokeWidth="1.2"
      />

      {/* Upper tropic tick */}
      <line
        x1="5.5"
        y1="10"
        x2="26.5"
        y2="10"
        stroke={color}
        strokeWidth="0.8"
        strokeDasharray="1 2"
      />

      {/* Lower tropic tick */}
      <line
        x1="5.5"
        y1="22"
        x2="26.5"
        y2="22"
        stroke={color}
        strokeWidth="0.8"
        strokeDasharray="1 2"
      />

      {/* Center north pole dot */}
      <circle cx="16" cy="3.5" r="1.5" fill={color} />
      {/* Center south pole dot */}
      <circle cx="16" cy="28.5" r="1.5" fill={color} />
    </svg>
  );
}

interface MeridianWordmarkProps {
  /** "full" = icon + MERIDIAN + MBank CLM, "compact" = icon + MERIDIAN */
  variant?: "full" | "compact" | "icon-only";
  size?: "sm" | "md" | "lg";
}

export function MeridianWordmark({
  variant = "full",
  size = "md",
}: MeridianWordmarkProps) {
  const iconSize = size === "sm" ? 24 : size === "lg" ? 48 : 32;
  const titleSize = size === "sm" ? "text-xs" : size === "lg" ? "text-xl" : "text-sm";
  const subSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  if (variant === "icon-only") {
    return <MeridianLogoMark size={iconSize} />;
  }

  return (
    <div className="flex items-center gap-2.5">
      <MeridianLogoMark size={iconSize} />
      <div className="leading-tight">
        <div
          className={`font-bold tracking-[0.12em] uppercase ${titleSize}`}
          style={{ color: "#C6903A", letterSpacing: "0.14em" }}
        >
          MERIDIAN
        </div>
        {variant === "full" && (
          <div
            className={`${subSize} tracking-wider uppercase`}
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            MBank · CLM
          </div>
        )}
      </div>
    </div>
  );
}
