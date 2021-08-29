import "./App.css";
import GRID from "./components/GRID/GRID";
import HomePage from "./pages/HomePage/HomePage";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

const App = () => {
  return (
    <Router>
      <Switch>
        <Route path="/" exact component={HomePage} />
        <Route path="/room/:roomID">
          <GRID />
        </Route>
      </Switch>
    </Router>
  );
};

export default App;
