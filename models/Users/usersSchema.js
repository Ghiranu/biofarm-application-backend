const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const User = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: [3, "Username cannot be less than 3 characters."],
  },
  password: {
    type: String,
    required: true,
    minlength: [3, "Password cannot be less than 3 characters."],
  },
  email: { type: String, required: true, unique: true },
  roles: { type: String },
  cart: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: { type: Number },
    },
  ],
});

User.methods.addToCart = function (product) {
  const cartProductIndex = this.cart.findIndex((cp) => {
    return cp.product.toString() === product._id.toString();
  });
  let newQuantity = 1;
  const updatedCart = [...this.cart];

  if (cartProductIndex >= 0) {
    newQuantity = this.cart[cartProductIndex].quantity + 1;
    updatedCart[cartProductIndex].quantity = newQuantity;
  } else {
    updatedCart.push({
      product: product._id,
      quantity: newQuantity,
    });
  }

  this.cart = updatedCart;
  return this.save();
};

User.methods.removeFromCart = function (productId) {
  const updatedCartItems = this.cart.filter((item) => {
    return item.product._id.toString() !== productId.toString();
  });
  this.cart = updatedCartItems;
  return this.save();
};

User.methods.subtractFromCart = function (product) {
  const cartProductIndex = this.cart.findIndex((cp) => {
    return cp.product.toString() === product._id.toString();
  });

  const updatedCart = [...this.cart];

  if (updatedCart[cartProductIndex].quantity - 1 === 0) {
    this.removeFromCart(product._id);
  } else {
    updatedCart[cartProductIndex].quantity -= 1;
    this.cart = updatedCart;
    return this.save();
  }
};

User.methods.clearCart = function () {
  this.cart = [];
  return this.save();
};

const model = mongoose.model("User", User);

module.exports = model;
