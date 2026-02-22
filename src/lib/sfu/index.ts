export { SFU_CONFIG } from "@/lib/sfu/config"
export {
  createSFUConnection,
  applySimulcast,
  setVideoProfile,
  applySubscriptionQualityPolicy,
  detectRelayUsage,
  enableRelayForParticipant,
  hostApproveRelay,
  fetchTurnToken,
  deductCreditsTick,
  enforceRelayCaps,
  startRelayCreditTick,
} from "@/lib/sfu/sfu-client"
export type { SfuConnection } from "@/lib/sfu/sfu-client"
export { createRelayUiController } from "@/lib/sfu/relay-ui-state"
export {
  createInitialSubscriptionState,
  consumeBankMinutes,
  renewSubscription,
  sampleSubscriptionStateJson,
} from "@/lib/sfu/subscription-state-machine"
