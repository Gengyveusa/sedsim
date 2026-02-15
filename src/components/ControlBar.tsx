import { useSimStore } from '../store/useSimStore';

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10];

export function ControlBar() {
  const { running, speed, elapsedTime, toggleRunning, reset, setSpeed } = useSimStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-sim-panel border-b border-gray-700 px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleRunning}
          className={`px-4 py-1.5 rounded font-medium text-sm ${
            running
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {running ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={reset}
          className="px-4 py-1.5 rounded font-medium text-sm bg-red-600 hover:bg-red-700 text-white"
        >
          Reset
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Speed:</span>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2 py-1 rounded text-xs ${
              speed === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4 text-sm">
        <div className="text-gray-300">
          <span className="text-gray-500">Elapsed: </span>
          <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
        </div>
        <div className={`w-3 h-3 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
      </div>
    </div>
  );
}