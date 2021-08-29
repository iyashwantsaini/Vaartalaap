import "./GRID.css";
import RoomPage from "../../pages/RoomPage/RoomPage";
import WebRTC from "../WebRTC/WebRTC";
import Grid from "@material-ui/core/Grid";
import PropTypes from "prop-types";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import React from "react";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import { makeStyles } from "@material-ui/core/styles";

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={3}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};

function callCollabProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

const GRID = () => {
  const classes = useStyles();
  const [value, setValue] = React.useState(0);
  const handleChange = (event, newValue) => {
    setValue(newValue);
  };
  return (
    <Grid container spacing={0}>
      <Grid item xs={12} sm={12} md={9} lg={9}>
        <RoomPage />
      </Grid>
      <Grid item xs={12} sm={12} md={3} lg={3}>
        <div className={`${classes.root}`}>
          <AppBar position="static">
            <Tabs value={value} onChange={handleChange}>
              <Tab label="Video Call" {...callCollabProps(0)} />
            </Tabs>
          </AppBar>
          <TabPanel value={value} index={0}>
            <WebRTC />
          </TabPanel>
        </div>
      </Grid>
    </Grid>
  );
};

export default GRID;
