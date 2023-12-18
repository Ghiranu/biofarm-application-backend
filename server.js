const path = require("path");

const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const credentials = require("./middlewares/credentials");
const corsOptions = require("./config/corsOptions");
const multer = require("multer");
const fileStorage = require("./config/multerStorage");
const fileFilter = require("./config/multerFileFilter");
const User = require("./models/Users/usersSchema");
const jwt_decode = require("jwt-decode");
const Order = require("./models/Orders/orderSchema");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const nodemailer = require("nodemailer");

require("dotenv").config();

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(`${process.env.SEND_GRID_TRANSPORT_KEY}`);

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: `${process.env.SEND_GRID_TRANSPORT_KEY}`,
    },
  })
);

const imagesDirectory = path.join(__dirname, "images");

mongoose.connect(process.env.DATABASE_CONNECTION_URL);
mongoose.connection.on("connected", () => {
  console.log("MongoDB connected at port 27017");
});

app.use(cookieParser());

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use(credentials);

app.use(cors(corsOptions));

app.use(
  multer({
    storage: fileStorage,
    fileFilter: fileFilter,
  }).single("image")
);

app.use((req, res, next) => {
  if (!req.cookies.jwt) {
    return next();
  }

  const token = req.cookies.jwt;
  const decodedToken = jwt_decode(token);
  const userId = decodedToken.id;
  User.findById(userId)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      next(new Error(err));
    });
});

const stripe = require("stripe")(`${process.env.STRIPE_API_KEY}`);

const endpointSecret = `${process.env.ENDPOINT_SECRET}`;

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    let event = request.body;
    if (endpointSecret) {
      const signature = request.headers["stripe-signature"];
      try {
        event = stripe.webhooks.constructEvent(
          request.body,
          signature,
          endpointSecret
        );
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return response.sendStatus(400);
      }
    }

    if (event.type === "checkout.session.completed") {
      const sessionId = event.data.object.id;
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items"],
      });

      console.log(session, "SESSIOn");

      try {
        const user = await User.findOne({
          email: session.customer_details.email,
        });

        const products = session.line_items.data.map((item) => {
          return {
            product: {
              productName: item.description,
              price: item.price.unit_amount / 100,
            },
            quantity: item.quantity,
          };
        });

        const order = await new Order({
          products: products,
          userId: user._id,
          createdDate: new Date(),
          customerDetails: {
            city: session.customer_details.address.city,
            street: session.customer_details.address.line1,
            apartment: session.customer_details.address.line2,
            phone: session.customer_details.phone,
            name: session.customer_details.name,
            county: session.customer_details.address.state,
          },
          total: session.amount_total / 100,
        });

        order
          .save()
          .then((order) => {
            transporter.sendMail({
              to: user.email,
              from: "biofarm.application@gmail.com",
              subject: "Comanda plasata.",
              html: `<h1>Comanda dumneavoastra a fost plasata cu sucess!</h1>
            <h2>Detaliile comenzii dumneavoastra sunt:</h2>
            <p>Produse: ${order.products.map(
              (item) =>
                `<li>${item.product.productName}: ${item.product.price} RON x${item.quantity}</li>`
            )}</p>
            <p>Detalii client:</p>
            <p>Adresa: strada ${order.customerDetails.street} ap.${
                order.customerDetails.apartment
              }</p>
            <p>Judet: ${order.customerDetails.county}</p>
            <p>Localitate: ${order.customerDetails.city}</p>
            <p>Numar de telefon: ${order.customerDetails.phone}</p>
            `,
            });
          })
          .then(() => {
            user.clearCart();
          })
          .catch((err) => {
            console.log(err);
          });
      } catch (error) {
        console.error(error);
      }
    }
    response.send();
  }
);

app.use("/images", express.static(imagesDirectory));

app.use("/auth", require("./routes/authRoutes"));
app.use("/products", require("./routes/productsRoutes"));
app.listen(8080);
