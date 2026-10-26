"use client";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge } from "../CommonUI";
import { Icon } from "../Icons";
import { Viewer } from "../Viewer";

export function CompareScreen() {
  const { setPage } = useWorkspaceStore();

  return (
    <>
      <Heading
        eyebrow="IMAGING / LONGITUDINAL"
        title="A view across time."
        desc="Bring the current and prior studies into the same context."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => setPage("imaging")}
            >
              <Icon name="scan" /> Back to imaging
            </button>
            <button
              type="button"
              className="btn black"
              onClick={() => setPage("report")}
            >
              <Icon name="report" /> Add to draft
            </button>
          </>
        }
      />

      <ContextBar />

      {/* Side-by-Side Viewport Grid */}
      <div className="comparegrid">
        <div>
          <label className="field">
            Prior study
            <select aria-label="Select prior study">
              <option>21 Jul 2026 · CT chest</option>
            </select>
          </label>
          <Viewer label="PRIOR / 21 JUL 2026" initialSlice={110} />
        </div>

        <div>
          <label className="field">
            Current study
            <select aria-label="Select current study">
              <option>24 Oct 2026 · CT chest</option>
            </select>
          </label>
          <Viewer label="CURRENT / 24 OCT 2026" initialSlice={124} />
        </div>
      </div>

      {/* Temporal Distance Timeline */}
      <div className="timeline">
        <span className="timepoint">21 Jul 2026</span>
        <div className="track" />
        <span className="muted small font-medium">95 days</span>
        <div className="track" />
        <span className="timepoint current">24 Oct 2026</span>
      </div>

      {/* Discrepancy & Comparison Notes Panel */}
      <div className="panel">
        <div className="panel-head">
          <h2>Comparison notes</h2>
          <Badge text="Review required" variant="dark" />
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>REGION / ITEM</th>
                <th>PRIOR</th>
                <th>CURRENT</th>
                <th>REVIEW STATE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Illustrative region A</td>
                <td>12 mm · Demo</td>
                <td>10 mm · Demo</td>
                <td>
                  <Badge text="Verify measurements" />
                </td>
              </tr>
              <tr>
                <td>Acquisition context</td>
                <td>Source metadata</td>
                <td>Source metadata</td>
                <td>
                  <Badge text="Check registration" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="note" style={{ marginTop: "18px" }}>
        The same schematic is used to demonstrate the comparison layout. These measurements do not describe an actual study.
      </div>
    </>
  );
}
