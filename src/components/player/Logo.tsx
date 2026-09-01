export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="32" height="32" rx="6" fill="#050505" />
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="4"
        fill="#111111"
        stroke="#c8ccd4"
        strokeWidth="2"
      />
      <rect x="5" y="6" width="3" height="3" rx="0.5" fill="#8c8880" />
      <rect x="5" y="14.5" width="3" height="3" rx="0.5" fill="#8c8880" />
      <rect x="5" y="23" width="3" height="3" rx="0.5" fill="#8c8880" />
      <rect x="24" y="6" width="3" height="3" rx="0.5" fill="#8c8880" />
      <rect x="24" y="14.5" width="3" height="3" rx="0.5" fill="#8c8880" />
      <rect x="24" y="23" width="3" height="3" rx="0.5" fill="#8c8880" />
      <path fill="#f2f0eb" d="M10 7h3.2v10.4L19.2 7H22v18h-3.2V14.6L12.8 25H10V7z" />
    </svg>
  );
}
