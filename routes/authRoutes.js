const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const loginLimiter = require("../middlewares/loginLimiter");

router.route("/login").post(loginLimiter, authController.login);

router.route("/register").post(authController.register);

router.route("/refresh").get(authController.refresh);

router.route("/logout").get(authController.logout);

module.exports = router;
