import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Phase = "input" | "loading" | "chat";

interface SessionState {
  username: string;
  phase: Phase;
  loadingStatus: string;
  profileData: unknown;
  sessionId: string;
  summary: string;
  error: string;
}

const initialState: SessionState = {
  username: "",
  phase: "input",
  loadingStatus: "",
  profileData: null,
  sessionId: "",
  summary: "",
  error: "",
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setUsername(state, action: PayloadAction<string>) {
      state.username = action.payload;
    },
    setPhase(state, action: PayloadAction<Phase>) {
      state.phase = action.payload;
    },
    setLoadingStatus(state, action: PayloadAction<string>) {
      state.loadingStatus = action.payload;
    },
    setProfileData(state, action: PayloadAction<unknown>) {
      state.profileData = action.payload;
    },
    setSessionId(state, action: PayloadAction<string>) {
      state.sessionId = action.payload;
    },
    setSummary(state, action: PayloadAction<string>) {
      state.summary = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    resetSession() {
      return initialState;
    },
  },
});

export const {
  setUsername,
  setPhase,
  setLoadingStatus,
  setProfileData,
  setSessionId,
  setSummary,
  setError,
  resetSession,
} = sessionSlice.actions;

export default sessionSlice.reducer;
