type LogoProps = {
  className?: string;
  variant?: "light" | "dark";
};

/** Wordmark approximating the MYSLIDE corporate logo. */
export default function Logo({ className = "", variant = "dark" }: LogoProps) {
  const color = variant === "light" ? "text-white" : "text-brand-blue";
  const sub = variant === "light" ? "text-white" : "text-brand-blue";
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span
        className={`font-nav text-[24px] font-bold tracking-[-0.5px] ${color}`}
      >
        MYSLIDE
      </span>
      <span
        className={`mt-[3px] text-[8px] font-semibold tracking-[0.38em] ${sub}`}
      >
        CORPORATION
      </span>
    </span>
  );
}
