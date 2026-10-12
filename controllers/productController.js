const sendError = require('../utils/sendError');
const { removeStoredImages, removeRequestFiles } = require('../utils/fileCleanup');
const mongoose = require('mongoose');
const Product = require('../models/productModel')
const { emptyFieldValidation } = require('../utils/validation');

const PRODUCT_FIELDS = ['title', 'description', 'price', 'discountPrice', 'stock', 'shortDescription',
    'category', 'subCategory', 'tag', 'additionalInfo', 'status']

// Uploaded files -> [{ url, isMain }]. Stored as a relative path (/uploads/products/<file>);
// the frontend prefixes its API base URL. First image is the main one unless `hasMain` is true.
const filesToImages = (files = [], hasMain = false) =>
    files.map((f, i) => ({ url: `/uploads/products/${f.filename}`, isMain: !hasMain && i === 0 }))

// Pick only known fields; drop empty strings (multipart sends "" for blank inputs).
const pickProductFields = (body) => {
    const data = {}
    PRODUCT_FIELDS.forEach((k) => {
        if (body[k] !== undefined && body[k] !== '') data[k] = body[k]
    })
    if (data.tag !== undefined && !Array.isArray(data.tag)) {
        data.tag = String(data.tag).split(',').map((t) => t.trim()).filter(Boolean)
    }
    return data
}
const createProductController = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req) })
    try {
        const { title, price, category, stock } = req.body

        //Validation check ebong ekhanei controller thamanor bebostha
        const hasError = emptyFieldValidation(res, title, price, category, stock);
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
        if (Number(stock) < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity cannot be less than 0"
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
            ...pickProductFields(req.body),
            sku: sku,
            images: filesToImages(req.files)
        });
        await product.save()

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });

    } catch (error) {
        console.log(error);
        return sendError(res, error)
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
        return sendError(res, error)
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
        return sendError(res, error)
    }
}
const updateProductController = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req) })
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
        if (req.body.stock !== undefined && Number(req.body.stock) < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity cannot be less than 0"
            });
        }

        const existing = await Product.findById(id)
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            })
        }
        const update = pickProductFields(req.body)

        // Optional image handling (additive): `removeImages` = urls to drop, uploaded `photos` are appended (max 5 total)
        let remove = req.body.removeImages || []
        if (!Array.isArray(remove)) remove = [remove]
        const kept = existing.images.filter((img) => !remove.includes(img.url))
        const added = filesToImages(req.files, kept.some((i) => i.isMain))
        if (kept.length + added.length > 5) {
            return res.status(400).json({
                success: false,
                message: "A product can have at most 5 images"
            })
        }
        if (req.files?.length || remove.length) {
            const merged = [...kept, ...added]
            if (merged.length && !merged.some((i) => i.isMain)) merged[0].isMain = true
            update.images = merged
        }

        const removedImages = existing.images.filter((img) => remove.includes(img.url)).map((img) => ({ url: img.url }))
        const productData = await Product.findByIdAndUpdate(id, update, { new: true, runValidators: true })
        if (productData && update.images) removeStoredImages(removedImages)

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
        if (error && error.code === 11000) {
            return res.status(400).json({ success: false, message: "Product title already exists" })
        }
        console.log(error);
        return sendError(res, error)
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
        removeStoredImages(productData.images)
        return res.status(200).json({
            success: true,
            message: "Product Delete Sccessfully Done",
        })
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
module.exports = { createProductController, getAllProductController, singleProductController, updateProductController, deleteProductController }