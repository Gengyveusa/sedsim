import { memo, useEffect, useRef, useMemo } from 'react';
import useSimStore from '../store/useSimStore';

const severityStyles: Record<string, string> = {
  info: 'text-gray-400',
  warning: 'text-yellow-400',
  danger: 'text-red-400 font-bold',
};

/** Maximum number of log entries to render at once (virtualization cap). */
const MAX_VISIBLE_ENTRIES = 100;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const EventLog = memo(function EventLog() {
  const eventLog = useSimStore(s => s.eventLog);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only render the last MAX_VISIBLE_ENTRIES to keep the DOM small.
  const visibleEntries = useMemo(
    () => eventLog.slice(-MAX_VISIBLE_ENTRIES),
    [eventLog],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleEntries.length]);

  return (
    <div data-region="eventlog" className="flex-1 bg-sim-panel overflow-hidden flex flex-col">
      <h3 className="text-xs text-gray-400 uppercase mb-2 px-3 pt-3">Event Log</h3>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {visibleEntries.length === 0 ? (
          <p className="text-gray-500 text-sm">No events yet</p>
        ) : (
          visibleEntries.map((entry, i) => (
            <div
              key={i}
              className={`text-xs font-mono flex gap-2 ${severityStyles[entry.severity || 'info']}`}
            >
              <span className="text-gray-600 shrink-0">
                [{formatTime(entry.time)}]
              </span>
              <span>{entry.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
});

export default EventLog;
