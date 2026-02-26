import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

/* ---- Quantum Distillery Brand Tokens ---- */
const C = {
  bg: '#0a0705',
  surface: '#120e08',
  card: '#1c1409',
  border: '#3d2a0a',
  amber: '#c8860a',
  amberBright: '#f0a522',
  gold: '#ffd060',
  orange: '#e05a0a',
  cream: '#f5e8c8',
  muted: '#8a7050',
  dim: '#5a4530',
  white: '#ffffff',
} as const;

const font = {
  serif: "'Georgia','Times New Roman',serif",
  sans: "'Inter','Helvetica Neue','Arial',sans-serif",
};

/* ---- Tab Content Data ---- */
const tabContent: Record<string, { title: string; body: string; insight: string }> = {
  'Information Theory': {
    title: 'Information Theory',
    body: 'Claude Shannon\'s information theory provides the mathematical backbone for understanding how biological systems encode, transmit, and decode signals. Every heartbeat is a message. Every action potential is a bit. The entropy of a cardiac rhythm tells us whether the heart is healthy or failing \u2014 high entropy signals adaptability, while pathological regularity precedes arrest. In DNA, four nucleotides encode the entire operating system of life using a quaternary code that rivals any engineered compression algorithm. Shannon entropy quantifies the information content of genetic sequences and reveals the redundancy evolution has built in for error correction.',
    insight: 'The deepest insight: consciousness itself may be an information-processing phenomenon \u2014 integrated information theory (IIT) proposes that the degree to which a system integrates information determines its level of awareness.'
  },
  'Topology': {
    title: 'Topology',
    body: 'Topology studies the properties of spaces that remain invariant under continuous deformation \u2014 stretching, bending, but never tearing. In biology, protein folding is fundamentally a topological problem: a linear chain of amino acids must navigate an astronomically large conformational space to find its functional three-dimensional shape. Topological data analysis (TDA) now reveals hidden structures in high-dimensional clinical datasets that traditional statistics cannot detect. The persistent homology of neural connectivity maps shows how the brain organizes information across scales.',
    insight: 'Knot theory, a branch of topology, explains how DNA supercoiling regulates gene expression \u2014 topoisomerase enzymes literally change the topology of DNA to allow replication and transcription.'
  },
  'Stochastic Modeling': {
    title: 'Stochastic Modeling',
    body: 'Biological systems are inherently noisy. Stochastic models capture this randomness mathematically, describing everything from ion channel flickering to pharmacokinetic drug distribution. Markov chains model the probabilistic transitions between cardiac rhythm states \u2014 from normal sinus rhythm to atrial fibrillation to ventricular tachycardia. The Gillespie algorithm simulates the stochastic biochemistry inside individual cells, revealing that gene expression is not deterministic but fundamentally random, with consequences that ripple up to organism-level phenotypes.',
    insight: 'In anesthesia, stochastic models of drug effect-site concentrations are what make target-controlled infusion possible \u2014 predicting the probability of consciousness loss rather than guaranteeing it.'
  },
  'Bayesian Inference': {
    title: 'Bayesian Inference',
    body: 'Bayesian inference is how rational agents update beliefs in light of new evidence. It is arguably the mathematics of learning itself. In clinical medicine, every diagnostic test result shifts our prior probability of disease toward a posterior probability via likelihood ratios. The brain itself appears to be a Bayesian inference engine \u2014 the predictive processing framework proposes that perception is not passive reception but active prediction, with sensory data serving as evidence that updates an internal generative model of the world.',
    insight: 'Bayesian methods underpin modern AI clinical decision support \u2014 and may explain why experienced clinicians develop superior intuition: they have accumulated better priors through thousands of patient encounters.'
  },
  'Quantum Tunneling': {
    title: 'Quantum Tunneling',
    body: 'Quantum tunneling occurs when a particle traverses an energy barrier that classical physics says it cannot cross. This is not a theoretical curiosity \u2014 it is essential to life. Enzyme catalysis, the engine of all metabolism, depends on hydrogen atoms tunneling through energy barriers to accelerate reaction rates by factors of thousands. Without tunneling, the biochemistry of life would be too slow to sustain it. In mitochondrial Complex I, electron tunneling across chains of iron-sulfur clusters drives the proton pumping that generates ATP.',
    insight: 'Tunneling may also play a role in olfaction (the vibrational theory of smell), in photosynthesis (exciton transport), and potentially in the mechanism of general anesthesia itself \u2014 a quantum distillery problem if ever there was one.'
  },
  'Thermodynamics': {
    title: 'Thermodynamics',
    body: 'The second law of thermodynamics states that the entropy of an isolated system tends to increase. Living organisms appear to defy this law, maintaining exquisite internal order \u2014 but they do so by exporting entropy to their surroundings. Erwin Schr\u00f6dinger recognized this in 1944: life feeds on negative entropy. Every metabolic pathway, every ion pump, every muscle contraction is a thermodynamic transaction \u2014 free energy is consumed to maintain the far-from-equilibrium state that defines being alive.',
    insight: 'Death is not a biological event. It is a thermodynamic one \u2014 the point at which a system can no longer maintain its entropy gradient against the environment. This is the deepest definition of what it means to be alive.'
  },
  'Electrodynamics': {
    title: 'Electrodynamics',
    body: 'Maxwell\'s equations govern every electrical signal in the body. The electrochemical gradients across cell membranes are electromagnetic phenomena. The cardiac conduction system generates electric fields detectable on the body surface as the ECG \u2014 a direct readout of Maxwell\'s equations applied to living tissue. Neural signaling, from the cortex to the peripheral nerves, is fundamentally an electromagnetic phenomenon governed by the cable equation, a simplification of Maxwell\'s framework for cylindrical conductors.',
    insight: 'The electromagnetic field generated by the heart is the strongest in the body \u2014 detectable several feet away. Some researchers propose that endogenous bioelectric fields play instructive roles in development, wound healing, and even cancer suppression.'
  },
  'Negative Entropy': {
    title: 'Negative Entropy',
    body: 'Schr\u00f6dinger\'s concept of negative entropy (negentropy) describes how living systems import order from their environment to maintain and increase their internal organization. This is not a violation of thermodynamics but its most elegant expression: life is a local entropy-reducing process sustained by global entropy production. ATP hydrolysis, the universal energy currency, couples exergonic reactions to endergonic ones \u2014 using the free energy released by breaking phosphate bonds to drive the molecular machines that build and repair the organism.',
    insight: 'The Quantum Distillery\'s Epoch #4 framework proposes that the emergence of consciousness represents a new regime of negentropy \u2014 where information itself becomes the substrate that is organized against the thermodynamic gradient.'
  },
  'Molecular Biology': {
    title: 'Molecular Biology',
    body: 'At the molecular scale, biology is an information-processing system of staggering complexity. DNA stores the genome \u2014 roughly 3.2 billion base pairs encoding approximately 20,000 protein-coding genes, plus vast regulatory networks in the non-coding regions. Transcription, translation, and post-translational modification form a cascade of information transformation from digital code to three-dimensional molecular machines. Epigenetics adds another layer: chemical modifications to DNA and histones that alter gene expression without changing the sequence itself.',
    insight: 'The central dogma (DNA \u2192 RNA \u2192 Protein) is actually a simplification. Reverse transcriptase, RNA editing, prions, and epigenetic inheritance all demonstrate that information flows in multiple directions through biological systems.'
  },
  'Quantum Biology': {
    title: 'Quantum Biology',
    body: 'Quantum biology investigates whether non-trivial quantum mechanical effects play functional roles in living systems. The evidence is mounting. Photosynthetic complexes in plants and bacteria achieve near-perfect energy transfer efficiency through quantum coherence \u2014 excitons exploring multiple pathways simultaneously. Magnetoreception in migratory birds appears to rely on radical pair mechanisms that are sensitive to quantum spin dynamics. Enzyme catalysis exploits tunneling. Even mutations in DNA may involve quantum superposition of proton positions in hydrogen bonds.',
    insight: 'The question is no longer whether quantum effects occur in biology \u2014 they do. The question is whether evolution has learned to harness them. If so, life is not merely classical chemistry. It is quantum engineering, refined over four billion years.'
  },
  'Consciousness': {
    title: 'Consciousness',
    body: 'Consciousness remains the hardest problem in science. How does subjective experience arise from objective matter? Integrated Information Theory (IIT) proposes that consciousness corresponds to integrated information (\u03A6) \u2014 the degree to which a system is both differentiated and unified. The Global Workspace Theory suggests consciousness emerges when information is broadcast widely across cortical networks. Orchestrated Objective Reduction (Orch OR) goes further, proposing that quantum computations in microtubules within neurons give rise to conscious moments.',
    insight: 'For anesthesiologists, consciousness is not philosophy \u2014 it is the primary clinical variable. General anesthesia reversibly eliminates consciousness, and understanding its mechanism may be the key to understanding consciousness itself. This is where the Quantum Distillery\'s work converges.'
  },
  'Epoch #4': {
    title: 'Epoch #4: Information Becomes Aware',
    body: 'The Epoch framework traces the emergence of complexity through four phase transitions. Epoch #1: Energy \u2014 the Big Bang creates matter and energy. Epoch #2: Chemistry \u2014 atoms combine into molecules, governed by quantum mechanics. Epoch #3: Biology \u2014 self-replicating molecular systems emerge, exploiting thermodynamic gradients to sustain negative entropy. Epoch #4: Consciousness \u2014 biological information processing reaches a threshold where the system becomes aware of itself. Each epoch does not replace the previous one but builds upon it.',
    insight: 'Epoch #4 is the framework that unifies everything in the Quantum Distillery. Mathematics provides the language, physics provides the mechanism, and biology provides the expression \u2014 but consciousness is what makes the universe able to ask questions about itself.'
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const obs = useRef<IntersectionObserver | null>(null);
  const [activeTabs, setActiveTabs] = useState<Record<string, string | null>>({
    Mathematics: null,
    Physics: null,
    Biology: null,
  });

  const toggleTab = (section: string, tag: string) => {
    setActiveTabs(prev => ({
      ...prev,
      [section]: prev[section] === tag ? null : tag,
    }));
  };

  useEffect(() => {
    obs.current = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('qd-visible'); } });
    }, { threshold: 0.15 });
    document.querySelectorAll('.qd-fade').forEach(el => obs.current?.observe(el));
    return () => obs.current?.disconnect();
  }, []);

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.cream, fontFamily:font.sans }}>

      {/* ---- GLOBAL ANIMATION STYLES ---- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600;700&display=swap');
        .qd-fade { opacity:0; transform:translateY(24px); transition:opacity .7s ease,transform .7s ease; }
        .qd-visible { opacity:1!important; transform:translateY(0)!important; }
        .qd-glow { animation: qdPulse 4s ease-in-out infinite alternate; }
        @keyframes qdPulse { 0%{box-shadow:0 0 30px rgba(200,134,10,.12)} 100%{box-shadow:0 0 60px rgba(240,165,34,.25)} }
        .qd-btn:hover { background:${C.amberBright}!important; }
        .qd-btn2:hover { background:${C.amber}!important; color:${C.bg}!important; }
        .qd-card:hover { background:${C.surface}!important; }
        .qd-link:hover { color:${C.amberBright}!important; }
        .qd-tab-content { max-height:0; overflow:hidden; transition:max-height .5s ease, opacity .5s ease, padding .5s ease; opacity:0; padding:0 24px; }
        .qd-tab-content.open { max-height:600px; opacity:1; padding:24px; }
      `}</style>

      {/* ---- NAV ---- */}
      <nav style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 40px', borderBottom:`1px solid ${C.border}` }}>
        <span style={{ color:C.amber, fontSize:13, letterSpacing:'.2em', textTransform:'uppercase', fontFamily:font.sans, fontWeight:700 }}>The Quantum Distillery</span>
        <div style={{ display:'flex', gap:28 }}>
          <a href="https://thequantumdistillery.substack.com" className="qd-link" style={{ color:C.muted, textDecoration:'none', fontSize:13, letterSpacing:'.1em', fontFamily:font.sans, transition:'color .2s' }}>Substack</a>
          <a href="https://www.gengyveusa.com" className="qd-link" style={{ color:C.muted, textDecoration:'none', fontSize:13, letterSpacing:'.1em', fontFamily:font.sans, transition:'color .2s' }}>Gengyve</a>
          <span onClick={() => navigate('/sim')} className="qd-link" style={{ color:C.muted, cursor:'pointer', fontSize:13, letterSpacing:'.1em', fontFamily:font.sans, transition:'color .2s' }}>SedSim</span>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="qd-fade" style={{ textAlign:'center', padding:'100px 24px 80px' }}>
        <p style={{ color:C.muted, fontSize:12, letterSpacing:'.3em', textTransform:'uppercase', marginBottom:20 }}>Est. 2024 \u2014 San Francisco</p>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(36px,6vw,72px)', fontWeight:400, color:C.gold, lineHeight:1.1, margin:'0 0 16px' }}>the quantum distillery</h1>
        <p style={{ color:C.muted, fontSize:15, letterSpacing:'.15em', marginBottom:40 }}>Thad Connelly \u2022 MD \u2022 DDS \u2022 PhD</p>
        <p style={{ color:C.cream, fontSize:17, maxWidth:560, margin:'0 auto 48px', lineHeight:1.7, fontFamily:font.serif, fontStyle:'italic', opacity:.85 }}>Distilling complexity into clarity \u2014 from the quantum to the clinical</p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => navigate('/sim')} className="qd-btn" style={{ background:C.amber, color:C.bg, border:'none', padding:'14px 32px', fontSize:13, letterSpacing:'.12em', textTransform:'uppercase', fontFamily:font.sans, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>Launch SedSim</button>
          <a href="https://thequantumdistillery.substack.com" className="qd-btn2" style={{ border:`1px solid ${C.amber}`, color:C.amber, background:'transparent', padding:'14px 32px', fontSize:13, letterSpacing:'.12em', textTransform:'uppercase', fontFamily:font.sans, fontWeight:700, textDecoration:'none', transition:'all .2s' }}>Read the Pours</a>
        </div>
      </section>

      {/* ---- DEFINITION I: DISTILLERY ---- */}
      <section className="qd-fade" style={{ maxWidth:780, margin:'0 auto', padding:'80px 24px', borderTop:`1px solid ${C.border}` }}>
        <p style={{ color:C.amber, fontSize:12, letterSpacing:'.3em', marginBottom:8 }}><span style={{ fontFamily:font.serif, fontStyle:'italic', fontSize:20, marginRight:8 }}>I</span>&nbsp;&nbsp;noun &bull; /d\u026A\u02C8st\u026Al\u0259ri/</p>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:32, color:C.gold, marginBottom:20 }}>Distillery</h2>
        <p style={{ color:C.cream, lineHeight:1.8, fontSize:16, opacity:.85 }}>A place where raw, complex ingredients are subjected to heat and pressure, separated into their essential components, and refined into something pure, potent, and concentrated. The crude is transformed into the clear. The chaotic is reduced to its essence.</p>
        <blockquote style={{ borderLeft:`2px solid ${C.amber}`, margin:'30px 0 0 0', padding:'12px 24px', color:C.muted, fontFamily:font.serif, fontStyle:'italic', fontSize:15, lineHeight:1.7 }}>The distiller does not invent the spirit. The spirit was always there, hidden inside the grain. The distiller simply removes everything that is not the spirit.</blockquote>
      </section>

      {/* ---- DEFINITION II: QUANTUM DISTILLERY ---- */}
      <section className="qd-fade" style={{ maxWidth:780, margin:'0 auto', padding:'80px 24px', borderTop:`1px solid ${C.border}` }}>
        <p style={{ color:C.amber, fontSize:12, letterSpacing:'.3em', marginBottom:8 }}><span style={{ fontFamily:font.serif, fontStyle:'italic', fontSize:20, marginRight:8 }}>II</span>&nbsp;&nbsp;noun &bull; /\u02C8kw\u0252nt\u0259m d\u026A\u02C8st\u026Al\u0259ri/</p>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:32, color:C.gold, marginBottom:20 }}>The Quantum Distillery</h2>
        <p style={{ color:C.cream, lineHeight:1.8, fontSize:16, opacity:.85 }}>An intellectual framework where the deepest principles of mathematics, physics, and biology are distilled from their native complexity into accessible, interconnected understanding. We take the raw substrate of scientific knowledge \u2014 wave functions, thermodynamic gradients, enzyme kinetics, information entropy \u2014 and refine them into clear, potent insight about how life actually works, from the subatomic to the surgical.</p>
        <blockquote style={{ borderLeft:`2px solid ${C.amber}`, margin:'30px 0 0 0', padding:'12px 24px', color:C.muted, fontFamily:font.serif, fontStyle:'italic', fontSize:15, lineHeight:1.7 }}>Life is not chemistry. Life is not physics. Life is the conversation between them \u2014 and mathematics is the language they speak.</blockquote>
      </section>

      {/* ---- CONVERGENCE HEADER ---- */}
      <section className="qd-fade" style={{ textAlign:'center', padding:'80px 24px 40px' }}>
        <p style={{ color:C.amber, fontSize:12, letterSpacing:'.3em', textTransform:'uppercase', marginBottom:12 }}>The Convergence</p>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(24px,4vw,40px)', color:C.gold, marginBottom:16 }}>Understanding Life from Top to Bottom</h2>
        <p style={{ color:C.cream, maxWidth:680, margin:'0 auto', lineHeight:1.8, fontSize:16, opacity:.85 }}>Life cannot be fully understood from within a single discipline. It demands the convergence of three fundamental languages \u2014 each incomplete alone, each essential together. The Quantum Distillery exists at their intersection.</p>
      </section>

      {/* ---- CONVERGENCE LADDER ---- */}
      {[{role:'Foundation',name:'Mathematics',q:'What are the patterns that govern all systems?',a:'Mathematics is the language of structure itself. It gives us the tools to describe probability distributions governing electron behavior, the differential equations modeling cardiac rhythms, and the information theory underlying consciousness.',tags:['Information Theory','Topology','Stochastic Modeling','Bayesian Inference']},{role:'Mechanism',name:'Physics',q:'What forces and fields make life possible?',a:'Physics reveals the machinery beneath biology. Quantum tunneling drives enzyme catalysis. Proton gradients across mitochondrial membranes generate the electrochemical potential that powers every cell. Thermodynamic entropy dictates why living systems must constantly import energy or die.',tags:['Quantum Tunneling','Thermodynamics','Electrodynamics','Negative Entropy']},{role:'Expression',name:'Biology',q:'How does matter become alive?',a:'Biology is where mathematics and physics become visible. DNA encodes information. Proteins fold into functional machines governed by quantum forces. Neurons fire in patterns that somehow produce experience. Disease is not a biological failure alone \u2014 it is a failure of physics at the molecular scale.',tags:['Molecular Biology','Quantum Biology','Consciousness','Epoch #4']}].map((d,i) => (
        <section key={i} className="qd-fade" style={{ display:'grid', gridTemplateColumns:'280px 1fr', borderTop:`1px solid ${C.border}`, maxWidth:1100, margin:'0 auto' }}>
          <div style={{ padding:'60px 40px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <p style={{ color:C.amber, fontSize:11, letterSpacing:'.25em', textTransform:'uppercase', marginBottom:8 }}>{d.role}</p>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, color:C.white }}>{d.name}</h3>
          </div>
          <div style={{ padding:'60px 40px', borderLeft:`1px solid ${C.border}` }}>
            <p style={{ fontFamily:font.serif, fontStyle:'italic', fontSize:20, color:C.gold, marginBottom:16, lineHeight:1.5 }}>{d.q}</p>
            <p style={{ color:C.cream, lineHeight:1.8, fontSize:15, opacity:.85, marginBottom:24 }}>{d.a}</p>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:8 }}>
              {d.tags.map(t => (
                <span
                  key={t}
                  onClick={() => toggleTab(d.name, t)}
                  style={{
                    border: activeTabs[d.name] === t ? `1px solid ${C.amberBright}` : `1px solid ${C.border}`,
                    background: activeTabs[d.name] === t ? C.card : 'transparent',
                    color: activeTabs[d.name] === t ? C.amberBright : C.muted,
                    padding:'8px 18px',
                    fontSize:11,
                    letterSpacing:'.12em',
                    textTransform:'uppercase',
                    cursor:'pointer',
                    transition:'all .3s ease',
                    borderRadius:2,
                  }}
                >{t}</span>
              ))}
            </div>
            {d.tags.map(t => {
              const content = tabContent[t];
              if (!content) return null;
              const isOpen = activeTabs[d.name] === t;
              return (
                <div
                  key={t}
                  className={`qd-tab-content ${isOpen ? 'open' : ''}`}
                  style={{
                    background: C.surface,
                    borderLeft: `2px solid ${C.amber}`,
                    borderRadius: '0 4px 4px 0',
                    marginTop: isOpen ? 16 : 0,
                  }}
                >
                  <h4 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:C.gold, marginBottom:12 }}>{content.title}</h4>
                  <p style={{ color:C.cream, lineHeight:1.8, fontSize:14, opacity:.85, marginBottom:16 }}>{content.body}</p>
                  <p style={{ color:C.amber, lineHeight:1.7, fontSize:13, fontStyle:'italic', fontFamily:font.serif, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>{content.insight}</p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* ---- ORB DIAGRAM ---- */}
      <section className="qd-fade" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:24, padding:'80px 24px', flexWrap:'wrap' }}>
        {['Mathematics','Physics','Biology'].map((n,i) => (<>
          <div key={n} style={{ textAlign:'center' }}>
            <div className="qd-glow" style={{ width:100, height:100, borderRadius:'50%', border:`2px solid ${C.amber}`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', margin:'0 auto 12px' }}>
              <span style={{ color:C.gold, fontSize:13, fontWeight:600 }}>{n}</span>
            </div>
            <span style={{ color:C.muted, fontSize:11, letterSpacing:'.1em' }}>{['The Language','The Engine','The Expression'][i]}</span>
          </div>
          {i < 2 && <span style={{ color:C.amber, fontSize:28, fontWeight:300 }}>+</span>}
        </>))}
        <span style={{ color:C.amber, fontSize:28, fontWeight:300, margin:'0 12px' }}>=</span>
        <div style={{ textAlign:'center' }}>
          <div className="qd-glow" style={{ width:120, height:120, borderRadius:'50%', border:`2px solid ${C.gold}`, background:`radial-gradient(circle,${C.card},${C.bg})`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', margin:'0 auto 12px' }}>
            <span style={{ color:C.gold, fontSize:15, fontWeight:700 }}>Life</span>
            <span style={{ color:C.muted, fontSize:10 }}>Fully Understood</span>
          </div>
        </div>
      </section>

      {/* ---- TOOLS HEADER ---- */}
      <section className="qd-fade" style={{ textAlign:'center', padding:'80px 24px 40px', borderTop:`1px solid ${C.border}` }}>
        <p style={{ color:C.amber, fontSize:12, letterSpacing:'.3em', textTransform:'uppercase', marginBottom:12 }}>Distilled Tools</p>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(24px,4vw,40px)', color:C.gold, marginBottom:16 }}>From Understanding to Application</h2>
        <p style={{ color:C.cream, maxWidth:680, margin:'0 auto', lineHeight:1.8, fontSize:16, opacity:.85 }}>The Quantum Distillery produces instruments for learning and clinical practice \u2014 each one forged at the convergence of these disciplines.</p>
      </section>

      {/* ---- PRODUCT GRID ---- */}
      <section style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:24, maxWidth:1100, margin:'0 auto', padding:'0 24px 80px' }}>
        {[{icon:'\uD83D\uDC89',name:'SedSim',desc:'High-fidelity anesthesia and sedation simulation. Real-time vital sign modeling, AI clinical mentor, and pharmacokinetic engine for oral surgery training.',live:true},{icon:'\uD83D\uDCDA',name:'The Learning Shed',desc:'AI-powered didactic engine with Socratic, Narrative, and Visual pedagogical agents. Phase 1 of the AI Pedagogical Synergy Study. Content learning, distilled.',live:false},{icon:'\uD83E\uDD16',name:'AI Assist Lab',desc:'Investigating how AI should assist during live sedation. Passive alerting, conversational co-pilot, and predictive dashboard modalities under clinical evaluation.',live:false},{icon:'\u269B\uFE0F',name:'It from Qubit',desc:'Quantum biology, information theory, and the Epoch #4 framework. Exploring how energy becomes information, how information becomes life, and what that means for medicine.',live:false}].map(p => (
          <div key={p.name} className="qd-card qd-fade" style={{ background:C.card, border:`1px solid ${C.border}`, padding:32, transition:'background .3s', position:'relative' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <span style={{ fontSize:10, letterSpacing:'.15em', textTransform:'uppercase', color: p.live ? C.amber : C.dim, border:`1px solid ${p.live ? C.amber : C.dim}`, padding:'4px 10px' }}>{p.live ? 'Live' : 'Coming Soon'}</span>
              <span style={{ fontSize:32 }}>{p.icon}</span>
            </div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:C.white, marginBottom:12 }}>{p.name}</h3>
            <p style={{ color:C.muted, lineHeight:1.7, fontSize:14 }}>{p.desc}</p>
            {p.live && <button onClick={() => navigate('/sim')} className="qd-btn" style={{ background:C.amber, color:C.bg, border:'none', padding:'14px 32px', fontSize:13, letterSpacing:'.12em', textTransform:'uppercase', fontFamily:font.sans, fontWeight:700, cursor:'pointer', marginTop:20, textAlign:'center', transition:'all .2s' }}>Launch SedSim \u2192</button>}
          </div>
        ))}
      </section>

      {/* ---- RESEARCH BANNER ---- */}
      <section className="qd-fade" style={{ maxWidth:900, margin:'0 auto', padding:'80px 24px', textAlign:'center', borderTop:`1px solid ${C.border}` }}>
        <p style={{ color:C.amber, fontSize:12, letterSpacing:'.3em', textTransform:'uppercase', marginBottom:12 }}>Active Research</p>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(24px,4vw,36px)', color:C.gold, marginBottom:16 }}>The AI Pedagogical Synergy Study</h2>
        <p style={{ color:C.cream, maxWidth:700, margin:'0 auto 30px', lineHeight:1.8, fontSize:15, opacity:.85 }}>A closed-loop investigation evaluating how distinct AI teaching personas affect knowledge acquisition and clinical performance across students, residents, and attendings. Validated using Kirkpatrick evaluation and NASA-TLX cognitive load metrics. From the didactic to the simulated to the surgical.</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          {['Kirkpatrick Model','NASA-TLX','Cognitive Load Theory','SedSim Platform','Operant.ai'].map(t => <span key={t} style={{ border:`1px solid ${C.border}`, color:C.muted, padding:'8px 18px', fontSize:11, letterSpacing:'.12em', textTransform:'uppercase' }}>{t}</span>)}
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer style={{ textAlign:'center', padding:'40px 24px', borderTop:`1px solid ${C.border}` }}>
        <p style={{ color:C.dim, fontSize:12, letterSpacing:'.15em', marginBottom:8 }}>The Quantum Distillery \u00A9 2026 \u2022 Thad Connelly MD DDS PhD</p>
        <p style={{ color:C.dim, fontSize:11, letterSpacing:'.1em' }}>GengyveUSA \u2022 Boutique Venture Partners \u2022 San Francisco</p>
      </footer>

    </div>
  );
}
