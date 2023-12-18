const Product = require("../models/Products/productSchema");
const Order = require("../models/Orders/orderSchema");
const Subscription = require("../models/Subscriptions/subscriptionsSchema");
const stripe = require("stripe")(`${process.env.STRIPE_API_KEY}`);
const dayjs = require("dayjs");

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

const addProduct = async (req, res) => {
  const title = req.body.title;
  const price = Number(req.body.price);
  const image = req.file;
  const inStock = JSON.parse(req.body.inStock);

  console.log(req.file);

  if (!image) {
    return res
      .status(400)
      .JSON({ message: "Attached image is not of type jpg, jpeg, png" });
  }

  const imageUrl = image.path.replace("\\", "/");

  const product = new Product({
    title: title,
    price: price,
    inStock: inStock,
    image: imageUrl,
  });

  product
    .save()
    .then(() =>
      res.status(201).json({ message: "Product successfully created." })
    )
    .catch((error) => res.status(500).json({ message: error.message }));
};

const getProducts = (req, res) => {
  Product.find()
    .then((products) => res.status(200).json(products))
    .catch((error) => res.status(500).json(error.message));
};

const addCartProduct = (req, res) => {
  const product = req.body.productId;

  Product.findById(product)
    .then((productDb) => {
      return req.user.addToCart(productDb);
    })
    .then(() =>
      res
        .status(200)
        .json({ message: "Product successfully added to the cart." })
    )
    .catch((error) => res.status(500).json({ message: error.message }));
};

const getCartProducts = (req, res) => {
  req.user
    .populate("cart.product")
    .then((userModel) => {
      const userCartProducts = userModel.cart;
      return res.status(200).json(userCartProducts);
    })
    .catch((error) => res.status(500).json({ message: error.message }));
};

const subtractProductQuantityFromCart = (req, res) => {
  const product = req.body.productId;

  Product.findById(product)
    .then((productDb) => {
      return req.user.subtractFromCart(productDb);
    })
    .then(() =>
      res
        .status(200)
        .json({ message: "Product successfully subtracted from the cart." })
    )
    .catch((error) => res.status(500).json({ message: error.message }));
};

