const express = require("express");
const router = express.Router();
const productsController = require("../controllers/productsController");

router.route("/add-product").post(productsController.addProduct);

router.route("/get-products").get(productsController.getProducts);

router.route("/add-cart-product").post(productsController.addCartProduct);

router
  .route("/subtract-product-quantity")
  .post(productsController.subtractProductQuantityFromCart);

router.route("/get-cart-products").get(productsController.getCartProducts);

router.route("/edit-product/:productId").put(productsController.editProduct);

router
  .route("/delete-product/:productId")
  .delete(productsController.deleteProduct);

router.route("/proceed-checkout").post(productsController.proceedCheckout);

router.route("/get-orders").get(productsController.getOrders);

router.route("/cancel-order/:orderId").delete(productsController.cancelOrder);

router
  .route("/create-subscription")
  .post(productsController.createSubscription);

router.route("/get-subscriptions").get(productsController.getSubscriptions);

router
  .route("/cancel-subscription/:subscriptionId")
  .delete(productsController.cancelSubscription);

module.exports = router;
