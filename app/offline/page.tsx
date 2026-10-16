"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import {
  IconWifiOff,
  IconRefresh,
  IconArrowLeft,
  IconTerminal,
  IconBrain,
  IconFileSpreadsheet,
  IconCpu,
  IconDirections,
} from "@tabler/icons-react";

function subscribeToConnectivity(onStoreChange: () => void) {
  if (typeof window !== "undefined") {
    const handleChange = () => onStoreChange();
    window.addEventListener("online", handleChange);
    window.addEventListener("offline", handleChange);
    return () => {
      window.removeEventListener("online", handleChange);
      window.removeEventListener("offline", handleChange);
    };
  }

  return () => {};
}

function getConnectivitySnapshot() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

function getServerConnectivitySnapshot() {
  return false;
}

export default function OfflineFallbackPage() {
  const isOnline = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getServerConnectivitySnapshot
  );

  const handleRetry = () => {
    window.location.reload();
  };

  const precachedRoutes = [
    {
      title: "Home Overview",
      path: "/",
      icon: <IconDirections className="w-4 h-4 text-accent" />,
    },
    {
      title: "Formal Proof Studio",
      path: "/proof",
      icon: <IconTerminal className="w-4 h-4 text-accent" />,
    },
    {
      title: "Systems Simulator",
      path: "/simulator",
      icon: <IconDirections className="w-4 h-4 text-accent" />,
    },
    {
      title: "Neuro 3D CAD",
      path: "/neuro",
      icon: <IconBrain className="w-4 h-4 text-accent" />,
    },
    {
      title: "CRF Studio",
      path: "/crf",
      icon: <IconFileSpreadsheet className="w-4 h-4 text-accent" />,
    },
    {
      title: "Architecture & Stack",
      path: "/stack",
      icon: <IconCpu className="w-4 h-4 text-accent" />,
    },
    {
      title: "Arcade Hub",
      path: "/arcade",
      icon: <IconTerminal className="w-4 h-4 text-accent" />,
    },
  ];

  return (
    <PageLayout
      variant="standard"
      className="pt-28 pb-16 bg-zinc-950 text-foreground relative overflow-hidden"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface-1 border border-zinc-800 rounded-2xl p-8 md:p-12 shadow-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <IconWifiOff className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {isOnline ? "Connection Restored" : "You’re offline"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 mt-1">
                {isOnline
                  ? "This page is taking longer than expected"
                  : "This page isn’t available offline"}
              </h1>
            </div>
          </div>

          <p className="text-zinc-400 text-base sm:text-lg mb-8 leading-relaxed">
            {isOnline
              ? "Your connection is available, but the requested page did not load. Reload to try the request again."
              : "This page hasn’t been saved for offline use. Try again when you’re connected, or try one of the cached pages below."}
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-10">
            <button
              onClick={handleRetry}
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-zinc-950 bg-accent hover:bg-amber-400 transition-colors shadow-md active:scale-95 cursor-pointer"
            >
              <IconRefresh className="w-4 h-4 mr-2" />
              Retry Connection
            </button>
            <Link
              href="/"
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 transition-colors"
            >
              <IconArrowLeft className="w-4 h-4 mr-2" />
              Return to Homepage
            </Link>
          </div>

          <div className="border-t border-zinc-800/80 pt-8">
            <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-400 mb-4">
              Pages to Try Offline
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {precachedRoutes.map((route) => (
                <Link
                  key={route.path}
                  href={route.path}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60 hover:border-accent/40 hover:bg-zinc-800/40 transition-all group"
                >
                  <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-accent group-hover:border-accent/30">
                    {route.icon}
                  </div>
                  <span className="text-sm font-medium text-zinc-200 group-hover:text-accent transition-colors">
                    {route.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
