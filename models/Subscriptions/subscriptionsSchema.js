const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Subscription = new Schema({
  products: [
    {
      product: { title: String, price: Number, image: String },
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
  startDate: String,
  endDate: String,
  total: Number,
  recurrence: String,
});

const model = mongoose.model("Subscription", Subscription);

module.exports = model;
