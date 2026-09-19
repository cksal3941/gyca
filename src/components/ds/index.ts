// GYCA site design system — reusable common UI for the PUBLIC/site surface
// (home, competition detail, submit, my page). Built on the token source of
// truth in `src/app/globals.css` (@theme). This is intentionally separate from
// the shadcn primitives in `src/components/ui/*`, which are used only by the
// auth cluster (login/signup/signout/settings). Do not create a competing set.

export { default as Button, buttonVariants } from "./Button";
export { SectionTitle, ArrowLink } from "./Section";
export { Message, StatusBadge, type Tone } from "./feedback";
export { Field, TextInput, Textarea, Select, controlClass } from "./form";
export { default as Tabs } from "./Tabs";
export { default as Stepper } from "./Stepper";
export { default as Modal } from "./Modal";
export { default as PaymentRouting } from "./PaymentRouting";
