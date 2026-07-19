import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  width: "1em",
  height: "1em",
};

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 5.5 18.5 12 7 18.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RetryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 11a8 8 0 1 0-.6 4" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}

export function DownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v14" />
      <path d="m6 12 6 6 6-6" />
    </svg>
  );
}

export function UpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20V6" />
      <path d="m6 12 6-6 6 6" />
    </svg>
  );
}

export function PingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2.5 6 5-12L17 12h4" />
    </svg>
  );
}

export function JitterIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h3l2-5 3 10 3-7 2 2h5" />
    </svg>
  );
}

export function WaveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
