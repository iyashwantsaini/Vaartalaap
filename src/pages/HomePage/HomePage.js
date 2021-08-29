import React, { useEffect, useState } from "react";
import { v1 as uuid } from "uuid";
import "./HomePage.css";

const HomePage = (props) => {
  const [loading, setLoading] = useState(true);
  const createRoomAndNavigate = () => {
    const id = uuid();
    props.history.push(`/room/${id}`);
  };

  useEffect(() => {
    try {
      setTimeout(() => {
        setLoading(false);
      }, 3500);
    } catch (err) {
      setLoading(false);
    }
  }, []);

  return (
    <div>
      {loading && (
        <div>
          <div class="container-loader">
            <div class="ball"></div>
            <div class="ball"></div>
            <div class="ball"></div>
            <div class="ball"></div>
            <div class="ball"></div>
            <div class="ball"></div>
            <div class="ball"></div>
          </div>
        </div>
      )}
      {!loading && (
        <div>
          <div id="homepage">
            <h1>
              <span id="main-head-name">VAARTALAAP</span>
              <br />
            </h1>
            <h2>
              <span id="start" onClick={createRoomAndNavigate}>
                Create Room
              </span>
            </h2>
          </div>
          <div id="content">
            <div id="overlay">
              <div class="time pause">
                <div class="btn pause">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" class="shape" />
                    <path d="M0 0h24v24H0z" fill="none" />
                  </svg>
                </div>
                <div class="btn play">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" class="shape" />
                    <path d="M0 0h24v24H0z" fill="none" />
                  </svg>
                </div>
              </div>
              <div class="color">
                <div class="btn">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path
                      d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
                      class="shape"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <canvas id="canvas"></canvas>
            <div id="range">
              <input type="range" value="50" min="0" max="100" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
