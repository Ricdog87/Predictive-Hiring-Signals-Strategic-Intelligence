/**
 * Compatibility shim — `uiDerivations` is preserved as a re-export surface
 * for older imports. New code should import from `lib/marketView` (company
 * view-models), `lib/marketIntelligence` (market styles + signal labels),
 * or `lib/uiContracts/market` (contract types).
 */

export {
  TEMPERATURE_STYLES,
  TREND_STYLES,
  LEVEL_STYLES,
  signalTypeLabel as categoryLabelOf,
  signalTypeAttention as getCategoryAttention,
} from "./marketIntelligence";

export {
  classifyStrength,
  classifyConfidence,
  classifyForecastBand,
  type Strength,
  type ConfidenceTier,
  type ForecastBand,
} from "./marketView";
