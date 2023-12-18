const User = require("../models/Users/usersSchema");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const nodemailer = require("nodemailer");

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(`${process.env.SEND_GRID_TRANSPORT_KEY}`);

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: `${process.env.SEND_GRID_TRANSPORT_KEY}`,
    },
  })
);

const register = async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email)
    return res
      .status(400)
      .json({ message: "Username, password and email are required." });

  const duplicate = await User.findOne({ username }).exec();
  if (duplicate) return res.sendStatus(409);

  try {
    const hashedPwd = await bcrypt.hash(password, 10);

    await User.create({
      username: username,
      password: hashedPwd,
      email: email,
      roles: "CLIENT",
      cart: [],
    });

    res.status(201).json({ username, password });

    transporter.sendMail({
      to: email,
      from: "biofarm.application@gmail.com",
      subject: "Inregistrare cont cu succes.",
      html: `<h1>Inregistrarea contului dumneavoastra s-a finalizat cu succes.</h1>
      <h2>Detaliile contului dumneavoastra sunt:</h2>
      <p>username: ${username}</p>
      <p>parola: ${password}</p>
      <p>e-mail: ${email}</p>
      `,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const foundUser = await User.findOne({ username }).exec();

  if (!foundUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const match = await bcrypt.compare(password, foundUser.password);

  if (!match) return res.status(401).json({ message: "Unauthorized" });

  const accessToken = jwt.sign(
    {
      UserInfo: {
        username: foundUser.username,
        id: foundUser._id,
        roles: foundUser.roles,
      },
    },
    `${process.env.ACCESS_TOKEN_SECRET}`,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { username: foundUser.username, id: foundUser._id, roles: foundUser.roles },
    `${process.env.REFRESH_TOKEN_SECRET}`,
    { expiresIn: "1d" }
  );

  res.cookie("jwt", refreshToken, {
    httpOnly: true,
    sameSite: "None",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken, roles: foundUser.roles });
});

const refresh = (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) return res.status(401).json({ message: "Unauthorized" });

  const refreshToken = cookies.jwt;

  jwt.verify(
    refreshToken,
    `${process.env.REFRESH_TOKEN_SECRET}`,
    asyncHandler(async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Forbidden" });

      const foundUser = await User.findOne({
        username: decoded.username,
      }).exec();

      if (!foundUser) return res.status(401).json({ message: "Unauthorized" });

      const accessToken = jwt.sign(
        {
          UserInfo: {
            id: foundUser._id,
            username: foundUser.username,
            roles: foundUser.roles,
          },
        },
        `${process.env.ACCESS_TOKEN_SECRET}`,
        { expiresIn: "15m" }
      );

      res.json({ accessToken, roles: foundUser.roles });
    })
  );
};

const logout = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204);
  res.clearCookie("jwt", { httpOnly: true, sameSite: "None" });
  res.json({ message: "Cookie cleared" });
};

module.exports = {
  login,
  register,
  refresh,
  logout,
};
