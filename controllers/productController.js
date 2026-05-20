const mongoose = require('mongoose');
const Product = require('../models/productModel')
const { emptyFieldValidation } = require('../utils/validation');
const createProductController = async (req, res) => {
    try {
        const { title, price, category } = req.body

        //Validation check ebong ekhanei controller thamanor bebostha
        const hasError = emptyFieldValidation(res, title, price, category);
        if (hasError || res.headersSent) return;

        const titlExist = await Product.findOne({ title: title });
        if (titlExist) {
            return res.status(400).json({
                success: false,
                message: "Product title already exists"
            });
        }

        if (price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be greater than 0"
            });
        }

        const sku = `${Date.now()}-${new Date().getFullYear()}`
        const skuExist = await Product.findOne({ sku: sku });
        if (skuExist) {
            return res.status(400).json({
                success: false,
                message: "Product SKU already exists"
            });
        }

        const product = new Product({
            ...req.body,
            sku: sku
        });
        await product.save()

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const getAllProductController = async (req, res) => {
    try {
        const productData = await Product.find({})
        if (productData.length > 0) {
            return res.status(200).json({
                success: true,
                message: "All Products fetched successfully",
                totalProducts: productData.length,
                data: productData
            })
        } else {
            return res.status(404).json({
                success: false,
                message: "No products found in the database"
            })
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const singleProductController = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Product ID format"
            });
        }

        const productData = await Product.findById(id)
        if (!productData) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product found successfully",
            data: productData
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const updateProductController = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Product ID format"
            });
        }

        if (req.body.price && Number(req.body.price) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be greater than 0"
            });
        }

        const productData = await Product.findByIdAndUpdate(id, req.body, { new: true, runValidators: true })

        if (!productData) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Product Update Sccessfully Done",
            data: productData
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const deleteProductController = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Product ID format"
            });
        }
        const productData = await Product.findByIdAndDelete(id)
        if (!productData) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Product Delete Sccessfully Done",
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
module.exports = { createProductController, getAllProductController, singleProductController, updateProductController, deleteProductController }