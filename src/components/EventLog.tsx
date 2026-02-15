import { useEffect, useRef } from 'react';
import { useSimStore } from '../store/useSimStore';
import type { LogEntry } from '../types';

const severityStyles: Record<LogEntry['severity'], string> = {
  info: 'text-gray-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400 font-bold',
};

export function EventLog() {
  const { log } = useSimStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 bg-sim-panel overflow-hidden flex flex-col">
      <h3 className="text-xs text-gray-400 uppercase mb-2 px-3 pt-3">Event Log</h3>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {log.length === 0 ? (
          <p className="text-gray-500 text-sm">No events yet</p>
        ) : (
          log.map((entry, i) => (
            <div
              key={i}
              className={`text-xs font-mono flex gap-2 ${severityStyles[entry.severity]}`}
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
}