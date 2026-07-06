const axios = require("axios");
const Cart = require('../models/cartModel')
const paymentController = async (req, res) => {
    const {userId, amount, cus_name, cus_email, cus_add1, cus_add2, cus_city, cus_state, cus_postcode, cus_phone}= req.body
  try {
    const cart = await Cart.find({user: userId}).populate('product')
    let totalPrice = 0
    let pro = []

    cart.map(item=>{
        if (item.totalPrice) {
        totalPrice += item.totalPrice; 
        }
        if (item.product) {
            item.product.quantity = item.quantity;
            pro.push(item.product);
        }
        console.log(item.quantity, item.totalPrice);
    })
    console.log(totalPrice, pro);
    const paymentData = {
      store_id: "aamarpaytest",
      tran_id: Date.now().toString(),
      success_url: "http://www.merchantdomain.com/successpage.html",
      fail_url: "http://www.merchantdomain.com/failedpage.html",
      cancel_url: "http://www.merchantdomain.com/cancelpage.html",
      amount: amount,
      currency: "BDT",
      signature_key: "dbb74894e82415a2f7ff0ec3a97e4183",
      desc: "Merchant Registration Payment",
      cus_name: cus_name,
      cus_email: cus_email,
      cus_add1: cus_add1,
      cus_add2: cus_add2,
      cus_city: cus_city,
      cus_state: cus_state,
      cus_postcode: cus_postcode,
      cus_country: "Bangladesh",
      cus_phone: cus_phone,
      type: "json",
    };

    const { data } = await axios.post(
      "https://sandbox.aamarpay.com/jsonpost.php",
      paymentData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      message: "Payment Failed",
      error: error.response?.data || error.message,
    });
  }
};

module.exports = {paymentController,}