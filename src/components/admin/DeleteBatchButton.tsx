"use client";

import { useState }  from "react";
import { useRouter } from "next/navigation";
import ConfirmModal  from "./ConfirmModal";

export default function DeleteBatchButton({ batchId, filename }: { batchId: string; filename: string }) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    await fetch(`/api/admin/batches/${batchId}`, { method: "DELETE" });
    setLoading(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      {open && (
        <ConfirmModal
          title={`Delete "${filename}"?`}
          message="Permanently removes this batch, all its job descriptions, and POC assignments."
          onConfirm={handleDelete}
          onCancel={() => setOpen(false)}
          loading={loading}
        />
      )}
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
        style={{ background: "#FEE2E2", color: "#EF4444" }}
      >
        Delete
      </button>
    </>
  );
}
