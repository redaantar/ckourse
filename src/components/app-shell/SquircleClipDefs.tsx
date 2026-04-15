export function SquircleClipDefs() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <clipPath id="squircle" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0 C 0.82,0 0.95,0 0.975,0.025 C 1,0.05 1,0.18 1,0.5 C 1,0.82 1,0.95 0.975,0.975 C 0.95,1 0.82,1 0.5,1 C 0.18,1 0.05,1 0.025,0.975 C 0,0.95 0,0.82 0,0.5 C 0,0.18 0,0.05 0.025,0.025 C 0.05,0 0.18,0 0.5,0 Z" />
        </clipPath>
        <clipPath id="squircle-subtle" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0 C 0.9,0 0.97,0 0.985,0.015 C 1,0.03 1,0.1 1,0.5 C 1,0.9 1,0.97 0.985,0.985 C 0.97,1 0.9,1 0.5,1 C 0.1,1 0.03,1 0.015,0.985 C 0,0.97 0,0.9 0,0.5 C 0,0.1 0,0.03 0.015,0.015 C 0.03,0 0.1,0 0.5,0 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
