import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-sim-bg text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-cyan-400 tracking-tight">Gengyve</span>
        <nav className="flex gap-4 text-sm text-gray-300">
          <a href="#tools" className="hover:text-white transition-colors">Tools</a>
          <a href="#modules" className="hover:text-white transition-colors">Modules</a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
          The Learning Site by{' '}
          <span className="text-cyan-400">Gengyve</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl">
          Interactive simulators and cases for sedation, physiology, and oral‑systemic health.
          Built for dental and medical educators who demand clinical accuracy.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/sim')}
            className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors shadow-lg text-base"
          >
            Launch SedSim Simulator
          </button>
          <button
            onClick={() => navigate('/sim?scenarios=open')}
            className="px-8 py-3 border border-cyan-600 hover:border-cyan-400 text-cyan-300 hover:text-white font-semibold rounded-lg transition-colors text-base"
          >
            Browse Scenarios
          </button>
        </div>
      </section>

      {/* Featured Tool */}
      <section id="tools" className="px-6 py-12 border-t border-gray-700">
        <h2 className="text-2xl font-bold text-center text-white mb-8">Featured Tool</h2>
        <div className="max-w-3xl mx-auto">
          <div className="border border-gray-600 rounded-xl p-6 bg-gray-800/50 hover:border-cyan-700 transition-colors">
            <div className="flex items-start gap-4">
              {/* Screenshot placeholder */}
              <div className="w-32 h-24 flex-shrink-0 bg-gray-700 rounded-lg flex items-center justify-center border border-gray-600">
                <span className="text-3xl">💊</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-cyan-300 mb-1">SedSim</h3>
                <p className="text-sm text-gray-300 mb-3">
                  Real-time pharmacokinetic sedation simulator with guided clinical scenarios.
                  Titrate propofol, midazolam, and fentanyl in lifelike patients — from routine
                  colonoscopy to pediatric laryngospasm.
                </p>
                <button
                  onClick={() => navigate('/sim')}
                  className="text-xs px-4 py-1.5 bg-cyan-700 hover:bg-cyan-600 rounded text-white font-semibold transition-colors"
                >
                  Open Simulator →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future Modules */}
      <section id="modules" className="px-6 py-12 border-t border-gray-700">
        <h2 className="text-2xl font-bold text-center text-white mb-8">Coming Soon</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { emoji: '🫁', title: 'Airway & Ventilation', desc: 'Mechanical ventilation modes, weaning protocols, and airway management cases.' },
            { emoji: '🫀', title: 'Hemodynamic Response', desc: 'Vasopressors, fluids, and shock physiology in interactive clinical scenarios.' },
            { emoji: '🦷', title: 'Oral-Systemic Links', desc: 'Periodontal-cardiovascular connections, diabetes, and airway anatomy.' },
          ].map(({ emoji, title, desc }) => (
            <div
              key={title}
              className="border border-gray-700 rounded-xl p-5 bg-gray-800/30 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{emoji}</span>
                <span className="font-semibold text-gray-200 text-sm">{title}</span>
              </div>
              <p className="text-xs text-gray-400">{desc}</p>
              <span className="inline-block mt-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 w-fit">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 px-6 py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Gengyve. All rights reserved. &nbsp;·&nbsp; SedSim is an educational simulation tool and is not intended for clinical decision-making.
      </footer>
    </div>
  );
}
