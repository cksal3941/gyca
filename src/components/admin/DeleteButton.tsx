"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * 두 단계 확인 삭제 버튼. 바인딩된 서버 액션을 호출한 뒤 router.refresh()로
 * 목록을 갱신한다. (같은 경로로의 redirect는 클라이언트 라우터가 무시하므로
 * form action 대신 이 패턴을 쓴다)
 */
export default function DeleteButton({
  action,
  label = "Delete",
}: {
  action: () => Promise<void>;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!armed) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setArmed(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await action();
            router.refresh();
          })
        }
      >
        {pending ? "Deleting…" : "Confirm"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setArmed(false)}
      >
        Cancel
      </Button>
    </span>
  );
}
