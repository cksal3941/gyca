"use client";

import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * Accessible modal (radix Dialog): focus trap, Esc to close, labelled by its
 * title, backdrop click to dismiss. Controlled via `open` / `onClose`.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1201] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-white p-6 shadow-xl outline-none sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-title text-[22px] font-bold text-ink-strong">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="닫기 / Close"
              className="shrink-0 rounded-md p-1 text-ink-strong outline-none hover:text-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue"
            >
              <CloseIcon size={20} />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="mt-2 text-[16px] leading-[1.6] text-ink-strong">
              {description}
            </Dialog.Description>
          )}
          {children && <div className="mt-4 text-[16px] text-ink-strong">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
