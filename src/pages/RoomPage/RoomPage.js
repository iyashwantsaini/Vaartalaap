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
import themes from "../../data/themes";
import keymaps from "../../data/keymaps";
import { useDispatch } from "react-redux";
import { codeEditorConfigActions } from "../../store/index";
import clsx from "clsx";
import { withStyles } from "@material-ui/core/styles";

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
  buttons: {
    // background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
    // background:"black",
    // borderRadius: 3,
    // border: 0,
    // color: "white",
    // height: 48,
  },
}));

const SwitchTab = () => {
  const history = useHistory();
  const classes = useStyles();
  const [value, setValue] = React.useState(0);
  const [languagesAvailable, setLanguagesAvailable] = useState([]);
  const [themesAvailable, setThemesAvailable] = useState([]);
  const [keyMapsAvailable, setKeyMapsAvailable] = useState([]);
  const [currentLang, setCurrentLang] = useState({});
  const dispatch = useDispatch();

  useEffect(() => {
    const transformedlanguageData = languages.map((lang) => {
      return {
        value: lang.language,
        label: lang.language,
        language: lang.language,
        version: lang.version,
        pretext: lang.pretext,
      };
    });
    setLanguagesAvailable(transformedlanguageData);
    setCurrentLang(transformedlanguageData[11]);
  }, []);

  useEffect(() => {
    const transformedthemeData = themes.map((theme) => {
      return {
        value: theme,
        label: theme,
      };
    });
    setThemesAvailable(transformedthemeData);
  }, []);

  useEffect(() => {
    const transformedKeyMapsData = keymaps.map((keymap) => {
      return {
        value: keymap,
        label: keymap,
      };
    });
    setKeyMapsAvailable(transformedKeyMapsData);
  }, []);

  const handleTabChange = (event, newValue) => {
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

  const themeChangeHandler = (e) => {
    dispatch(codeEditorConfigActions.changeTheme(e.value));
  };

  const keymapsChangeHandler = (e) => {
    dispatch(codeEditorConfigActions.changeKeyBindings(e.value));
  };

  //move to home tab
  const goToHomeHandler = () => {
    history.push("/");
  };

  return (
    <div className={`working-space ${classes.root}`}>
      <AppBar position="static">
        <Tabs value={value} onChange={handleTabChange}>
          <Tab label="Text Editor" {...editorTabsProps(0)} />
          <Tab label="Code Editor" {...editorTabsProps(1)} />
        </Tabs>
      </AppBar>
      <TabPanel value={value} index={1}>
        <Grid container spacing={0}>
          <Grid item xs={12} sm={3} md={2} lg={2}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<HomeIcon />}
              onClick={goToHomeHandler}
              className={clsx(classes.buttons)}
            >
              Home
            </Button>
          </Grid>
          <Grid item xs={12} sm={3} md={2} lg={2}>
            <div className="react-select-drops">
              <Select
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                onChange={languageChangeHandler}
                defaultValue={languagesAvailable[11]}
                options={languagesAvailable}
              />
            </div>
          </Grid>
          <Grid item xs={12} sm={3} md={2} lg={2}>
            <div className="react-select-drops">
              <Select
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                onChange={themeChangeHandler}
                defaultValue={themesAvailable[0]}
                options={themesAvailable}
              />
            </div>
          </Grid>
          <Grid item xs={12} sm={3} md={2} lg={2}>
            <div className="react-select-drops">
              <Select
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                onChange={keymapsChangeHandler}
                defaultValue={keyMapsAvailable[0]}
                options={keyMapsAvailable}
              />
            </div>
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
