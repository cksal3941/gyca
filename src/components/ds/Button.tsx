import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Site button. Tokens only (no per-screen hardcoding). Long labels wrap instead
// of overflowing (min-height grows); icons never shrink. Visible keyboard focus
// ring for accessibility.
const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-normal rounded-[7px] px-7 py-2.5 text-center text-[16px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-black text-white hover:opacity-90",
        accent: "bg-brand-blue text-white hover:opacity-90",
        outline: "border border-black bg-white text-ink hover:bg-neutral-50",
        ghost: "text-ink-strong hover:text-brand-blue",
      },
      size: {
        sm: "min-h-9 px-4 text-[14px]",
        md: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  className?: string;
  children: ReactNode;
};

type AsButton = ButtonBaseProps &
  Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };
type AsLink = ButtonBaseProps &
  Omit<ComponentProps<typeof Link>, "className" | "children" | "href"> & { href: string };

/** Renders a <button> by default, or a Next <Link> when `href` is provided. */
export default function Button(props: AsButton | AsLink) {
  const { variant, size, className, children, ...rest } = props;
  const classes = cn(buttonVariants({ variant, size }), className);

  if ("href" in props && props.href !== undefined) {
    const { href, ...linkRest } = rest as AsLink;
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...(rest as ComponentProps<"button">)}>
      {children}
    </button>
  );
}

export { buttonVariants };
