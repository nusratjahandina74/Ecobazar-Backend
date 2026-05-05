const emptyFieldValidation = (res, ...fields)=>{  
    if (fields.includes('') || fields.includes(undefined)) {
            return res.status(400).send({
                success: false,
                message: "Please fill in all fields."
            })
    }
}
module.exports = {emptyFieldValidation}