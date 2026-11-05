"use client";

import React, { useState, useEffect } from "react";
import type { DiagnosticAssessmentData, LesionBox } from "./types";
import { fetchFhirDiagnosticBundle } from "../volumetric/api";

interface FhirModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: DiagnosticAssessmentData;
  box01?: LesionBox | null;
  onToast: (msg: string) => void;
}

export function FhirModal({
  isOpen,
  onClose,
  assessment,
  box01,
  onToast,
}: FhirModalProps) {
  const [copied, setCopied] = useState(false);
  const [liveBundle, setLiveBundle] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchFhirDiagnosticBundle(assessment.accessionNumber || "ACC-89432", "PAT-49204").then((bundle) => {
      if (!cancelled && bundle) {
        setLiveBundle(bundle);
        setIsLive(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, assessment.accessionNumber]);

  if (!isOpen) return null;

  const fhirBundle = {
    resourceType: "Bundle",
    type: "collection",
    id: "bundle-medgemma-hrct-89432",
    entry: [
      {
        resource: {
          resourceType: "DiagnosticReport",
          id: "dr-89432",
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                  code: "RAD",
                  display: "Radiology",
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "24627-2",
                display: "Chest CT high resolution WO IV contrast",
              },
            ],
            text: "High-Resolution Chest Computed Tomography (HRCT)",
          },
          subject: {
            reference: "Patient/PT-49204",
            display: "ANONYMIZED CLINICAL SUBJECT",
          },
          effectiveDateTime: new Date().toISOString(),
          conclusion: box01
            ? `${box01.diameterMm} mm ${box01.label} (${assessment.lungRadsCurrent}, Malignancy probability ${assessment.malignancyProbability}%). Volume ${box01.volumeCm3} cm³.`
            : `Thoracic CT study (${assessment.accessionNumber}). ${assessment.lungRadsCurrent}. No suspicious focal pulmonary nodules detected.`,
          conclusionCode: [
            {
              coding: [
                {
                  system: "http://radlex.org",
                  code: "RID50170",
                  display: assessment.lungRadsCurrent,
                },
              ],
            },
          ],
        },
      },
      ...(box01
        ? [
            {
              resource: {
                resourceType: "Observation",
                id: `obs-nodule-${box01.id.toLowerCase()}`,
                status: "final",
                code: {
                  coding: [
                    {
                      system: "http://loinc.org",
                      code: "33728-7",
                      display: "Size of lung nodule",
                    },
                  ],
                },
                valueQuantity: {
                  value: box01.diameterMm,
                  unit: "mm",
                  system: "http://unitsofmeasure.org",
                  code: "mm",
                },
                bodySite: {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      code: "45661006",
                      display: box01.site,
                    },
                  ],
                },
                component: [
                  {
                    code: { text: "Malignancy Probability" },
                    valueQuantity: {
                      value: assessment.malignancyProbability,
                      unit: "%",
                    },
                  },
                  {
                    code: { text: "Volume Doubling Time (VDT)" },
                    valueQuantity: {
                      value: assessment.vdtDays,
                      unit: "d",
                    },
                  },
                  {
                    code: { text: "Slice Coordinate Index" },
                    valueInteger: box01.sliceIndex,
                  },
                ],
              },
            },
          ]
        : []),
    ],
  };

  const jsonStr = JSON.stringify(liveBundle || fhirBundle, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    onToast("Copied FHIR R4 JSON bundle to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fhir-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 id="fhir-dialog-title" className="text-sm font-bold text-gray-900 font-mono">
              HL7 FHIR R4 • US Core DiagnosticReport Bundle
            </h3>
            {isLive && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Live Backend API
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto font-mono text-xs bg-gray-900 text-gray-100 flex-1">
          <pre tabIndex={0} className="whitespace-pre-wrap focus:outline-none">
            {jsonStr}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <span className="text-xs text-gray-500 font-mono">
            Compliant with FHIR US Core Implementation Guide v6.1.0
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer"
            >
              {copied ? "Copied! ✓" : "Copy JSON"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 hover:bg-black text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

