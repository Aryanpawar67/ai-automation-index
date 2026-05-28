"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.location.replace("https://www.imocha.io/automation-index");
  }, []);

  return <div style={{ background: "#fff", minHeight: "100vh" }} />;
}
