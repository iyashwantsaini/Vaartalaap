import { configureStore, createSlice } from "@reduxjs/toolkit";

const codeEditorConfigSlice = createSlice({
  name: "codeEditorConfig",
  initialState: {
    language: "text/x-c++src",
    fontSize: 18,
    theme: "monokai",
    keybinds: "sublime",
  },
  reducers: {
    changeLang: (state, action) => {
      state.language = action.payload;
    },
    changeFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    changeTheme: (state, action) => {
      state.theme = action.payload;
    },
    changeKeyBindings: (state, action) => {
      state.keybinds = action.payload;
    },
  },
});

// complete state store
const store = configureStore({
  reducer: {
    codeEditorConfig: codeEditorConfigSlice.reducer,
  },
});

export const codeEditorConfigActions = codeEditorConfigSlice.actions;
export default store;
