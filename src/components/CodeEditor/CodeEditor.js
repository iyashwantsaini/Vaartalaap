import { useState, useEffect } from "react";
import "./CodeEditor.css";
import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import SlowMotionVideoIcon from "@material-ui/icons/SlowMotionVideo";
import Textarea from "muicss/lib/react/textarea";
import Button from "@material-ui/core/Button";
import { CodeMirrorBinding } from "y-codemirror";
import { UnControlled as CodeMirror } from "react-codemirror2";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";

import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
import { randomHexColor } from "random-hex-color-generator";
import "./CodeEditorAddons";
import setLanguageMode from "../../data/languageMapping";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
}));

const Editor = (props) => {
  const [EditorRef, setEditorRef] = useState(null);
  const [codeWritten, setCodeWritten] = useState(``);
  const [inputArgs, setInputArgs] = useState(``);
  const [outputPiston, setOutputPiston] = useState(``);
  const [cmdLineArgs, setCmdLineArgs] = useState(``);
  const classes = useStyles();
  const [languageObject, setLanguageObject] = useState({});
  const { roomID } = useParams();

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

  const handleEditorDidMount = (editor) => {
    window.editor = editor;
    setEditorRef(editor);
  };
  const { language, fontSize, theme, keybinds } = useSelector(
    (state) => state.codeEditorConfig
  );
  // console.log(language, fontSize, theme, keybinds);
  const username = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
  });

  useEffect(() => {
    if (EditorRef) {
      const ydoc = new Y.Doc();
      const yText = ydoc.getText("codemirror");
      const yUndoManager = new Y.UndoManager(yText);

      let provider;
      try {
        provider = new WebrtcProvider(roomID, ydoc, {
          signaling: [
            "wss://signaling.yjs.dev",
            "wss://y-webrtc-signaling-eu.herokuapp.com",
            "wss://y-webrtc-signaling-us.herokuapp.com",
          ],
        });
      } catch (err) {}

      const awareness = provider.awareness;
      const val = randomHexColor();
      awareness.setLocalStateField("user", {
        name: username,
        color: val,
      });

      const getBinding = new CodeMirrorBinding(yText, EditorRef, awareness, {
        yUndoManager,
      });

      return () => {
        if (provider) {
          provider.disconnect();
          ydoc.destroy();
        }
      };
    }
  }, [EditorRef]);

  return (
    <div className={`container editor-main ${classes.root}`}>
      <Grid container spacing={0}>
        <Grid item xs={12} sm={12} md={12} lg={12}>
          <div className="container_editor_area">
            <div
              style={{
                textAlign: "left",
                width: "100%",
              }}
            >
              <CodeMirror
                autoScroll
                options={{
                  mode: setLanguageMode(languageObject.language)
                    ? setLanguageMode(languageObject.language)
                    : "text/x-c++src",
                  theme: theme,
                  keyMap: keybinds,
                  lineWrapping: true,
                  smartIndent: true,
                  lineNumbers: true,
                  foldGutter: true,
                  height: 500,
                  tabSize: 2,
                  gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
                  autoCloseTags: true,
                  matchBrackets: true,
                  autoCloseBrackets: true,
                  extraKeys: {
                    "Ctrl-Space": "autocomplete",
                  },
                }}
                editorDidMount={(editor) => {
                  handleEditorDidMount(editor);
                  editor.setSize("100%", "100%");
                }}
                onChange={handleCodeChange}
              />
            </div>
          </div>
        </Grid>
      </Grid>

      <div className="button">
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
