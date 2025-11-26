import { Routes, Route } from "react-router-dom";
import { LandingRoute } from "./routes/Landing";
import { RoomRoute } from "./routes/Room";

export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/room/:roomId" element={<RoomRoute />} />
    </Routes>
  );
};

export default App;
