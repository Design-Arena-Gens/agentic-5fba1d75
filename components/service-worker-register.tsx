"use client";

import { useEffect } from "react";

const SW_PATH = "/sw.js";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register(SW_PATH)
        .catch((error) => console.error("SW registration failed", error));
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
    }

    return () => {
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
