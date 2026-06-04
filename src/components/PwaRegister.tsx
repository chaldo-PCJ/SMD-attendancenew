"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const isProduction = process.env.NODE_ENV === "production";

    // Keep dev mode clean so old service worker caches do not interfere with HMR/chunk loading.
    if (!isProduction) {
      const cleanupDevPwa = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ("caches" in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((key) => caches.delete(key)));
          }
        } catch (err) {
          console.error("PWA dev cleanup failed:", err);
        }
      };

      cleanupDevPwa();
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        console.log("PWA Service Worker registered successfully:", reg.scope);

        reg.addEventListener("updatefound", () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("New PWA content is available; refresh to update.");
            }
          });
        });
      } catch (err) {
        console.error("PWA Service Worker registration failed:", err);
      }
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }
  }, []);

  return null;
}
