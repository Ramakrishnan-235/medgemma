"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";
import { api, type SystemHealth } from "@/lib/api";

export function SettingsScreen() {
  const { settingTab, setSettingTab, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      settingTab: state.settingTab,
      setSettingTab: state.setSettingTab,
      showToast: state.showToast,
    })),
  );

  const [testingConnection, setTestingConnection] = useState(false);
  const [healthResult, setHealthResult] = useState<SystemHealth | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const health = await api.getHealth();
      setHealthResult(health);
      showToast(`Connected: ${health.service} (${health.status}) — Mode: ${health.mode}`);
    } catch (err) {
      showToast(`Connection failed: ${(err as Error).message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const tabs = [
    "Profile",
    "Workspace",
    "Appearance",
    "Model connection",
    "Data preferences",
  ];

  const descriptions: Record<string, string> = {
    Profile: "Your identity within the workspace.",
    Workspace: "A shared context for your clinical work.",
    Appearance: "A quiet interface that keeps the work in focus.",
    "Model connection": "Configure the inference service during implementation.",
    "Data preferences": "Make storage and processing choices explicit.",
  };

  return (
    <>
      <Heading
        eyebrow="WORKSPACE / SETTINGS"
        title="Make the space yours."
        desc="Manage your profile, preferences and connections."
        actions={
          <button
            type="button"
            className="btn black"
            onClick={() =>
              showToast("Saved in this design preview. No backend is connected.")
            }
          >
            <Icon name="check" /> Save changes
          </button>
        }
      />

      <div className="settingsgrid">
        {/* Left Vertical Sub-navigation */}
        <nav className="settingsnav" aria-label="Settings sections">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              className={settingTab === t ? "selected" : ""}
              onClick={() => setSettingTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Right Configuration Panel */}
        <section className="panel panel-pad">
          <h2>{settingTab}</h2>
          <p className="muted small" style={{ margin: "7px 0 25px" }}>
            {descriptions[settingTab] || ""}
          </p>

          {settingTab === "Profile" && (
            <div>
              <div className="row" style={{ marginBottom: "25px" }}>
                <span
                  className="avatar"
                  style={{ width: "45px", height: "45px", fontSize: "14px" }}
                >
                  DM
                </span>
                <Badge text="Demo account" variant="soft" />
              </div>
              <label className="field">
                Display name
                <input defaultValue="Dr. Morgan" />
              </label>
              <label className="field">
                Role
                <input defaultValue="Clinical reviewer · Demo" />
              </label>
            </div>
          )}

          {settingTab === "Workspace" && (
            <div>
              <label className="field">
                Workspace name
                <input defaultValue="My workspace" />
              </label>
              <label className="field">
                Default case context
                <select defaultValue="Ask when starting a task">
                  <option>Ask when starting a task</option>
                  <option>Use the active case</option>
                </select>
              </label>
              <div className="note" style={{ marginTop: "16px" }}>
                Team roles and access controls should use the actual backend
                permission model.
              </div>
            </div>
          )}

          {settingTab === "Appearance" && (
            <div>
              <div className="settingrow">
                <div>
                  <p>Theme</p>
                  <small>Monochrome clinical workspace</small>
                </div>
                <select className="case-picker" aria-label="Theme">
                  <option>Light</option>
                </select>
              </div>

              <div className="settingrow">
                <div>
                  <p>Interface density</p>
                  <small>Balanced spacing for long work sessions</small>
                </div>
                <select className="case-picker" aria-label="Density">
                  <option>Comfortable</option>
                  <option>Compact</option>
                </select>
              </div>

              <div className="settingrow">
                <div>
                  <p>Keyboard shortcuts</p>
                  <small>Show shortcut hints on controls</small>
                </div>
                <input
                  aria-label="Show keyboard shortcuts"
                  type="checkbox"
                  defaultChecked
                />
              </div>
            </div>
          )}

          {settingTab === "Model connection" && (
            <div>
              <div className="note" style={{ marginBottom: "22px" }}>
                Connect local or remote MedGemma 1.5 inference services.
              </div>
              <label className="field">
                Connection type
                <select defaultValue="Local inference service">
                  <option>Local inference service</option>
                  <option>Managed inference service</option>
                </select>
              </label>
              <label className="field">
                Service endpoint
                <input
                  placeholder="e.g. http://localhost:8000"
                  defaultValue="http://127.0.0.1:8000"
                />
              </label>
              <label className="field">
                Model identifier
                <input
                  placeholder="Select a supported model"
                  defaultValue="google/medgemma-1.5-4b-it"
                />
              </label>
              <div style={{ marginTop: "18px" }}>
                <button
                  type="button"
                  className="btn"
                  disabled={testingConnection}
                  onClick={handleTestConnection}
                >
                  <Icon name="volume" /> {testingConnection ? "Testing..." : "Test connection"}
                </button>
              </div>

              {healthResult && (
                <div className="note" style={{ marginTop: "14px", backgroundColor: "#f0fdf4", borderColor: "#86efac" }}>
                  <strong>Service Online</strong>
                  <br />
                  Endpoint: {healthResult.service} ({healthResult.status})
                  <br />
                  Mode: <code>{healthResult.mode}</code> · Checkpoint: <code>{healthResult.checkpoint}</code>
                </div>
              )}
            </div>
          )}

          {settingTab === "Data preferences" && (
            <div>
              <div className="settingrow">
                <div>
                  <p>Confirm external processing</p>
                  <small>Explain the destination before sending case data</small>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  aria-label="Confirm external processing"
                />
              </div>
              <div className="settingrow">
                <div>
                  <p>Preserve source references</p>
                  <small>Keep provenance with saved outputs</small>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  aria-label="Preserve source references"
                />
              </div>
              <div className="note" style={{ marginTop: "22px" }}>
                The implementation must show actual storage locations, retention
                behavior and processing destinations.
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
