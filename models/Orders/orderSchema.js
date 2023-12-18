const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Order = new Schema({
  products: [
    {
      product: { productName: String, price: Number },
      quantity: { type: Number, required: true },
    },
  ],
  customerDetails: {
    city: String,
    street: String,
    apartment: String,
    county: String,
    phone: String,
    name: String,
  },
  userId: String,
  createdDate: Date,
  total: Number,
});

const model = mongoose.model("Order", Order);

module.exports = model;
