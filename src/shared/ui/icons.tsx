import type { ComponentProps, ReactNode } from 'react';

type IconProps = Omit<ComponentProps<'svg'>, 'children'>;

/** Base for decorative 16px stroke icons. Always aria-hidden: meaning comes from text. */
function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5M8 5.25h.01" />
    </Icon>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.3 9.5a1 1 0 0 1-.87 1.5H2.7a1 1 0 0 1-.87-1.5z" />
      <path d="M8 6.5v2.75M8 11.25h.01" />
    </Icon>
  );
}

export function ErrorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75v3.5M8 10.75h.01" />
    </Icon>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.75a6.25 6.25 0 1 0 6.25 6.25" />
    </Icon>
  );
}
