import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type PersonaProfile = {
  traits: string;
  writingStyle: string;
  languagePatterns: string;
  topicsAndInterests: string;
  opinionsAndStances: string;
  humorStyle: string;
  conversationalTics: string;
  summary: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
};

interface PersonaState {
  isPersonaOpen: boolean;
  personaProfile: PersonaProfile | null;
  isPersonaLoading: boolean;
  personaMessages: Message[];
  personaInput: string;
  isPersonaStreaming: boolean;
  personaError: string;
}

const initialState: PersonaState = {
  isPersonaOpen: false,
  personaProfile: null,
  isPersonaLoading: false,
  personaMessages: [],
  personaInput: "",
  isPersonaStreaming: false,
  personaError: "",
};

const personaSlice = createSlice({
  name: "persona",
  initialState,
  reducers: {
    openPersona(state) {
      state.isPersonaOpen = true;
    },
    closePersona(state) {
      state.isPersonaOpen = false;
    },
    setPersonaProfile(state, action: PayloadAction<PersonaProfile>) {
      state.personaProfile = action.payload;
    },
    setIsPersonaLoading(state, action: PayloadAction<boolean>) {
      state.isPersonaLoading = action.payload;
    },
    addPersonaMessage(state, action: PayloadAction<Message>) {
      state.personaMessages.push(action.payload);
    },
    updateLastPersonaMessage(state, action: PayloadAction<string>) {
      if (state.personaMessages.length > 0) {
        state.personaMessages[state.personaMessages.length - 1].content =
          action.payload;
      }
    },
    setPersonaInput(state, action: PayloadAction<string>) {
      state.personaInput = action.payload;
    },
    setIsPersonaStreaming(state, action: PayloadAction<boolean>) {
      state.isPersonaStreaming = action.payload;
    },
    setPersonaError(state, action: PayloadAction<string>) {
      state.personaError = action.payload;
    },
    resetPersona() {
      return initialState;
    },
  },
});

export const {
  openPersona,
  closePersona,
  setPersonaProfile,
  setIsPersonaLoading,
  addPersonaMessage,
  updateLastPersonaMessage,
  setPersonaInput,
  setIsPersonaStreaming,
  setPersonaError,
  resetPersona,
} = personaSlice.actions;

export default personaSlice.reducer;
