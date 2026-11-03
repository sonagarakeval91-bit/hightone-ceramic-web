import React from 'react';

interface HightoneBrandLogoProps {
  className?: string;
  variant?: 'stacked' | 'horizontal' | 'symbol';
}

export const HightoneBrandLogo: React.FC<HightoneBrandLogoProps> = ({
  className = 'h-20 w-auto',
  variant = 'stacked'
}) => {
  if (variant === 'symbol') {
    return (
      <svg
        viewBox="0 0 200 210"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <linearGradient id="htDiamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="45%" stopColor="#4F46E5" />
            <stop offset="75%" stopColor="#9333EA" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
          <radialGradient id="htShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft ground shadow */}
        <ellipse cx="100" cy="198" rx="65" ry="3.5" fill="url(#htShadow)" />

        {/* Rotated Diamond Base */}
        <g transform="translate(100, 95) rotate(45)">
          {/* Main outer diamond with rounded corners */}
          <rect
            x="-56"
            y="-56"
            width="112"
            height="112"
            rx="16"
            fill="url(#htDiamondGrad)"
          />
          {/* Negative cutouts forming the stylized "H" */}
          {/* Top-right inner notch */}
          <path
            d="M-22 -56 L20 -56 C26 -56 30 -52 30 -46 L30 -16 C30 -10 26 -6 20 -6 L-8 -6 C-14 -6 -18 -10 -18 -16 L-18 -36 C-18 -42 -22 -46 -28 -46 L-44 -46 C-50 -46 -54 -50 -54 -56 Z"
            fill="white"
          />
          {/* Bottom-left inner notch */}
          <path
            d="M22 56 L-20 56 C-26 56 -30 52 -30 46 L-30 16 C-30 10 -26 6 -20 6 L8 6 C14 6 18 10 18 16 L18 36 C18 42 22 46 28 46 L44 46 C50 46 54 50 54 56 Z"
            fill="white"
          />
        </g>
      </svg>
    );
  }

  // Complete Stacked Logo (Image 2: HIGHTONE_CAT-43.png)
  return (
    <svg
      viewBox="0 0 340 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="htDiamondGradStacked" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="45%" stopColor="#4F46E5" />
          <stop offset="75%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <radialGradient id="htShadowStacked" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Top Diamond Emblem */}
      <g transform="translate(170, 75)">
        {/* Soft shadow under diamond */}
        <ellipse cx="0" cy="84" rx="55" ry="3.5" fill="url(#htShadowStacked)" />

        {/* Diamond graphic rotated 45 deg */}
        <g transform="rotate(45)">
          <rect
            x="-46"
            y="-46"
            width="92"
            height="92"
            rx="14"
            fill="url(#htDiamondGradStacked)"
          />
          {/* Top Notch Cutout */}
          <path
            d="M-18 -46 L16 -46 C21 -46 25 -42 25 -37 L25 -13 C25 -8 21 -5 16 -5 L-6 -5 C-11 -5 -15 -8 -15 -13 L-15 -30 C-15 -35 -18 -38 -23 -38 L-36 -38 C-41 -38 -44 -42 -44 -46 Z"
            fill="white"
          />
          {/* Bottom Notch Cutout */}
          <path
            d="M18 46 L-16 46 C-21 46 -25 42 -25 37 L-25 13 C-25 8 -21 5 -16 5 L6 5 C11 5 15 8 15 13 L15 30 C15 35 18 38 23 38 L36 38 C41 38 44 42 44 46 Z"
            fill="white"
          />
        </g>
      </g>

      {/* Brand Wordmark: HIGHTONE */}
      <g transform="translate(170, 222)">
        {/* Red accent triangle on top of H */}
        <path d="M-138 -32 L-128 -32 L-138 -20 Z" fill="#DC2626" />

        {/* HIGH (Charcoal #475569) */}
        {/* Letter H */}
        <path d="M-138 -32 L-128 -32 L-128 -19 L-114 -19 L-114 -32 L-104 -32 L-104 2 L-114 2 L-114 -10 L-128 -10 L-128 2 L-138 2 Z" fill="#475569" />
        
        {/* Letter I */}
        <path d="M-96 -32 L-86 -32 L-86 2 L-96 2 Z" fill="#475569" />

        {/* Letter G */}
        <path d="M-50 -15 L-65 -15 L-65 -6 L-49 -6 C-51 -1 -56 2 -65 2 C-75 2 -80 -6 -80 -15 C-80 -24 -75 -32 -65 -32 C-56 -32 -51 -28 -48 -22 L-58 -18 C-59 -21 -61 -23 -65 -23 C-70 -23 -71 -19 -71 -15 C-71 -11 -70 -7 -65 -7 C-60 -7 -58 -9 -58 -11 L-58 -11 L-58 -11 Z" fill="#475569" />
        
        {/* Letter H */}
        <path d="M-42 -32 L-32 -32 L-32 -19 L-18 -19 L-18 -32 L-8 -32 L-8 2 L-18 2 L-18 -10 L-32 -10 L-32 2 L-42 2 Z" fill="#475569" />

        {/* TONE (T is #475569, O is #475569 with concentric circle, N is #0077C8, E is #0077C8) */}
        {/* Letter T */}
        <path d="M-3 -32 L25 -32 L25 -23 L16 -23 L16 2 L6 2 L6 -23 L-3 -23 Z" fill="#475569" />

        {/* Letter O with target/center dot */}
        <g transform="translate(45, -15)">
          <circle cx="0" cy="0" r="17" fill="#0077C8" />
          <circle cx="0" cy="0" r="9" fill="white" />
          <circle cx="0" cy="0" r="5" fill="#475569" />
        </g>

        {/* Letter N (Ceramic Blue #0077C8) */}
        <path d="M68 2 L68 -32 L78 -32 L94 -9 L94 -32 L104 -32 L104 2 L94 2 L78 -21 L78 2 Z" fill="#0077C8" />

        {/* Letter E with 3 horizontal bars (#0077C8) */}
        <path d="M112 -32 L138 -32 L138 -24 L112 -24 Z" fill="#0077C8" />
        <path d="M112 -19 L134 -19 L134 -11 L112 -11 Z" fill="#0077C8" />
        <path d="M112 -6 L138 -6 L138 2 L112 2 Z" fill="#0077C8" />

        {/* ® Registered mark */}
        <g transform="translate(142, -31)">
          <circle cx="4" cy="4" r="5" stroke="#475569" strokeWidth="1" fill="none" />
          <text x="2.2" y="6.8" fontSize="6" fontWeight="bold" fill="#475569" fontFamily="sans-serif">R</text>
        </g>
      </g>

      {/* Script Tagline: "Part Of Your Life" */}
      <g transform="translate(170, 275)">
        <text
          x="45"
          y="0"
          textAnchor="middle"
          fontSize="24"
          fontStyle="italic"
          fontWeight="600"
          fontFamily="'Brush Script MT', 'Dancing Script', 'Caveat', 'Great Vibes', cursive, sans-serif"
          fill="#1e293b"
          letterSpacing="0.5px"
        >
          &ldquo;Part Of Your Life&rdquo;
        </text>
      </g>
    </svg>
  );
};
