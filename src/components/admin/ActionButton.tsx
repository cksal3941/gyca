"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * 바인딩된 서버 액션을 호출한 뒤 router.refresh()로 현재 페이지를 갱신하는
 * 버튼. 목록에 머무는 관리자 액션(role 변경, 차단 등)에 사용한다.
 */
export default function ActionButton({
  action,
  variant = "outline",
  children,
}: {
  action: () => Promise<void>;
  variant?: "outline" | "ghost" | "destructive";
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await action();
          router.refresh();
        })
      }
    >
      {children}
    </Button>
  );
}
