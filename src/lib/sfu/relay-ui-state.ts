type RelayUiStatus =
  | "IDLE"
  | "CAN_REQUEST"
  | "REQUESTING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "DENIED"
  | "RELAY_ACTIVE"

type RelayUiState = {
  status: RelayUiStatus
  bannerText: string
  requestButtonEnabled: boolean
  approvalDialogVisible: boolean
  pendingRequestId: string | null
}

const initialRelayUiState: RelayUiState = {
  status: "IDLE",
  bannerText: "",
  requestButtonEnabled: false,
  approvalDialogVisible: false,
  pendingRequestId: null,
}

export type RelayUiController = {
  getState(): RelayUiState
  onIceFailure(): RelayUiState
  onRelayRequestSent(requestId: string): RelayUiState
  onRelayDecision(approved: boolean): RelayUiState
  onRelayStarted(): RelayUiState
  onRelayStopped(): RelayUiState
  onHostApprovalPrompt(requestId: string): RelayUiState
}

export function createRelayUiController(): RelayUiController {
  let state = initialRelayUiState

  return {
    getState() {
      return state
    },
    onIceFailure() {
      state = {
        ...state,
        status: "CAN_REQUEST",
        bannerText: "Direct connection failed. Request relay access from a sharer?",
        requestButtonEnabled: true,
      }
      return state
    },
    onRelayRequestSent(requestId: string) {
      state = {
        ...state,
        status: "PENDING_APPROVAL",
        bannerText: "Relay request sent. Waiting for host decision.",
        requestButtonEnabled: false,
        pendingRequestId: requestId,
      }
      return state
    },
    onRelayDecision(approved: boolean) {
      state = {
        ...state,
        status: approved ? "APPROVED" : "DENIED",
        bannerText: approved
          ? "Relay approved. Connecting..."
          : "Relay request denied. You can continue audio-only.",
        requestButtonEnabled: !approved,
      }
      return state
    },
    onRelayStarted() {
      state = {
        ...state,
        status: "RELAY_ACTIVE",
        bannerText: "Relay active. Using host hours.",
        requestButtonEnabled: false,
      }
      return state
    },
    onRelayStopped() {
      state = {
        ...state,
        status: "IDLE",
        bannerText: "",
        requestButtonEnabled: false,
        pendingRequestId: null,
      }
      return state
    },
    onHostApprovalPrompt(requestId: string) {
      state = {
        ...state,
        approvalDialogVisible: true,
        pendingRequestId: requestId,
      }
      return state
    },
  }
}
