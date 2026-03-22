import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

interface QnaState {
  messages: Message[];
  currentInput: string;
  isStreaming: boolean;
}

const initialState: QnaState = {
  messages: [],
  currentInput: "",
  isStreaming: false,
};

const qnaSlice = createSlice({
  name: "qna",
  initialState,
  reducers: {
    setMessages(state, action: PayloadAction<Message[]>) {
      state.messages = action.payload;
    },
    addMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload);
    },
    updateLastMessage(state, action: PayloadAction<string>) {
      if (state.messages.length > 0) {
        state.messages[state.messages.length - 1].content = action.payload;
      }
    },
    setCurrentInput(state, action: PayloadAction<string>) {
      state.currentInput = action.payload;
    },
    setIsStreaming(state, action: PayloadAction<boolean>) {
      state.isStreaming = action.payload;
    },
    resetQna() {
      return initialState;
    },
  },
});

export const {
  setMessages,
  addMessage,
  updateLastMessage,
  setCurrentInput,
  setIsStreaming,
  resetQna,
} = qnaSlice.actions;

export default qnaSlice.reducer;
