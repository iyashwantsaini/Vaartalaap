import { configureStore, createSlice } from "@reduxjs/toolkit";

// to switch tabs in a room
const tempSlice = createSlice({
  name: "switch",
  initialState: {
    tab: "text", //text,code,chat
  },
  reducers: {
    switchTab: (state, action) => {
      state.tab = action.payload;
    },
  },
});

// complete state store
const store = configureStore({
  reducer: {
    tab: tempSlice.reducer,
  },
});

export const tempActions = tempSlice.actions; // to change tab
export default store;
