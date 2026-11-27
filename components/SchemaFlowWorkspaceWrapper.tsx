"use client";

import React from "react";
import dynamic from "next/dynamic";
import { SchemaFlowWorkspaceSkeleton } from "@/components/SchemaFlowWorkspaceSkeleton";

const SchemaFlowWorkspace = dynamic(
  () => import("@/components/SchemaFlowWorkspace"),
  {
    ssr: false,
    loading: () => <SchemaFlowWorkspaceSkeleton />,
  }
);

export default function SchemaFlowWorkspaceWrapper() {
  return <SchemaFlowWorkspace />;
}
