"use client";

import { useState }    from "react";
import { useRouter }   from "next/navigation";
import ConfirmModal    from "./ConfirmModal";

export default function BatchActionButtons({ batchId, status }: { batchId: string; status: string }) {
  const router = useRouter();
  const [modal, setModal]     = useState<"stop" | "delete" | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStop = async () => {
    setLoading(true);
    await fetch(`/api/admin/batches/${batchId}/stop`, { method: "POST" });
    setLoading(false);
    setModal(null);
    router.refresh();
  };

  const handleDelete = async () => {
    setLoading(true);
    await fetch(`/api/admin/batches/${batchId}`, { method: "DELETE" });
    setLoading(false);
    setModal(null);
    router.push("/admin/batches");
  };

  const canStop = ["pending", "scraping", "analyzing"].includes(status);

  return (
    <>
      {modal === "stop" && (
        <ConfirmModal
          title="Stop batch?"
          message="All pending and scraped JDs will be cancelled. JDs currently being analysed will finish."
          onConfirm={handleStop}
          onCancel={() => setModal(null)}
          loading={loading}
          danger={false}
        />
      )}
      {modal === "delete" && (
        <ConfirmModal
          title="Delete batch?"
          message="This permanently deletes the batch, all job descriptions, and POC assignments. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      )}
      <div className="flex gap-2">
        {canStop && (
          <button
            onClick={() => setModal("stop")}
            className="text-xs px-3 py-1.5 rounded-xl font-medium border transition-colors"
            style={{ borderColor: "#EAE4EF", color: "#553366" }}
          >
            Stop
          </button>
        )}
        <button
          onClick={() => setModal("delete")}
          className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors"
          style={{ background: "#FEE2E2", color: "#EF4444" }}
        >
          Delete
        </button>
      </div>
    </>
  );
}
