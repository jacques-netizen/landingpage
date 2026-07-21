"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompleteControls({ moduleId, assignmentId }: { moduleId: string; assignmentId: string | null }) {
  const router = useRouter();
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(body: object) {
    setBusy(true);
    await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {assignmentId && (
        <div className="flex gap-2">
          <input
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="Link to what you shipped"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !proofUrl}
            onClick={() => post({ action: "ship_assignment", assignmentId, proofUrl })}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Ship assignment
          </button>
        </div>
      )}
      <button
        disabled={busy}
        onClick={() => post({ action: "complete_module", moduleId })}
        className="self-start rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
      >
        Mark module complete
      </button>
    </div>
  );
}
