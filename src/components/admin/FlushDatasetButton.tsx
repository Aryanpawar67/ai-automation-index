"use client";

import { useState }  from "react";
import { useRouter } from "next/navigation";
import ConfirmModal  from "./ConfirmModal";

type Mode = "dataset" | "full" | null;

export default function FlushDatasetButton({ onFlushed }: { onFlushed?: () => void }) {
  const router  = useRouter();
  const [modal, setModal]     = useState<Mode>(null);
  const [loading, setLoading] = useState(false);

  const handleFlush = async (full: boolean) => {
    setLoading(true);
    await fetch("/api/admin/dataset/flush", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ full }),
    });
    setLoading(false);
    setModal(null);
    onFlushed?.();
    router.refresh();
  };

  return (
    <>
      {modal === "dataset" && (
        <ConfirmModal
          title="Flush dataset rows?"
          message="Removes all uploaded dataset rows. Existing batches and analyses are unaffected."
          onConfirm={() => handleFlush(false)}
          onCancel={() => setModal(null)}
          loading={loading}
          danger={false}
        />
      )}
      {modal === "full" && (
        <ConfirmModal
          title="Flush ALL data?"
          message="Removes all dataset rows AND all batches, job descriptions, POCs, and analyses. This cannot be undone."
          onConfirm={() => handleFlush(true)}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setModal("dataset")}
          style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}
        >
          Flush Rows
        </button>
        <button
          onClick={() => setModal("full")}
          style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "#FEE2E2", fontSize: 13, fontWeight: 600, color: "#EF4444", cursor: "pointer" }}
        >
          Flush All
        </button>
      </div>
    </>
  );
}
