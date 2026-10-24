"use client";

import React from "react";
import { TabletStage } from "@/components/arcade/stage";
import { CounterView } from "./session";

export default function TabletView() {
  return (
    <TabletStage
      hud={<span>Tablet HUD</span>}
      moveDock={<span>Move dock</span>}
      actionDock={<span>Action dock</span>}
      panel={<p>Tablet panel</p>}
      panelLabel="Fixture panel"
    >
      <CounterView name="Tablet" />
    </TabletStage>
  );
}
