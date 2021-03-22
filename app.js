require("dotenv").config();

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var app = express();
var timeout = require("connect-timeout");

// view engine setup - envirroment setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(timeout(60000));
app.use(haltOnTimedout);

function haltOnTimedout(req, res, next) {
  if (!req.timedout) {
    next();
  } else {
    req.statusCode(408).json({
      message: "request time out",
    });
  }
}

const jwt = require("jsonwebtoken");
app.use(express.json());

// data
const users = [
  { username: "Daniel", title: "Daniel and friends", password: "123123" },
  { username: "Henry", title: "Henry and his girl friend", password: "123123" },
];
const refreshTokens = []

// simple route
app.get("/", authenticateToken, (req, res) => {
  res.status(200).json({ message: "Welcome to hello express jwt.", error: false });
});

app.get("/user", authenticateToken, (req, res) => {
  res.status(200).json(users.filter((user) => user.username === req.user.username));
});

app.post("/login", (req, res) => {
  // authenticate user
  const username = req.body.username;
  const password = req.body.password;
  const exitUser = users.filter((user) => {
    return user.username === username ? user : "";
  });
  if (exitUser.length > 0) {
    const exitUserPassword = JSON.parse(exitUser[0].password);
    const isCorrectPassword = exitUserPassword.toString() === password;
    if (isCorrectPassword) {
      const accessToken = generateAccessToken(exitUser[0])
      const refreshToken = jwt.sign(exitUser[0], process.env.REFRESH_TOKEN_SECRET)
      refreshTokens.push(refreshToken)
      res.status(200).json({ accessToken: accessToken, refreshToken: refreshToken, error: false });
      res.end();
    } else {
      res.status(403).json({ message: "wrong password", error: true });
      res.end();
    }
  } else {
    res.status(404).json({ message: "user not found", error: true });
    res.end();
  }
});

app.post("/register", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const title = req.body.title;
  if (!username || !password || !title) {
    return res.status(411).json({ message: "paramester is invalid", error: true });
  } else {
    const isExitUser = users.filter((user) => {
      if (user.username.toString() === username.toString()) {
        return true;
      }
    });
    if (isExitUser.length > 0) {
      res.status(404).json({ error: "user is already exits", error: true });
    } else {
      // authenticate user
      const user = {
        username,
        password,
        title,
      };
      const token = generateAccessToken(user);
      const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET)
      users.push(user);
      refreshTokens.push(refreshToken)
      res.status(200).json({ accessToken: token, refreshToken: refreshToken, error: false });
    }
  }
});

app.post('/token', (req, res) => {
  const refreshToken = req.body.refreshToken
  if (!refreshToken) return res.status(403).json({ message: "token param is invalid", error: true });
  if (!refreshTokens.includes(refreshToken)) return res.status(403).json({ message: "refresh token param is invalid", error: true });
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "have an error when verify token", error: true });
    const tokenUser = {
      username: user.username,
      title: user.title,
      password: user.password
    }
    const accessToken = generateAccessToken(tokenUser)
    res.status(200).json({ accessToken: accessToken, error: false });
  })
})

// generate a token
function generateAccessToken(username) {
  // expires after half and hour (1800 seconds = 30 minutes)
  return jwt.sign(username, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "30s",
  });
}

// authenticate middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({ message: "error authn token", error: true });
    req.user = user;
    next();
  });
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({
    status: false,
    errors: {
      code: err.code,
      message: err.message,
    },
  });
});

module.exports = app;
