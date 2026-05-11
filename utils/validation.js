const emptyFieldValidation = (res, ...fields) => {
    if (fields.includes('') || fields.includes(undefined)) {
        return res.status(400).json({
            success: false,
            message: "Please fill in all fields."
        })
    }
}
module.exports = { emptyFieldValidation }