"use client";

import { useShallow } from "zustand/react/shallow";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";

export function OverviewScreen() {
  const { setPage, cases, openModal } = useWorkspaceStore(
    useShallow((state) => ({
      setPage: state.setPage,
      cases: state.cases,
      openModal: state.openModal,
    })),
  );

  const recentCases = cases.slice(0, 4);

  return (
    <>
      <Heading
        eyebrow="SATURDAY, 24 OCTOBER 2026"
        title="Good morning, Dr. Morgan."
        desc="A little clarity for the work ahead."
        actions={
          <button
            type="button"
            className="btn black"
            onClick={() => openModal("newcase")}
          >
            <Icon name="plus" /> New case
          </button>
        }
      />

      {/* 3 Overview Stat Panels */}
      <div className="stats">
        <div className="stat">
          <label>
            Active cases <Icon name="folder" />
          </label>
          <strong>{String(cases.length).padStart(2, "0")}</strong>
          <small>In your demo workspace</small>
        </div>
        <div className="stat">
          <label>
            Awaiting review <Icon name="eye" />
          </label>
          <strong>04</strong>
          <small>Ready for a closer look</small>
        </div>
        <div className="stat">
          <label>
            Report drafts <Icon name="report" />
          </label>
          <strong>08</strong>
          <small>Continue where you left off</small>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="row between">
        <h2>What would you like to work on?</h2>
        <span className="design-label">YOUR TOOLS, IN ONE PLACE</span>
      </div>

      <div className="quickgrid">
        {[
          {
            icon: "scan",
            title: "Review an image",
            desc: "Explore studies, regions and changes.",
            target: "imaging" as const,
          },
          {
            icon: "text",
            title: "Understand a record",
            desc: "Bring a clinical story into focus.",
            target: "ehr" as const,
          },
          {
            icon: "chat",
            title: "Start a conversation",
            desc: "Ask, explore and work through ideas.",
            target: "chat" as const,
          },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            className="quick"
            onClick={() => setPage(item.target)}
          >
            <span className="tileicon">
              <Icon name={item.icon} />
            </span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
            <span className="arrow">
              <Icon name="arrow" />
            </span>
          </button>
        ))}
      </div>

      {/* Two Column Section */}
      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>Recent cases</h2>
            <button
              type="button"
              className="linkbutton"
              onClick={() => setPage("cases")}
            >
              View all cases ↗
            </button>
          </div>

          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>CASE</th>
                  <th>CONTEXT</th>
                  <th>STATUS</th>
                  <th>LAST ACTIVITY</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setPage("case")}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className="case-name">
                        {c.name}
                        <small>CASE {c.id} · Demo</small>
                      </span>
                    </td>
                    <td className="muted">{c.meta}</td>
                    <td>
                      <Badge
                        text={c.status}
                        variant={
                          c.status === "Needs review"
                            ? "dark"
                            : c.status === "Reviewed"
                            ? "soft"
                            : ""
                        }
                      />
                    </td>
                    <td className="muted">{c.date}</td>
                    <td>
                      <button
                        type="button"
                        className="btn tiny ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPage("case");
                        }}
                        aria-label={`Open ${c.name}`}
                      >
                        <Icon name="chevron" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent activity</h2>
            <Icon name="clock" />
          </div>
          <div className="activity">
            <div className="event">
              <span className="node" />
              <div>
                Report draft saved
                <small>Chest follow-up · 12 min ago</small>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                4 records added to case
                <small>Record synthesis · 1 hour ago</small>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                Extraction ready to review
                <small>Document review · Yesterday</small>
              </div>
            </div>
          </div>
          <div style={{ padding: "0 22px 20px" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setPage("cases")}
            >
              Open review queue <Icon name="arrow" />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
