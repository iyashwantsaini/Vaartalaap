import "./RoomPage.css";
import TextEditor from "../../components/TextEditor/TextEditor";
import CodeEditor from "../../components/CodeEditor/CodeEditor";
import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import Button from "@material-ui/core/Button";
import HomeIcon from "@material-ui/icons/Home";
import PropTypes from "prop-types";
import { makeStyles } from "@material-ui/core/styles";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Select from "react-select";
import languages from "../../data/languages";

const TabPanel = (props) => {
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
};

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};

const editorTabsProps = (index) => {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
};

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

const SwitchTab = () => {
  const history = useHistory();
  const classes = useStyles();
  const [value, setValue] = React.useState(0);
  const [languagesAvailable, setLanguagesAvailable] = useState([]);
  const [currentLang, setCurrentLang] = useState({});

  useEffect(() => {
    const transformedData = languages.map((lang) => {
      return {
        value: lang.language,
        label: lang.language,
        language: lang.language,
        version: lang.version,
        pretext: lang.pretext,
      };
    });
    setLanguagesAvailable(transformedData);
    setCurrentLang(transformedData[11]);
  }, []);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const languageChangeHandler = (e) => {
    setCurrentLang({
      label: e.value,
      value: e.value,
      language: e.language,
      version: e.version,
      pretext: e.pretext,
    });
  };

  //move to home tab
  const goToHomeHandler = () => {
    history.push("/");
  };

  return (
    <div className={`working-space ${classes.root}`}>
      <AppBar position="static">
        <Tabs value={value} onChange={handleChange}>
          <Tab label="Text Editor" {...editorTabsProps(0)} />
          <Tab label="Code Editor" {...editorTabsProps(1)} />
        </Tabs>
      </AppBar>
      <TabPanel value={value} index={1}>
        <Grid container spacing={0}>
          <Grid item xs={12} sm={6} md={2} lg={2}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<HomeIcon />}
              onClick={goToHomeHandler}
            >
              Home
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={2} lg={2}>
            <Select
              onChange={languageChangeHandler}
              defaultValue={languagesAvailable[11]}
              options={languagesAvailable}
            />
          </Grid>
        </Grid>
        <CodeEditor language={currentLang} />
      </TabPanel>
      <TabPanel value={value} index={0}>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<HomeIcon />}
          onClick={goToHomeHandler}
        >
          Home
        </Button>
        <TextEditor />
      </TabPanel>
    </div>
  );
};

export default SwitchTab;
