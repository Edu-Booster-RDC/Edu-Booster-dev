const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { notFound, errorHandler } = require("./middlewares/error");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const uplaod = require("express-fileupload");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(uplaod());
app.use("/uploads", express.static(__dirname + "/uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

app.get("/", (req, res) => {
  res.send("Api is warkin");
});

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});

module.exports = app;
