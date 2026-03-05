import { InteractiveScenario, jsonScenarioToInteractive } from './ScenarioEngine';
import { EASY_SCENARIOS } from './scenarios/easyScenarios';
import { MODERATE_SCENARIOS } from './scenarios/moderateScenarios';
import { HARD_SCENARIOS } from './scenarios/hardScenarios';
import { EXPERT_SCENARIOS } from './scenarios/expertScenarios';
import { BLS_SCENARIOS_ARRAY } from './scenarios/blsScenarios';
import type { SedSimScenario } from './SedSimCase.types';
import colonoscopyAsa1Json from './scenarios/colonoscopy_asa1.json';
import colonoscopyAsa3Json from './scenarios/colonoscopy_asa3_chf_sensitive.json';

// Convert JSON scenarios to InteractiveScenario (with jsonSource attached for scoring)
function fromJson(raw: unknown): InteractiveScenario {
  const json = raw as SedSimScenario;
  const scenario = jsonScenarioToInteractive(json);
  scenario.jsonSource = json;
  return scenario;
}

export const COLONOSCOPY_ASA1: InteractiveScenario = fromJson(colonoscopyAsa1Json);
export const COLONOSCOPY_ASA3_CHF: InteractiveScenario = fromJson(colonoscopyAsa3Json);

export const JSON_SCENARIOS: InteractiveScenario[] = [
  COLONOSCOPY_ASA1,
  COLONOSCOPY_ASA3_CHF,
];

export const INTERACTIVE_SCENARIOS: InteractiveScenario[] = [
  ...JSON_SCENARIOS,
  ...EASY_SCENARIOS,
  ...MODERATE_SCENARIOS,
  ...HARD_SCENARIOS,
  ...EXPERT_SCENARIOS,
  ...BLS_SCENARIOS_ARRAY,
];

export { EASY_SCENARIOS, MODERATE_SCENARIOS, HARD_SCENARIOS, EXPERT_SCENARIOS };
export * from './scenarios/easyScenarios';
export * from './scenarios/moderateScenarios';
export * from './scenarios/hardScenarios';
export * from './scenarios/expertScenarios';
export * from './scenarios/blsScenarios';
