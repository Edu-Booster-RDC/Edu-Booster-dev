const express = require("express");
require("dotenv").config();
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Api is Working");
});

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
