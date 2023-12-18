const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Product = new Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  inStock: { type: Boolean, required: true },
  image: { type: String },
});

const model = mongoose.model("Product", Product);

module.exports = model;