const editProduct = (req, res) => {
  const productId = req.params.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = Number(req.body.price);
  const updatedInStock = JSON.parse(req.body.inStock);
  const updatedImage = req.file && req.file.path.replace("\\", "/");

  Product.findById(productId)
    .then((product) => {
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.inStock = updatedInStock;
      product.image = updatedImage;

      return product.save();
    })
    .then(() => {
      res.status(200).json({ message: "Product edited successfully" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Something went wrong" });
    });
};

const deleteProduct = (req, res) => {
  const productId = req.params.productId;

  Product.findOneAndRemove(productId)
    .then((product) => {
      req.user.removeFromCart(productId);
      res.status(200).json({ message: "Product deleted successfully" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Something went wrong" });
    });
};

const proceedCheckout = (req, res, next) => {
  console.log(req.body, "BODY");
  let products;
  req.user
    .populate("cart.product")
    .then(async (user) => {
      products = user.cart;

      if (req.body.paymentMethod === "Plata online") {
        const customer = await stripe.customers.create({
          email: req.user.email,
          phone: `+4${req.body.phone}`,
          address: {
            city: req.body.city,
            line1: req.body.street,
            line2: req.body.apartment,
            state: req.body.county,
            country: "RO",
          },
        });

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          currency: "ron",
          payment_intent_data: {
            receipt_email: req.user.email,
          },
          phone_number_collection: {
            enabled: true,
          },
          customer: customer.id,
          line_items: products.map((p) => {
            return {
              quantity: p.quantity,
              price_data: {
                currency: "ron",
                unit_amount: p.product.price * 100,
                product_data: {
                  name: p.product.title,
                },
              },
            };
          }),
          success_url: "http://localhost:3000/orders",
          cancel_url: "http://localhost:3000/shopping-cart",
        });
        return res.status(200).json({ url: session.url });
      } else {
        const orderProducts = products.map((item) => {
          return {
            product: {
              productName: item.product.title,
              price: item.product.price,
            },
            quantity: item.quantity,
          };
        });

        let total = 0;

        orderProducts.forEach((item) => {
          total += item.product.price * item.quantity;
        });

        const order = await new Order({
          products: orderProducts,
          userId: user._id,
          createdDate: new Date(),
          customerDetails: {
            city: req.body.city,
            street: req.body.street,
            apartment: req.body.apartment,
            phone: req.body.phone,
            county: req.body.county,
          },
          total,
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
            return res
              .status(200)
              .json({ message: "Order completed successfully!" });
          })
          .catch((err) => {
            console.log(err);
          });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Something went wrong" });
    });
};

const getOrders = (req, res) => {
  Order.find({ userId: req.user._id })
    .then((orders) => {
      const mappedOrders = orders.map((order) => {
        return {
          products: order.products,
          customerDetails: order.customerDetails,
          createdDate: order.createdDate,
          total: order.total,
          _id: order._id,
        };
      });
      res.status(200).json(mappedOrders);
    })
    .catch((error) => res.status(500).json(error.message));
};

const cancelOrder = (req, res) => {
  const orderId = req.params.orderId;

  Order.findOneAndRemove(orderId)
    .then((order) => {
      console.log(order, "ORDER");
      transporter.sendMail({
        to: req.user.email,
        from: "biofarm.application@gmail.com",
        subject: "Comanda anulata.",
        html: `<h1>Ne cerem scuze, dar comanda nu va mai fi onorata!</h1>
      <h2>Detaliile comenzii anulate din data de ${dayjs(
        order.createdDate
      ).format("DD/MM/YYYY")} sunt:</h2>
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
      return res.status(200).json({ message: "Order deleted successfully" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Something went wrong" });
    });
};

const createSubscription = async (req, res) => {
  const products = req.body.products;
  const customerDetails = req.body.customerDetails;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  const total = req.body.total;
  const recurrence = req.body.recurrence;

  const subscription = new Subscription({
    products,
    customerDetails,
    startDate,
    endDate,
    total,
    recurrence,
    userId: req.user._id,
  });

  subscription
    .save()
    .then(() => {
      transporter.sendMail({
        to: req.user.email,
        from: "biofarm.application@gmail.com",
        subject: "Abonament activat.",
        html: `<h1>Abonamentul dumneavoastra a fost activat cu sucess!</h1>
      <h2>Detaliile abonamentului dumneavoastra sunt:</h2>
      <p>Produse: ${subscription.products.map(
        (item) =>
          `<li>${item.product.title}: ${item.product.price} RON x${item.quantity}</li>`
      )}</p>
      <p>Detalii client:</p>
      <p>Adresa: strada ${subscription.customerDetails.street} ap.${
          subscription.customerDetails.apartment
        }</p>
      <p>Judet: ${subscription.customerDetails.county}</p>
      <p>Localitate: ${subscription.customerDetails.city}</p>
      <p>Numar de telefon: ${subscription.customerDetails.phone}</p>
      <p>Data de incepere: ${subscription.startDate}</p>
      <p>Data de incheiere: ${subscription.endDate}</p>
      <p>Recurenta livrare produse: ${subscription.recurrence}</p>
      <p>Total: ${subscription.total} RON</p>
      `,
      });
    })
    .then(() => {
      req.user.clearCart();
      return res
        .status(201)
        .json({ message: "Subscription successfully created." });
    })
    .catch((error) => res.status(500).json({ message: error.message }));
};

const getSubscriptions = (req, res) => {
  Subscription.find({ userId: req.user._id })
    .then((subscriptions) => {
      const mappedSubscriptions = subscriptions.map((subscription) => {
        return {
          products: subscription.products,
          customerDetails: subscription.customerDetails,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          recurrence: subscription.recurrence,
          total: subscription.total,
          _id: subscription._id,
        };
      });
      res.status(200).json(mappedSubscriptions);
    })
    .catch((error) => res.status(500).json(error.message));
};

const cancelSubscription = (req, res) => {
  const subscriptionId = req.params.subscriptionId;

  Subscription.findOneAndRemove(subscriptionId)
    .then(() => {
      return res
        .status(200)
        .json({ message: "Subscription deleted successfully" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Something went wrong" });
    });
};

module.exports = {
  addProduct,
  getProducts,
  addCartProduct,
  getCartProducts,
  editProduct,
  deleteProduct,
  proceedCheckout,
  getOrders,
  cancelOrder,
  subtractProductQuantityFromCart,
  createSubscription,
  getSubscriptions,
  cancelSubscription,
};
