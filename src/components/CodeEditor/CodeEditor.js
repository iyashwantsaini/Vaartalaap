// https://www.thegreatcodeadventure.com/real-time-react-with-socket-io-building-a-pair-programming-app/

import { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import "codemirror/addon/display/autorefresh";
import "codemirror/addon/comment/comment";
import "codemirror/addon/edit/matchbrackets";
import "codemirror/keymap/sublime";
import "codemirror/theme/monokai.css";
import "./CodeEditor.css";
import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import SlowMotionVideoIcon from "@material-ui/icons/SlowMotionVideo";
import Textarea from "muicss/lib/react/textarea";
import Button from "@material-ui/core/Button";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
}));

const Editor = (props) => {
  const [codeWritten, setCodeWritten] = useState(``);
  const [inputArgs, setInputArgs] = useState(``);
  const [outputPiston, setOutputPiston] = useState(``);
  const [cmdLineArgs, setCmdLineArgs] = useState(``);
  const classes = useStyles();
  const [languageObject, setLanguageObject] = useState({});

  useEffect(() => {
    setLanguageObject(props.language);
    setCodeWritten(props.language.pretext);
  }, [props]);

  const handleCodeChange = (e) => {
    setCodeWritten(e.doc.getValue());
  };

  const handleCmdLineChange = (e) => {
    setCmdLineArgs(e.target.value);
  };
  const handleInputChange = (e) => {
    setInputArgs(e.target.value);
  };

  const handleOutputChange = (e) => {
    // console.log(e.target.value);
  };

  const submitCodeHandler = () => {
    var raw = JSON.stringify({
      language: String(languageObject.language),
      version: String(languageObject.version),
      stdin: String(inputArgs),
      args: String(cmdLineArgs),
      files: [
        {
          name: `file`,
          content: String(codeWritten),
        },
      ],
    });

    var requestOptions = {
      method: "POST",
      body: raw,
      redirect: "follow",
    };

    fetch("https://emkc.org/api/v2/piston/execute", requestOptions)
      .then((response) => response.text())
      .then((result) => {
        result = JSON.parse(result);
        setOutputPiston(`${result.run.output}`);
      })
      .catch((error) => {
        setOutputPiston(`${error}`);
      });
  };

  return (
    <div className={`container editor-main ${classes.root}`}>
      <Grid container spacing={0}>
        <Grid item xs={12} sm={12} md={12} lg={12}>
          <div className="container_editor_area">
            <CodeMirror
              autoScroll
              value={codeWritten}
              height={500}
              tabSize={2}
              lineWrapping={true}
              smartIndent={true}
              lineNumbers={true}
              foldGutter={true}
              gutters={["CodeMirror-linenumbers", "CodeMirror-foldgutter"]}
              autoCloseTags={true}
              matchBrackets={true}
              autoCloseBrackets={true}
              extraKeys={{
                "Ctrl-Space": "autocomplete",
              }}
              options={{
                theme: "monokai",
                keyMap: "sublime",
                mode: languageObject.language,
              }}
              onChange={handleCodeChange}
            />
          </div>
        </Grid>
      </Grid>

      <div className="button">
        {/* <span id="start" onClick={submitCodeHandler}>
              Submit
        </span> */}
        <Button
          variant="contained"
          color="secondary"
          startIcon={<SlowMotionVideoIcon />}
          onClick={submitCodeHandler}
        >
          Submit
        </Button>
      </div>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={12} md={4} lg={4}>
          <Textarea
            onChange={handleInputChange}
            label="Input"
            name={"input-args"}
            rows={6}
            className="other-sections"
          />
        </Grid>

        <Grid item xs={12} sm={12} md={4} lg={4}>
          <Textarea
            onChange={handleCmdLineChange}
            label="Command Line Arguments"
            name={"cmdline-args"}
            rows={6}
            className="other-sections"
          />
        </Grid>

        <Grid item xs={12} sm={12} md={4} lg={4}>
          <Textarea
            onChange={handleOutputChange}
            value={outputPiston}
            label="Output"
            name={"output-received"}
            rows={6}
            className="other-sections"
          />
        </Grid>
      </Grid>
    </div>
  );
};

export default Editor;
