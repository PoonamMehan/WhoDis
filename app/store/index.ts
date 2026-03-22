import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import sessionReducer from "./slices/sessionSlice";
import qnaReducer from "./slices/qnaSlice";
import personaReducer from "./slices/personaSlice";

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    qna: qnaReducer,
    persona: personaReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
