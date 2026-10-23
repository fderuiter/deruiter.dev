"use client";

import React from "react";
import { PhoneStage } from "@/components/arcade/stage";
import { CounterView } from "./session";

export default function PhoneView() {
  return (
    <PhoneStage
      hud={<span>Phone HUD</span>}
      moveDock={<span>Move dock</span>}
      actionDock={<span>Action dock</span>}
    >
      <CounterView name="Phone" />
    </PhoneStage>
  );
}
