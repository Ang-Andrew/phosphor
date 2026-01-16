/**
 * DetailsDrawer Component
 * Displays comprehensive details for a selected telemetry item (Span, Log, or Metric).
 */

import React from 'react';
import type { Span, LogRecord, Metric, Attribute, AttributeValue } from '../types';

// ============================================================================
// Types
// ============================================================================

type TelemetryItem = Span | LogRecord | Metric;

interface DetailsDrawerProps {
  item: TelemetryItem | null;
  onClose: () => void;
  type: 'trace' | 'log' | 'metric';
}

// ============================================================================
// Helper Components
// ============================================================================

const formatAttributeValue = (value: AttributeValue): string => {
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const AttributeRow: React.FC<{ name: string; value: any; isTag?: boolean }> = ({ name, value, isTag }) => (
  <div className="flex flex-col py-2 border-b border-surface-800/30 last:border-0">
    <span className="text-xs font-medium text-surface-500 mb-0.5 select-text">{name}</span>
    <div className={`text-sm font-mono break-all select-text ${isTag ? 'text-phosphor-300' : 'text-surface-200'}`}>
      {formatAttributeValue(value)}
    </div>
  </div>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 mt-6 mb-3 pb-1 border-b border-surface-800">
    {title}
  </h3>
);

// ============================================================================
// Main Component
// ============================================================================

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ item, onClose, type }) => {
  if (!item) return null;

  // Render Attributes List
  const renderAttributes = (attributes?: Attribute[]) => {
    if (!attributes || attributes.length === 0) {
      return <div className="text-sm text-surface-600 italic py-2">No attributes</div>;
    }
    return attributes.map((attr, i) => (
      <AttributeRow
        key={`${attr.key}-${i}`}
        name={attr.key}
        value={attr.value}
        isTag
      />
    ));
  };

  return (
    <div className={`
      fixed inset-y-0 right-0 w-[450px] bg-surface-950 border-l border-surface-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col
      ${item ? 'translate-x-0' : 'translate-x-full'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-900/50">
        <div>
          <h2 className="text-lg font-semibold text-surface-100">
            {type === 'trace' ? 'Span Details' : type === 'log' ? 'Log Details' : 'Metric Details'}
          </h2>
          <div className="text-xs text-surface-500 font-mono mt-1 select-text">
            ID: {item.id}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* Resource info (Common to all) */}
        <SectionHeader title="Resource" />
        <AttributeRow name="Service Name" value={item.resource.serviceName} />
        {renderAttributes(item.resource.attributes)}

        {/* Trace Specifics */}
        {type === 'trace' && (() => {
          const span = item as Span;
          return (
            <>
              <SectionHeader title="Span Properties" />
              <AttributeRow name="Name" value={span.name} />
              <AttributeRow name="Kind" value={span.kind} />
              <AttributeRow name="Status" value={span.statusCode} />
              <AttributeRow name="Trace ID" value={span.traceId} />
              <AttributeRow name="Span ID" value={span.spanId} />
              <AttributeRow name="Parent Span ID" value={span.parentSpanId || '—'} />
              <AttributeRow name="Start Time" value={span.startTime} />
              <AttributeRow name="End Time" value={span.endTime} />
              <AttributeRow name="Duration" value={`${span.durationMs.toFixed(3)}ms`} />

              <SectionHeader title="Attributes" />
              {renderAttributes(span.attributes)}
            </>
          );
        })()}

        {/* Log Specifics */}
        {type === 'log' && (() => {
          const log = item as LogRecord;
          return (
            <>
              <SectionHeader title="Log Properties" />
              <AttributeRow name="Severity" value={log.severity} />
              <AttributeRow name="Body" value={log.body} />
              <AttributeRow name="Timestamp" value={log.timestamp} />
              <AttributeRow name="Trace ID" value={log.traceId || '—'} />
              <AttributeRow name="Span ID" value={log.spanId || '—'} />

              <SectionHeader title="Attributes" />
              {renderAttributes(log.attributes)}
            </>
          );
        })()}

        {/* Metric Specifics */}
        {type === 'metric' && (() => {
          const metric = item as Metric;
          return (
            <>
              <SectionHeader title="Metric Properties" />
              <AttributeRow name="Name" value={metric.name} />
              <AttributeRow name="Description" value={metric.description || '—'} />
              <AttributeRow name="Unit" value={metric.unit || '—'} />
              <AttributeRow name="Type" value={metric.type} />

              <SectionHeader title="Data Points" />
              {metric.dataPoints.map((dp, i) => (
                <div key={i} className="mb-4 p-3 bg-surface-900/40 rounded-lg border border-surface-800/50">
                  <div className="text-xs text-surface-500 mb-2">Point {i + 1}</div>
                  {dp.valueInt64 !== undefined && <AttributeRow name="Value (Int)" value={dp.valueInt64} />}
                  {dp.valueDouble !== undefined && <AttributeRow name="Value (Double)" value={dp.valueDouble} />}
                  {dp.count !== undefined && <AttributeRow name="Count" value={dp.count} />}
                  <div className="mt-2">
                    <div className="text-xs text-surface-500 mb-1">Attributes:</div>
                    {renderAttributes(dp.attributes)}
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </div>
    </div>
  );
};
