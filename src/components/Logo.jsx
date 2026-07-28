/** Receptix mark — a signal arc over a desk bell, drawn as one sea-blue glyph. */
export default function Logo({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="brand-logo"
    >
      <defs>
        <linearGradient id="rx-logo" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="9"
        stroke="url(#rx-logo)"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <path
        d="M9 21.5h14"
        stroke="url(#rx-logo)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 21.5a5 5 0 0 1 10 0"
        stroke="url(#rx-logo)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="10.5" r="1.9" fill="url(#rx-logo)" />
      <path
        d="M20.6 7.4a6.5 6.5 0 0 1 0 6.2M11.4 7.4a6.5 6.5 0 0 0 0 6.2"
        stroke="url(#rx-logo)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
