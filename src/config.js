const dotenv = require("dotenv");
dotenv.config();

module.exports = {
  serverurl: process.env.REACT_APP_SERVER_URL,
  port: process.env.REACT_APP_PORT,
};
