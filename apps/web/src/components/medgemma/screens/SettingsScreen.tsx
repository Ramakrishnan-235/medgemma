"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";
import { api, type SystemHealth } from "@/lib/api";

function SwitchToggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
        checked ? "bg-zinc-100" : "bg-zinc-800"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          checked ? "translate-x-4 bg-zinc-950" : "translate-x-0.5 bg-zinc-400"
        }`}
      />
    </button>
  );
}

export function SettingsScreen() {
  const { settingTab, setSettingTab, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      settingTab: state.settingTab,
      setSettingTab: state.setSettingTab,
      showToast: state.showToast,
    }))
  );

  const [testingConnection, setTestingConnection] = useState(false);
  const [healthResult, setHealthResult] = useState<SystemHealth | null>(null);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [confirmExternal, setConfirmExternal] = useState(true);
  const [preserveSources, setPreserveSources] = useState(true);

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
    "API keys",
    "Data preferences",
  ];

  const descriptions: Record<string, string> = {
    Profile: "Your identity within the workspace.",
    Workspace: "A shared context for your clinical work.",
    Appearance: "A quiet interface that keeps the work in focus.",
    "Model connection": "Configure the inference service during implementation.",
    "API keys": "Manage Hugging Face and Vertex AI clinical model gateway tokens.",
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
        <nav
          className="settingsnav"
          aria-label="Settings sections"
          role="tablist"
          aria-orientation="vertical"
        >
          {tabs.map((t) => {
            const slug = t.toLowerCase().replace(/\s+/g, "-");
            const isSelected = settingTab === t;
            return (
              <button
                key={t}
                id={`settings-tab-${slug}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`settings-panel-${slug}`}
                className={isSelected ? "selected" : ""}
                onClick={() => setSettingTab(t)}
              >
                {t}
              </button>
            );
          })}
        </nav>

        {/* Right Configuration Panel */}
        <section
          id={`settings-panel-${settingTab.toLowerCase().replace(/\s+/g, "-")}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${settingTab.toLowerCase().replace(/\s+/g, "-")}`}
          className="panel panel-pad"
        >
          <h2>{settingTab}</h2>
          <p className="muted small my-2 mb-6">
            {descriptions[settingTab] || ""}
          </p>

          {settingTab === "Profile" && (
            <div>
              <div className="row mb-6">
                <span className="avatar w-11 h-11 text-sm">
                  DM
                </span>
                <Badge text="Demo account" variant="soft" />
              </div>
              <label className="field" htmlFor="profile-display-name">
                Display name
                <input id="profile-display-name" defaultValue="Dr. Morgan" />
              </label>
              <label className="field" htmlFor="profile-clinical-role">
                Role
                <input id="profile-clinical-role" defaultValue="Clinical reviewer · Demo" />
              </label>
            </div>
          )}

          {settingTab === "Workspace" && (
            <div>
              <label className="field" htmlFor="workspace-name">
                Workspace name
                <input id="workspace-name" defaultValue="My workspace" />
              </label>
              <label className="field" htmlFor="workspace-case-context">
                Default case context
                <select id="workspace-case-context" defaultValue="Ask when starting a task">
                  <option>Ask when starting a task</option>
                  <option>Use the active case</option>
                </select>
              </label>
              <div className="note mt-4">
                Team roles and access controls should use the actual backend
                permission model.
              </div>
            </div>
          )}

          {settingTab === "Appearance" && (
            <div>
              <div className="settingrow">
                <div>
                  <label htmlFor="settings-theme" className="font-medium cursor-pointer">
                    Theme
                  </label>
                  <small className="block text-zinc-400">Monochrome clinical workspace</small>
                </div>
                <select id="settings-theme" className="case-picker" aria-label="Theme" defaultValue="dark">
                  <option value="dark">Monochrome Dark (Default)</option>
                  <option value="contrast">High Contrast Dark</option>
                </select>
              </div>

              <div className="settingrow">
                <div>
                  <label htmlFor="settings-density" className="font-medium cursor-pointer">
                    Interface density
                  </label>
                  <small className="block text-zinc-400">Balanced spacing for long work sessions</small>
                </div>
                <select id="settings-density" className="case-picker" aria-label="Density" defaultValue="comfortable">
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>

              <div className="settingrow">
                <div>
                  <p className="font-medium">Keyboard shortcuts</p>
                  <small className="block text-zinc-400">Show shortcut hints on controls</small>
                </div>
                <SwitchToggle
                  id="settings-shortcuts-toggle"
                  label="Show keyboard shortcuts"
                  checked={shortcutsEnabled}
                  onChange={setShortcutsEnabled}
                />
              </div>
            </div>
          )}

          {settingTab === "Model connection" && (
            <div>
              <div className="note mb-5">
                Connect local or remote MedGemma 1.5 inference services.
              </div>
              <label className="field" htmlFor="settings-conn-type">
                Connection type
                <select id="settings-conn-type" defaultValue="Local inference service">
                  <option>Local inference service</option>
                  <option>Managed inference service</option>
                </select>
              </label>
              <label className="field" htmlFor="settings-endpoint">
                Service endpoint
                <input
                  id="settings-endpoint"
                  placeholder="e.g. http://localhost:8000"
                  defaultValue="http://127.0.0.1:8000"
                />
              </label>
              <label className="field" htmlFor="settings-model-id">
                Model identifier
                <input
                  id="settings-model-id"
                  placeholder="Select a supported model"
                  defaultValue="google/medgemma-1.5-4b-it"
                />
              </label>
              <div className="mt-4">
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
                <div className="note mt-3.5 bg-zinc-900 border-zinc-800 text-zinc-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-zinc-100"
                      aria-hidden="true"
                    />
                    <strong className="text-zinc-100">
                      Service Online ({healthResult.status})
                    </strong>
                    <Badge text={healthResult.mode} variant="soft" />
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div>
                      Endpoint: <span className="text-zinc-200">{healthResult.service}</span>
                    </div>
                    <div>
                      Checkpoint:{" "}
                      <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">
                        {healthResult.checkpoint}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {settingTab === "API keys" && (
            <div>
              <div className="note mb-5">
                API keys and Hugging Face tokens are securely stored locally for authenticated access to MedGemma 1.5 checkpoints.
              </div>
              <label className="field" htmlFor="settings-hf-token">
                Hugging Face User Access Token
                <input
                  id="settings-hf-token"
                  type="password"
                  placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  autoComplete="off"
                />
              </label>
              <label className="field" htmlFor="settings-gateway-key">
                MedGemma Gateway API Key (Optional)
                <input
                  id="settings-gateway-key"
                  type="password"
                  placeholder="mg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  autoComplete="off"
                />
              </label>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn black"
                  onClick={() => showToast("API key preferences saved locally.")}
                >
                  <Icon name="check" /> Save API keys
                </button>
              </div>
            </div>
          )}

          {settingTab === "Data preferences" && (
            <div>
              <div className="settingrow">
                <div>
                  <p className="font-medium">Confirm external processing</p>
                  <small className="block text-zinc-400">Explain destination before sending case data</small>
                </div>
                <SwitchToggle
                  id="settings-confirm-ext-toggle"
                  label="Confirm external processing"
                  checked={confirmExternal}
                  onChange={setConfirmExternal}
                />
              </div>
              <div className="settingrow">
                <div>
                  <p className="font-medium">Preserve source references</p>
                  <small className="block text-zinc-400">Keep provenance with saved outputs</small>
                </div>
                <SwitchToggle
                  id="settings-preserve-src-toggle"
                  label="Preserve source references"
                  checked={preserveSources}
                  onChange={setPreserveSources}
                />
              </div>
              <div className="note mt-5">
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
