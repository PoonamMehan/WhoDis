import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Phase = "input" | "loading" | "chat";

interface SessionState {
  username: string;
  phase: Phase;
  loadingStatus: string;
  profileData: unknown;
  error: string;
}

const initialState: SessionState = {
  username: "",
  phase: "input",
  loadingStatus: "",
  profileData: null,
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
  setError,
  resetSession,
} = sessionSlice.actions;

export default sessionSlice.reducer;
