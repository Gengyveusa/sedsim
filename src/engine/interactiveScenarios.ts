import { InteractiveScenario } from './ScenarioEngine';
import { EASY_SCENARIOS } from './scenarios/easyScenarios';
import { MODERATE_SCENARIOS } from './scenarios/moderateScenarios';
import { HARD_SCENARIOS } from './scenarios/hardScenarios';
import { EXPERT_SCENARIOS } from './scenarios/expertScenarios';

export const INTERACTIVE_SCENARIOS: InteractiveScenario[] = [
  ...EASY_SCENARIOS,
  ...MODERATE_SCENARIOS,
  ...HARD_SCENARIOS,
  ...EXPERT_SCENARIOS,
];

export { EASY_SCENARIOS, MODERATE_SCENARIOS, HARD_SCENARIOS, EXPERT_SCENARIOS };
export * from './scenarios/easyScenarios';
export * from './scenarios/moderateScenarios';
export * from './scenarios/hardScenarios';
export * from './scenarios/expertScenarios';
